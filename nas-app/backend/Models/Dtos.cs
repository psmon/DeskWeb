namespace MidiAniPlayer.Models;

/// <summary>Health/status payload.</summary>
public sealed record HealthResponse(string Status, string Version, string[] Roots);

/// <summary>A browsable base folder (NAS shared folder / network mount).</summary>
public sealed record FsRoot(string Name, string Path);

/// <summary>A single directory entry: a sub-folder or a .mid/.midi file.</summary>
public sealed record FsEntry(string Name, string Path, string Type, long Size);

/// <summary>Result of listing a directory.</summary>
public sealed record FsListResponse(string Path, string? Parent, FsEntry[] Entries);

/// <summary>A MIDI file discovered by a recursive scan.</summary>
public sealed record ScanEntry(string Title, string Path, string Folder, long Size);

/// <summary>A playlist track row from the embedded DB (bitmidi or local scan).</summary>
/// <param name="Source">"bitmidi" | "local".</param>
/// <param name="Ref">Playback reference: a bitmidi.com url OR a local file path.</param>
public sealed record TrackDto(long Id, string Source, string Title, string? Genre, string Ref, string? Folder);

/// <summary>A page of tracks plus the total matching the query (for paging UI).</summary>
public sealed record TrackPage(int Total, int Page, int PageSize, TrackDto[] Items);

/// <summary>One entry in the bundled bitmidi seed file (frontend/public/bitmidi.json).</summary>
public sealed record BitmidiSeed(string Title, string Genre, string Url);

/// <summary>Persisted application settings (stored as JSON in the data dir).</summary>
public sealed class AppSettings
{
    /// <summary>Folders the user chose to scan for MIDI files.</summary>
    public List<string> ScanFolders { get; set; } = new();

    /// <summary>"real" (SpessaSynth) | "simple" (html-midi-player).</summary>
    public string DefaultEngine { get; set; } = "real";

    /// <summary>0.0 – 1.0.</summary>
    public double Volume { get; set; } = 0.9;

    /// <summary>Absolute path of the last played local file, if any.</summary>
    public string? LastSongPath { get; set; }

    /// <summary>Whether BitMidi online search is enabled.</summary>
    public bool BitmidiEnabled { get; set; } = true;

    /// <summary>SMB/CIFS shares the app connects to directly (userspace).</summary>
    public List<SmbShare> SmbShares { get; set; } = new();
}

/// <summary>An SMB share the app browses directly via SMBLibrary (no OS mount).</summary>
public sealed class SmbShare
{
    /// <summary>Unique display id (used in smb://{Name}/… paths, no slashes).</summary>
    public string Name { get; set; } = "";
    public string Host { get; set; } = "";     // 192.168.0.3 or hostname
    public string Share { get; set; } = "";    // e.g. DataA-MEDIA
    public string Path { get; set; } = "";     // optional subfolder within the share
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string Domain { get; set; } = "";
}

/// <summary>Result of an SMB connection test.</summary>
public sealed record SmbTestResult(bool Ok);

/// <summary>Generic error body.</summary>
public sealed record ErrorResponse(string Error);
