using MidiAniPlayer.Models;

namespace MidiAniPlayer.Services;

/// <summary>
/// Browses MIDI files under a dynamic set of allowed root folders. The roots are
/// the admin-configured base roots (MIDI_ROOTS) UNION the folders the owner adds
/// through Settings — so on a NAS the owner can expose their shared folders.
///
/// SECURITY: every client path used to LIST or STREAM files is resolved to its
/// real, canonical form (symlinks followed) and must live strictly under one of
/// the current roots (see <see cref="Resolve"/>). <see cref="Explore"/> is a
/// separate directory-only picker used to CHOOSE new roots; it does not stream
/// files. Do not weaken Resolve without equivalent checks.
/// </summary>
public sealed class FileBrowser
{
    private static readonly string[] MidiExtensions = { ".mid", ".midi" };

    // NAS is Linux (case-sensitive); dev may be Windows.
    private static readonly StringComparison PathComparison =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private readonly Func<IEnumerable<string>> _rootsProvider;

    public FileBrowser(Func<IEnumerable<string>> rootsProvider)
    {
        _rootsProvider = rootsProvider;
    }

    /// <summary>Canonicalized, existing roots as of right now.</summary>
    private string[] CurrentRoots()
    {
        var list = new List<string>();
        foreach (var raw in _rootsProvider())
        {
            var real = CanonicalDir(raw);
            if (real is not null && !list.Contains(real)) list.Add(real);
        }
        return list.ToArray();
    }

    public FsRoot[] Roots() =>
        CurrentRoots().Select(r => new FsRoot(DisplayName(r), r)).ToArray();

    public bool HasRoots => CurrentRoots().Length > 0;

    /// <summary>
    /// Resolve a client-supplied path to a real path guaranteed to be under a
    /// current root. Returns null if it escapes the jail or cannot be resolved.
    /// </summary>
    public string? Resolve(string? requested)
    {
        if (string.IsNullOrWhiteSpace(requested)) return null;
        var real = TryRealPath(requested);
        if (real is null) return null;
        foreach (var root in CurrentRoots())
            if (IsUnder(real, root)) return real;
        return null;
    }

    /// <summary>Canonicalize a path IF it is an existing directory; else null.</summary>
    public string? CanonicalDir(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        var real = TryRealPath(path);
        return real is not null && Directory.Exists(real) ? real : null;
    }

    public FsListResponse? List(string? requested)
    {
        var real = Resolve(requested);
        if (real is null || !Directory.Exists(real)) return null;
        return BuildListing(real, includeFiles: true);
    }

    /// <summary>
    /// Directory-only picker for choosing new roots. NOT jailed — used to browse
    /// the filesystem to locate a folder to add. Never streams files. When
    /// <paramref name="requested"/> is empty, returns the system's top-level
    /// locations (drives on Windows; /volume* or / on Linux).
    /// </summary>
    public FsListResponse? Explore(string? requested)
    {
        if (string.IsNullOrWhiteSpace(requested))
            return new FsListResponse("", null, TopLevel());

        var real = TryRealPath(requested);
        if (real is null || !Directory.Exists(real)) return null;
        return BuildListing(real, includeFiles: false);
    }

    private FsListResponse BuildListing(string real, bool includeFiles)
    {
        var entries = new List<FsEntry>();
        try
        {
            foreach (var dir in Directory.EnumerateDirectories(real))
            {
                var name = Path.GetFileName(dir);
                if (name.StartsWith('.')) continue;
                entries.Add(new FsEntry(name, dir, "dir", 0));
            }
            if (includeFiles)
            {
                foreach (var file in Directory.EnumerateFiles(real))
                {
                    if (!IsMidi(file)) continue;
                    long size = 0;
                    try { size = new FileInfo(file).Length; } catch { /* ignore */ }
                    entries.Add(new FsEntry(Path.GetFileName(file), file, "file", size));
                }
            }
        }
        catch (UnauthorizedAccessException) { /* return what we have */ }
        catch (IOException) { /* return what we have */ }

        entries.Sort(static (a, b) =>
            a.Type != b.Type
                ? string.CompareOrdinal(a.Type, b.Type)
                : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));

