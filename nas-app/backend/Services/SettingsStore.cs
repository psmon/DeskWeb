using System.Text.Json;
using MidiAniPlayer.Models;

namespace MidiAniPlayer.Services;

/// <summary>
/// Loads and persists <see cref="AppSettings"/> in the embedded DB (a single JSON
/// row), so one mounted data dir persists settings + library + catalog together.
/// A pre-existing settings.json (older versions) is migrated into the DB once.
/// Thread-safe for the small read/write volume this app sees.
/// </summary>
public sealed class SettingsStore
{
    private readonly TrackDb _db;
    private readonly Lock _gate = new();
    private AppSettings _cache;

    public SettingsStore(TrackDb db, string? legacyDataDir = null)
    {
        _db = db;
        _cache = Load(legacyDataDir);
    }

    public AppSettings Get()
    {
        lock (_gate) return Clone(_cache);
    }

    public AppSettings Save(AppSettings incoming)
    {
        lock (_gate)
        {
            _cache = Clone(incoming);
            var json = JsonSerializer.Serialize(_cache, AppJsonContext.Default.AppSettings);
            _db.SaveSettingsJson(json);
            return Clone(_cache);
        }
    }

    private AppSettings Load(string? legacyDataDir)
    {
        // 1) DB is the source of truth.
        try
        {
            var json = _db.GetSettingsJson();
            if (!string.IsNullOrWhiteSpace(json))
            {
                var parsed = JsonSerializer.Deserialize(json, AppJsonContext.Default.AppSettings);
                if (parsed is not null) return parsed;
            }
        }
        catch { /* fall through to migration / defaults */ }

        // 2) One-time migration: import an older settings.json, then persist to DB.
        if (!string.IsNullOrWhiteSpace(legacyDataDir))
        {
            try
            {
                var legacy = Path.Combine(legacyDataDir, "settings.json");
                if (File.Exists(legacy))
                {
                    var parsed = JsonSerializer.Deserialize(
                        File.ReadAllText(legacy), AppJsonContext.Default.AppSettings);
                    if (parsed is not null)
                    {
                        _db.SaveSettingsJson(
                            JsonSerializer.Serialize(parsed, AppJsonContext.Default.AppSettings));
                        return parsed;
                    }
                }
            }
            catch { /* corrupt legacy file → defaults */ }
        }

        return new AppSettings();
    }

    private static AppSettings Clone(AppSettings s) => new()
    {
        ScanFolders = new List<string>(s.ScanFolders),
        DefaultEngine = s.DefaultEngine,
        Volume = s.Volume,
        LastSongPath = s.LastSongPath,
        BitmidiEnabled = s.BitmidiEnabled,
        SmbShares = s.SmbShares.Select(x => new SmbShare
        {
            Name = x.Name,
            Host = x.Host,
            Share = x.Share,
            Path = x.Path,
            Username = x.Username,
            Password = x.Password,
            Domain = x.Domain,
        }).ToList(),
    };
}
