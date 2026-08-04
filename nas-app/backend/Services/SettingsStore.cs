using System.Text.Json;
using MidiAniPlayer.Models;

namespace MidiAniPlayer.Services;

/// <summary>
/// Loads and persists <see cref="AppSettings"/> as a JSON file in the writable
/// data directory. Thread-safe for the small read/write volume this app sees.
/// </summary>
public sealed class SettingsStore
{
    private readonly string _path;
    private readonly Lock _gate = new();
    private AppSettings _cache;

    public SettingsStore(string dataDir)
    {
        Directory.CreateDirectory(dataDir);
        _path = Path.Combine(dataDir, "settings.json");
        _cache = Load();
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
            // Atomic-ish write: temp file then move.
            var tmp = _path + ".tmp";
            File.WriteAllText(tmp, json);
            File.Move(tmp, _path, overwrite: true);
            return Clone(_cache);
        }
    }

    private AppSettings Load()
    {
        try
        {
            if (File.Exists(_path))
            {
                var json = File.ReadAllText(_path);
                var parsed = JsonSerializer.Deserialize(json, AppJsonContext.Default.AppSettings);
                if (parsed is not null) return parsed;
            }
        }
        catch
        {
            // Corrupt/unreadable settings fall back to defaults rather than crash.
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
