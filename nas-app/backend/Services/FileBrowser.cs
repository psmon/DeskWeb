using MidiAniPlayer.Models;

namespace MidiAniPlayer.Services;

/// <summary>
/// Browses MIDI files under a fixed set of allowed root folders.
///
/// SECURITY: every path that comes from the client is resolved to its real,
/// canonical form (symlinks followed) and must live strictly under one of the
/// allowed roots. This is the primary defense against arbitrary file read on
/// the NAS — do not weaken <see cref="Resolve"/> without equivalent checks.
/// </summary>
public sealed class FileBrowser
{
    private static readonly string[] MidiExtensions = { ".mid", ".midi" };

    /// <summary>Canonicalized allowed roots (real paths, no trailing separator).</summary>
    private readonly string[] _roots;
    private readonly Dictionary<string, string> _rootNames; // realPath -> display name

    public FileBrowser(IEnumerable<string> roots)
    {
        var list = new List<string>();
        var names = new Dictionary<string, string>();
        foreach (var raw in roots)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var real = TryRealPath(raw);
            if (real is null || !Directory.Exists(real)) continue;
            if (!list.Contains(real))
            {
                list.Add(real);
                names[real] = Path.GetFileName(real.TrimEnd(Path.DirectorySeparatorChar)) is { Length: > 0 } n
                    ? n
                    : real;
            }
        }
        _roots = list.ToArray();
        _rootNames = names;
    }

    public FsRoot[] Roots() =>
        _roots.Select(r => new FsRoot(_rootNames[r], r)).ToArray();

    public bool HasRoots => _roots.Length > 0;

    /// <summary>
    /// Resolve a client-supplied path to a real path that is guaranteed to be
    /// under an allowed root. Returns null if the path escapes the jail,
    /// does not exist, or cannot be canonicalized.
    /// </summary>
    public string? Resolve(string? requested)
    {
        if (string.IsNullOrWhiteSpace(requested)) return null;
        var real = TryRealPath(requested);
        if (real is null) return null;
        foreach (var root in _roots)
        {
            if (IsUnder(real, root)) return real;
        }
        return null;
    }

    /// <summary>List sub-folders and MIDI files directly under <paramref name="requested"/>.</summary>
    public FsListResponse? List(string? requested)
    {
        var real = Resolve(requested);
        if (real is null || !Directory.Exists(real)) return null;

        var entries = new List<FsEntry>();
        try
        {
            foreach (var dir in Directory.EnumerateDirectories(real))
            {
                var name = Path.GetFileName(dir);
                if (name.StartsWith('.')) continue; // hide dotfolders
                entries.Add(new FsEntry(name, dir, "dir", 0));
            }
            foreach (var file in Directory.EnumerateFiles(real))
            {
                if (!IsMidi(file)) continue;
                long size = 0;
                try { size = new FileInfo(file).Length; } catch { /* ignore */ }
                entries.Add(new FsEntry(Path.GetFileName(file), file, "file", size));
            }
        }
        catch (UnauthorizedAccessException) { return null; }
        catch (IOException) { return null; }

        entries.Sort(static (a, b) =>
            a.Type != b.Type
                ? string.CompareOrdinal(a.Type, b.Type) // "dir" < "file"
                : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));

        // Parent, only if it is still inside the jail.
        string? parent = null;
        var up = Path.GetDirectoryName(real.TrimEnd(Path.DirectorySeparatorChar));
        if (up is not null && Resolve(up) is { } okParent) parent = okParent;

        return new FsListResponse(real, parent, entries.ToArray());
    }

    /// <summary>Recursively find MIDI files under <paramref name="requested"/> (capped).</summary>
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
                results.Add(new ScanEntry(
                    Path.GetFileNameWithoutExtension(file), file, folder, size));
                if (results.Count >= max) break;
            }
        }
        catch (IOException) { /* return what we have */ }

        return results.ToArray();
    }

    /// <summary>Validate a path for streaming: must be a MIDI file under the jail.</summary>
    public string? ResolveMidiFile(string? requested)
    {
        var real = Resolve(requested);
        if (real is null || !File.Exists(real) || !IsMidi(real)) return null;
        return real;
    }

    private static bool IsMidi(string path) =>
        MidiExtensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);

    /// <summary>True if <paramref name="candidate"/> is <paramref name="root"/> or strictly inside it.</summary>
    private static bool IsUnder(string candidate, string root)
    {
        if (string.Equals(candidate, root, PathComparison)) return true;
        var prefix = root.EndsWith(Path.DirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;
        return candidate.StartsWith(prefix, PathComparison);
    }

    /// <summary>
    /// Canonicalize: expand to a full path and follow symlinks so a link
    /// inside a root cannot point outside it.
    /// </summary>
    private static string? TryRealPath(string path)
    {
        try
        {
            var full = Path.GetFullPath(path);
            // Follow a symlink on the leaf if present.
            var info = Directory.Exists(full)
                ? (FileSystemInfo)new DirectoryInfo(full)
                : new FileInfo(full);
            var target = info.ResolveLinkTarget(returnFinalTarget: true);
            var resolved = target?.FullName ?? full;
            return resolved.TrimEnd(Path.DirectorySeparatorChar) is { Length: 0 }
                ? resolved // root like "/"
                : resolved.TrimEnd(Path.DirectorySeparatorChar);
        }
        catch
        {
            return null;
        }
    }

    // NAS is Linux (case-sensitive); dev may be Windows. Compare accordingly.
    private static readonly StringComparison PathComparison =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
}
