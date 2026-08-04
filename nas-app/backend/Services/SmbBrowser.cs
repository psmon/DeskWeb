using System.Net;
using System.Net.Sockets;
using MidiAniPlayer.Models;
using SMBLibrary;
using SMBLibrary.Client;
using FileAttributes = SMBLibrary.FileAttributes;

namespace MidiAniPlayer.Services;

/// <summary>
/// Browses and reads MIDI files from SMB/CIFS shares directly in userspace
/// (SMBLibrary), so the app itself can add a NAS share in Settings without any
/// OS-level mount, docker CIFS volume, or elevated privileges.
///
/// Virtual paths use the scheme  smb://{shareName}/{relative/path}.
/// A share's optional base Path is prepended to the relative path.
/// MIDI files are small, so reads pull the whole file into memory.
/// </summary>
public sealed class SmbBrowser
{
    private static readonly string[] MidiExtensions = { ".mid", ".midi" };

    private readonly Func<IEnumerable<SmbShare>> _shares;

    public SmbBrowser(Func<IEnumerable<SmbShare>> shares) => _shares = shares;

    public static bool IsSmb(string? path) =>
        path is not null && path.StartsWith("smb://", StringComparison.Ordinal);

    public FsRoot[] Roots() =>
        _shares()
            .Where(s => !string.IsNullOrWhiteSpace(s.Name))
            .Select(s => new FsRoot(s.Name, $"smb://{s.Name}/"))
            .ToArray();

    public FsListResponse? List(string smbPath)
    {
        var (share, rel) = Parse(smbPath);
        if (share is null) return null;
        var entries = WithStore(share, store => ListDir(store, share, rel));
        if (entries is null) return null;
        string? parent = string.IsNullOrEmpty(rel) ? null : $"smb://{share.Name}/{ParentRel(rel)}";
        return new FsListResponse(smbPath, parent, entries);
    }

    public ScanEntry[]? Scan(string smbPath, int max = 5000)
    {
        var (share, rel) = Parse(smbPath);
        if (share is null) return null;
        return WithStore(share, store =>
        {
            var acc = new List<ScanEntry>();
            ScanDir(store, share, rel, acc, max);
            return acc.ToArray();
        });
    }

    /// <summary>Read a MIDI file fully into memory. Returns null if not allowed/found.</summary>
    public byte[]? ReadFile(string smbPath)
    {
        var (share, rel) = Parse(smbPath);
        if (share is null) return null;
        if (!IsMidi(rel)) return null;
        return WithStore(share, store => ReadAll(store, ToSmb(share, rel)));
    }

    /// <summary>Try to connect + tree-connect a share (for the Settings "test" button).</summary>
    public bool TestConnection(SmbShare share) =>
        WithStore(share, _ => (object)true) is not null;

    // ---- SMBLibrary plumbing ------------------------------------------------

    private T? WithStore<T>(SmbShare share, Func<ISMBFileStore, T?> fn) where T : class
    {
        var client = new SMB2Client();
        var connected = false;
        try
        {
            var ip = ResolveHost(share.Host);
            if (ip is null || !client.Connect(ip, SMBTransportType.DirectTCPTransport)) return null;
            connected = true;
            var status = client.Login(share.Domain ?? "", share.Username ?? "", share.Password ?? "");
            if (status != NTStatus.STATUS_SUCCESS) return null;
            var store = client.TreeConnect(share.Share, out status);
            if (status != NTStatus.STATUS_SUCCESS || store is null) return null;
            try { return fn(store); }
            finally { try { store.Disconnect(); } catch { /* ignore */ } }
        }
        catch
        {
            return null;
        }
        finally
        {
            if (connected) { try { client.Logoff(); } catch { } try { client.Disconnect(); } catch { } }
        }
    }

