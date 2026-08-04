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
}

/// <summary>Generic error body.</summary>
public sealed record ErrorResponse(string Error);