        string? parent = null;
        var up = Path.GetDirectoryName(real.TrimEnd(Path.DirectorySeparatorChar));
        if (up is not null && Directory.Exists(up)) parent = TryRealPath(up);

        return new FsListResponse(real, parent, entries.ToArray());
    }

    private static FsEntry[] TopLevel()
    {
        var list = new List<FsEntry>();
        if (OperatingSystem.IsWindows())
        {
            foreach (var d in DriveInfo.GetDrives())
            {
                try { if (d.IsReady) list.Add(new FsEntry(d.Name, d.RootDirectory.FullName, "dir", 0)); }
                catch { /* skip */ }
            }
        }
        else
        {
            // NAS shares live under /volumeN; fall back to / if none present.
            try
            {
                var vols = Directory.GetDirectories("/", "volume*");
                if (vols.Length > 0)
                    foreach (var v in vols) list.Add(new FsEntry(Path.GetFileName(v), v, "dir", 0));
                else
                    foreach (var d in Directory.GetDirectories("/"))
                        list.Add(new FsEntry(Path.GetFileName(d), d, "dir", 0));
            }
            catch { /* skip */ }
        }
        return list.ToArray();
    }

    public ScanEntry[]? Scan(string? requested, int max = 5000)
    {
        var real = Resolve(requested);
        if (real is null || !Directory.Exists(real)) return null;

        var results = new List<ScanEntry>();
        var opts = new EnumerationOptions
        {
            RecurseSubdirectories = true,
            IgnoreInaccessible = true,
            MatchCasing = MatchCasing.CaseInsensitive,
        };
        try
        {
            foreach (var file in Directory.EnumerateFiles(real, "*", opts))
            {
                if (!IsMidi(file)) continue;
                long size = 0;
                try { size = new FileInfo(file).Length; } catch { /* ignore */ }
                var folder = Path.GetFileName(Path.GetDirectoryName(file) ?? real);
                results.Add(new ScanEntry(Path.GetFileNameWithoutExtension(file), file, folder, size));
                if (results.Count >= max) break;
            }
        }
        catch (IOException) { /* return what we have */ }

        return results.ToArray();
    }

    /// <summary>Validate a path for streaming: a MIDI file under a current root.</summary>
    public string? ResolveMidiFile(string? requested)
    {
        var real = Resolve(requested);
        if (real is null || !File.Exists(real) || !IsMidi(real)) return null;
        return real;
    }

    private static string DisplayName(string real)
    {
        var n = Path.GetFileName(real.TrimEnd(Path.DirectorySeparatorChar));
        return string.IsNullOrEmpty(n) ? real : n;
    }

    private static bool IsMidi(string path) =>
        MidiExtensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);

    private static bool IsUnder(string candidate, string root)
    {
        if (string.Equals(candidate, root, PathComparison)) return true;
        var prefix = root.EndsWith(Path.DirectorySeparatorChar) ? root : root + Path.DirectorySeparatorChar;
        return candidate.StartsWith(prefix, PathComparison);
    }

    private static string? TryRealPath(string path)
    {
        try
        {
            var full = Path.GetFullPath(path);
            // Follow a symlink on the leaf if present. ResolveLinkTarget throws
            // on some paths (e.g. drive roots) — fall back to the plain path.
            FileSystemInfo? target = null;
            try
            {
                var info = Directory.Exists(full)
                    ? (FileSystemInfo)new DirectoryInfo(full)
                    : new FileInfo(full);
                target = info.ResolveLinkTarget(returnFinalTarget: true);
            }
            catch { /* not a link / unsupported → use full */ }
            var resolved = target?.FullName ?? full;
            // Keep root paths intact ("C:\", "/"); only trim trailing separators
            // from non-root paths so prefix comparisons stay consistent.
            var root = Path.GetPathRoot(resolved);
            if (!string.IsNullOrEmpty(root) && string.Equals(resolved, root, PathComparison))
                return resolved;
            var trimmed = resolved.TrimEnd(Path.DirectorySeparatorChar);
            return trimmed.Length == 0 ? resolved : trimmed;
        }
        catch
        {
            return null;
        }
    }
}