    private FsEntry[]? ListDir(ISMBFileStore store, SmbShare share, string rel)
    {
        var smbDir = ToSmb(share, rel);
        var status = store.CreateFile(out var handle, out _, smbDir,
            AccessMask.GENERIC_READ, FileAttributes.Directory,
            ShareAccess.Read | ShareAccess.Write,
            CreateDisposition.FILE_OPEN, CreateOptions.FILE_DIRECTORY_FILE, null);
        if (status != NTStatus.STATUS_SUCCESS) return null;

        var entries = new List<FsEntry>();
        try
        {
            store.QueryDirectory(out List<QueryDirectoryFileInformation> list, handle, "*",
                FileInformationClass.FileDirectoryInformation);
            foreach (var item in list)
            {
                var info = (FileDirectoryInformation)item;
                var nm = info.FileName;
                if (nm is "." or ".." || nm.StartsWith('.')) continue;
                var childRel = string.IsNullOrEmpty(rel) ? nm : rel + "/" + nm;
                var vpath = $"smb://{share.Name}/{childRel}";
                if ((info.FileAttributes & FileAttributes.Directory) != 0)
                    entries.Add(new FsEntry(nm, vpath, "dir", 0));
                else if (IsMidi(nm))
                    entries.Add(new FsEntry(nm, vpath, "file", info.EndOfFile));
            }
        }
        finally { try { store.CloseFile(handle); } catch { } }

        entries.Sort(static (a, b) =>
            a.Type != b.Type
                ? string.CompareOrdinal(a.Type, b.Type)
                : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
        return entries.ToArray();
    }

    private void ScanDir(ISMBFileStore store, SmbShare share, string rel, List<ScanEntry> acc, int max)
    {
        if (acc.Count >= max) return;
        var smbDir = ToSmb(share, rel);
        var status = store.CreateFile(out var handle, out _, smbDir,
            AccessMask.GENERIC_READ, FileAttributes.Directory,
            ShareAccess.Read | ShareAccess.Write,
            CreateDisposition.FILE_OPEN, CreateOptions.FILE_DIRECTORY_FILE, null);
        if (status != NTStatus.STATUS_SUCCESS) return;

        var subdirs = new List<string>();
        try
        {
            store.QueryDirectory(out List<QueryDirectoryFileInformation> list, handle, "*",
                FileInformationClass.FileDirectoryInformation);
            foreach (var item in list)
            {
                var info = (FileDirectoryInformation)item;
                var nm = info.FileName;
                if (nm is "." or ".." || nm.StartsWith('.')) continue;
                var childRel = string.IsNullOrEmpty(rel) ? nm : rel + "/" + nm;
                if ((info.FileAttributes & FileAttributes.Directory) != 0)
                    subdirs.Add(childRel);
                else if (IsMidi(nm))
                {
                    var folder = rel.Length == 0 ? share.Name : rel.Split('/')[^1];
                    acc.Add(new ScanEntry(StripExt(nm), $"smb://{share.Name}/{childRel}", folder, info.EndOfFile));
                    if (acc.Count >= max) break;
                }
            }
        }
        finally { try { store.CloseFile(handle); } catch { } }

        foreach (var d in subdirs)
        {
            if (acc.Count >= max) break;
            ScanDir(store, share, d, acc, max);
        }
    }

    private static byte[]? ReadAll(ISMBFileStore store, string smbFile)
    {
        var status = store.CreateFile(out var handle, out _, smbFile,
            AccessMask.GENERIC_READ, FileAttributes.Normal,
            ShareAccess.Read, CreateDisposition.FILE_OPEN,
            CreateOptions.FILE_NON_DIRECTORY_FILE, null);
        if (status != NTStatus.STATUS_SUCCESS) return null;
        using var ms = new MemoryStream();
        try
        {
            long offset = 0;
            const int chunk = 1 << 16; // 64 KiB
            while (true)
            {
                status = store.ReadFile(out var data, handle, offset, chunk);
                if (status == NTStatus.STATUS_END_OF_FILE || data is null || data.Length == 0) break;
                ms.Write(data, 0, data.Length);
                offset += data.Length;
                if (status != NTStatus.STATUS_SUCCESS) break;
                if (ms.Length > 32 * 1024 * 1024) break; // sanity cap 32 MB
            }
        }
        finally { try { store.CloseFile(handle); } catch { } }
        return ms.ToArray();
    }

    // ---- helpers ------------------------------------------------------------

    private (SmbShare? share, string rel) Parse(string smbPath)
    {
        var rest = smbPath["smb://".Length..];
        var slash = rest.IndexOf('/');
        var name = slash < 0 ? rest : rest[..slash];
        var rel = slash < 0 ? "" : rest[(slash + 1)..];
        var share = _shares().FirstOrDefault(s => s.Name == name);
        return (share, rel.Trim('/'));
    }

    /// <summary>Combine the share's base Path with the relative path → SMB (backslash) path.</summary>
    private static string ToSmb(SmbShare share, string rel)
    {
        var basePath = (share.Path ?? "").Trim('/');
        var full = (basePath, rel) switch
        {
            ("", var r) => r,
            (var b, "") => b,
            (var b, var r) => b + "/" + r,
        };
        return full.Replace('/', '\\');
    }

    private static string ParentRel(string rel)
    {
        var i = rel.TrimEnd('/').LastIndexOf('/');
        return i < 0 ? "" : rel[..i];
    }

    private static IPAddress? ResolveHost(string host)
    {
        if (IPAddress.TryParse(host, out var ip)) return ip;
        try
        {
            var addrs = Dns.GetHostAddresses(host);
            return addrs.FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetwork)
                   ?? addrs.FirstOrDefault();
        }
        catch { return null; }
    }

    private static bool IsMidi(string name) =>
        MidiExtensions.Contains(Path.GetExtension(name), StringComparer.OrdinalIgnoreCase);

    private static string StripExt(string name) => Path.GetFileNameWithoutExtension(name);
}
