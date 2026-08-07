using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using MidiAniPlayer.Models;

namespace MidiAniPlayer.Services;

/// <summary>
/// Embedded SQLite playlist store for the whole catalog — BitMidi (online refs)
/// and local scanned files — with FTS5 full-text title search and paging.
///
/// Replaces loading the full bitmidi.json into the browser: the catalog grows
/// well past what a single JSON payload can serve, so browsing/searching moves
/// server-side against an indexed table.
///
/// AOT: all access is raw ADO SQL (no reflection). The native e_sqlite3 (with
/// FTS5) is bundled via SQLitePCLRaw.bundle_e_sqlite3.
///
/// MIGRATION: schema is created idempotently; the bundled bitmidi.json is a
/// re-seedable source of truth for source='bitmidi'. On each start, if the seed
/// file's signature changed (the collector grew it), rows are re-inserted with
/// INSERT OR IGNORE — so a bigger catalog simply appears, no manual migration.
/// </summary>
public sealed class TrackDb
{
    private const int SchemaVersion = 1;
    private readonly string _connStr;
    private readonly Lock _writeGate = new();

    public TrackDb(string dataDir)
    {
        Directory.CreateDirectory(dataDir);
        var dbPath = Path.Combine(dataDir, "tracks.db");
        _connStr = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadWriteCreate,
        }.ToString();
        InitSchema();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connStr);
        c.Open();
        Exec(c, "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
        return c;
    }

    private void InitSchema()
    {
        lock (_writeGate)
        {
            using var c = Open();
            Exec(c, """
                CREATE TABLE IF NOT EXISTS schema_meta (
                  key   TEXT PRIMARY KEY,
                  value TEXT
                );

                -- User settings live in the DB too (single JSON row) so ONE mounted
                -- data dir persists everything: settings, scanned library, catalog.
                CREATE TABLE IF NOT EXISTS settings (
                  id   INTEGER PRIMARY KEY CHECK (id = 1),
                  json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tracks (
                  id         INTEGER PRIMARY KEY,
                  source     TEXT NOT NULL,          -- 'bitmidi' | 'local'
                  title      TEXT NOT NULL,
                  genre      TEXT,                   -- bitmidi genre or NULL
                  ref        TEXT NOT NULL,          -- bitmidi url OR local path
                  folder     TEXT,                   -- local folder label
                  size       INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ux_tracks_src_ref ON tracks(source, ref);
                CREATE INDEX IF NOT EXISTS ix_tracks_src_genre ON tracks(source, genre);

                -- External-content FTS5 index over the title (unicode61 folds case/diacritics).
                CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
                  title,
                  content='tracks',
                  content_rowid='id',
                  tokenize='unicode61'
                );

                CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
                  INSERT INTO tracks_fts(rowid, title) VALUES (new.id, new.title);
                END;
                CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
                  INSERT INTO tracks_fts(tracks_fts, rowid, title) VALUES('delete', old.id, old.title);
                END;
                CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
                  INSERT INTO tracks_fts(tracks_fts, rowid, title) VALUES('delete', old.id, old.title);
                  INSERT INTO tracks_fts(rowid, title) VALUES (new.id, new.title);
                END;
                """);
            SetMeta(c, "schema_version", SchemaVersion.ToString());
        }
    }

    /// <summary>
    /// Seed / re-seed source='bitmidi' rows from the bundled bitmidi.json. Idempotent:
    /// INSERT OR IGNORE keyed on (source, ref) means re-runs only add new songs. Skips
    /// the whole pass when the file signature is unchanged (fast startup).
    /// </summary>
    public void SeedBitmidi(string? bitmidiJsonPath)
    {
        if (string.IsNullOrWhiteSpace(bitmidiJsonPath) || !File.Exists(bitmidiJsonPath))
            return;

        string signature;
        try
        {
            var fi = new FileInfo(bitmidiJsonPath);
            signature = $"{fi.Length}:{fi.LastWriteTimeUtc.Ticks}";
        }
        catch { return; }

        lock (_writeGate)
        {
            using var c = Open();
            if (GetMeta(c, "bitmidi_seed_sig") == signature)
                return; // unchanged since last seed

            List<BitmidiSeed>? seed;
            try
            {
                using var fs = File.OpenRead(bitmidiJsonPath);
                seed = JsonSerializer.Deserialize(fs, AppJsonContext.Default.ListBitmidiSeed);
            }
            catch { return; } // corrupt seed → leave DB as-is
            if (seed is null || seed.Count == 0) return;

            using var tx = c.BeginTransaction();
            using var cmd = c.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT OR IGNORE INTO tracks(source, title, genre, ref)
                VALUES ('bitmidi', $t, $g, $u)
                """;
            var pt = cmd.CreateParameter(); pt.ParameterName = "$t"; cmd.Parameters.Add(pt);
            var pg = cmd.CreateParameter(); pg.ParameterName = "$g"; cmd.Parameters.Add(pg);
            var pu = cmd.CreateParameter(); pu.ParameterName = "$u"; cmd.Parameters.Add(pu);
            foreach (var e in seed)
            {
                if (string.IsNullOrWhiteSpace(e.Url) || string.IsNullOrWhiteSpace(e.Title)) continue;
                pt.Value = e.Title;
                pg.Value = string.IsNullOrWhiteSpace(e.Genre) ? (object)DBNull.Value : e.Genre;
                pu.Value = e.Url;
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
            SetMeta(c, "bitmidi_seed_sig", signature);
        }
    }

    /// <summary>Read the stored settings JSON blob (null if none saved yet).</summary>
    public string? GetSettingsJson()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT json FROM settings WHERE id = 1";
        return cmd.ExecuteScalar() as string;
    }

    /// <summary>Persist the settings JSON blob (single row).</summary>
    public void SaveSettingsJson(string json)
    {
        lock (_writeGate)
        {
            using var c = Open();
            using var cmd = c.CreateCommand();
            cmd.CommandText = "INSERT INTO settings(id, json) VALUES(1, $j) " +
                              "ON CONFLICT(id) DO UPDATE SET json = excluded.json";
            cmd.Parameters.AddWithValue("$j", json);
            cmd.ExecuteNonQuery();
        }
    }

    /// <summary>
    /// Incremental resync of a scanned folder: delete the prior source='local' rows
    /// under <paramref name="rootPrefix"/> (so deleted files drop off), then insert
    /// the current scan. Persisted → the library reappears next run WITHOUT rescanning;
    /// rescanning is a cheap diff, not a rebuild. A null/blank prefix falls back to a
    /// plain upsert so it can never wipe the whole library.
    /// </summary>
    public void SyncLocalFolder(string? rootPrefix, IReadOnlyList<ScanEntry> entries)
    {
        lock (_writeGate)
        {
            using var c = Open();
            using var tx = c.BeginTransaction();

            if (!string.IsNullOrWhiteSpace(rootPrefix))
            {
                var sep = rootPrefix.Contains('\\') ? "\\" : "/";
                var prefix = rootPrefix.TrimEnd('\\', '/') + sep; // match children only
                using var del = c.CreateCommand();
                del.Transaction = tx;
                // exact prefix match (substr) — avoids LIKE wildcard pitfalls with _ / %
                del.CommandText =
                    "DELETE FROM tracks WHERE source='local' AND substr(ref, 1, length($p)) = $p";
                del.Parameters.AddWithValue("$p", prefix);
                del.ExecuteNonQuery();
            }

            using var cmd = c.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO tracks(source, title, genre, ref, folder, size)
                VALUES ('local', $t, NULL, $r, $f, $s)
                ON CONFLICT(source, ref) DO UPDATE SET
                  title=excluded.title, folder=excluded.folder, size=excluded.size
                """;
            var pt = cmd.CreateParameter(); pt.ParameterName = "$t"; cmd.Parameters.Add(pt);
            var pr = cmd.CreateParameter(); pr.ParameterName = "$r"; cmd.Parameters.Add(pr);
            var pf = cmd.CreateParameter(); pf.ParameterName = "$f"; cmd.Parameters.Add(pf);
            var ps = cmd.CreateParameter(); ps.ParameterName = "$s"; cmd.Parameters.Add(ps);
            foreach (var e in entries)
            {
                pt.Value = e.Title;
                pr.Value = e.Path;
                pf.Value = string.IsNullOrEmpty(e.Folder) ? (object)DBNull.Value : e.Folder;
                ps.Value = e.Size;
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }
    }

    /// <summary>
    /// Paged query. <paramref name="q"/> (if present) runs an FTS5 prefix MATCH on the
    /// title; otherwise browse by source/genre ordered by id. genre "전체"/empty = all.
    /// </summary>
    public TrackPage Query(string? source, string? genre, string? q, int page, int pageSize)
    {
        page = Math.Max(0, page);
        pageSize = Math.Clamp(pageSize, 1, 500);
        var offset = page * pageSize;

        var where = new StringBuilder();
        var ps = new List<(string, object)>();
        void And(string clause, string name, object val)
        {
            where.Append(where.Length == 0 ? " WHERE " : " AND ").Append(clause);
            ps.Add((name, val));
        }

        if (!string.IsNullOrWhiteSpace(source))
            And("t.source = $src", "$src", source);
        if (!string.IsNullOrWhiteSpace(genre) && genre != "전체")
            And("t.genre = $genre", "$genre", genre);

        var match = BuildMatch(q);
        string from, order;
        if (match is not null)
        {
            from = "tracks t JOIN tracks_fts f ON f.rowid = t.id";
            where.Append(where.Length == 0 ? " WHERE " : " AND ").Append("tracks_fts MATCH $m");
            ps.Add(("$m", match));
            order = "ORDER BY rank";
        }
        else
        {
            from = "tracks t";
            order = "ORDER BY t.id";
        }

        using var c = Open();

        int total;
        using (var cnt = c.CreateCommand())
        {
            cnt.CommandText = $"SELECT COUNT(*) FROM {from}{where}";
            foreach (var (n, v) in ps) cnt.Parameters.AddWithValue(n, v);
            total = Convert.ToInt32(cnt.ExecuteScalar());
        }

        var items = new List<TrackDto>(pageSize);
        using (var sel = c.CreateCommand())
        {
            sel.CommandText =
                $"SELECT t.id, t.source, t.title, t.genre, t.ref, t.folder FROM {from}{where} {order} LIMIT $take OFFSET $skip";
            foreach (var (n, v) in ps) sel.Parameters.AddWithValue(n, v);
            sel.Parameters.AddWithValue("$take", pageSize);
            sel.Parameters.AddWithValue("$skip", offset);
            using var rd = sel.ExecuteReader();
            while (rd.Read())
            {
                items.Add(new TrackDto(
                    rd.GetInt64(0),
                    rd.GetString(1),
                    rd.GetString(2),
                    rd.IsDBNull(3) ? null : rd.GetString(3),
                    rd.GetString(4),
                    rd.IsDBNull(5) ? null : rd.GetString(5)));
            }
        }
        return new TrackPage(total, page, pageSize, items.ToArray());
    }

    public int Count(string? source)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        if (string.IsNullOrWhiteSpace(source))
            cmd.CommandText = "SELECT COUNT(*) FROM tracks";
        else
        {
            cmd.CommandText = "SELECT COUNT(*) FROM tracks WHERE source = $s";
            cmd.Parameters.AddWithValue("$s", source);
        }
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    /// <summary>
    /// Turn free text into a safe FTS5 MATCH: each token becomes a quoted prefix term
    /// ("tok"*) AND-joined. Returns null when there's nothing to match on.
    /// </summary>
    private static string? BuildMatch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return null;
        var sb = new StringBuilder();
        foreach (var raw in q.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
        {
            var tok = raw.Replace("\"", "");                 // strip quotes → no MATCH injection
            tok = new string(tok.Where(ch => char.IsLetterOrDigit(ch) || ch is '_' or '-').ToArray());
            if (tok.Length == 0) continue;
            if (sb.Length > 0) sb.Append(' ');
            sb.Append('"').Append(tok).Append("\"*");
        }
        return sb.Length == 0 ? null : sb.ToString();
    }

    private static void Exec(SqliteConnection c, string sql)
    {
        using var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    private static string? GetMeta(SqliteConnection c, string key)
    {
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT value FROM schema_meta WHERE key = $k";
        cmd.Parameters.AddWithValue("$k", key);
        return cmd.ExecuteScalar() as string;
    }

    private static void SetMeta(SqliteConnection c, string key, string value)
    {
        using var cmd = c.CreateCommand();
        cmd.CommandText = "INSERT INTO schema_meta(key, value) VALUES($k, $v) " +
                          "ON CONFLICT(key) DO UPDATE SET value = excluded.value";
        cmd.Parameters.AddWithValue("$k", key);
        cmd.Parameters.AddWithValue("$v", value);
        cmd.ExecuteNonQuery();
    }
}
