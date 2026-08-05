using System.Net;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using MidiAniPlayer;
using MidiAniPlayer.Models;
using MidiAniPlayer.Services;

var builder = WebApplication.CreateSlimBuilder(args);

// AOT: serialize only through the source-generated context.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

// ---- Configuration ------------------------------------------------------
// Data dir (writable). UGOS sets UGAPP_DATA_DIR and makes it the working dir.
var dataDir = Environment.GetEnvironmentVariable("UGAPP_DATA_DIR")
              ?? Environment.GetEnvironmentVariable("MIDI_DATA_DIR")
              ?? Directory.GetCurrentDirectory();
Directory.CreateDirectory(dataDir);

// Access roots resolution (the browsable/jail boundary):
//   - MIDI_ROOTS set (Docker mounts / dev)      → use it.
//   - else on UGOS ($UGAPP_SHARED_DIR present)   → none here; SharedRoots() below
//       provides the user-authorized folders (never the app's own data dir).
//   - else bare standalone                        → data/music fallback.
var rootsRaw = Environment.GetEnvironmentVariable("MIDI_ROOTS");
var onUgos = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("UGAPP_SHARED_DIR"));
var roots = !string.IsNullOrWhiteSpace(rootsRaw)
    ? rootsRaw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    : onUgos
        ? Array.Empty<string>()
        : new[] { Path.Combine(dataDir, "music") };
foreach (var r in roots)
{
    try { Directory.CreateDirectory(r); } catch { /* mount may be read-only */ }
}

// On UGOS, folders the user authorizes (allow_add_access_path) are symlinked
// under $UGAPP_SHARED_DIR — each becomes a browsable root automatically.
string[] SharedRoots()
{
    var shared = Environment.GetEnvironmentVariable("UGAPP_SHARED_DIR");
    if (string.IsNullOrWhiteSpace(shared) || !Directory.Exists(shared))
        return Array.Empty<string>();
    try { return Directory.GetDirectories(shared); }
    catch { return Array.Empty<string>(); }
}

// Port precedence: --port=NNNN arg (UGOS start_cmd) → MIDI_PORT env → 29090.
var portArg = args.FirstOrDefault(a => a.StartsWith("--port=", StringComparison.Ordinal))
    ?.Substring("--port=".Length);
var port = portArg ?? Environment.GetEnvironmentVariable("MIDI_PORT") ?? "29090";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

var settings = new SettingsStore(dataDir);
// Base roots = the actual access grants: UGOS-authorized shared folders ($UGAPP_SHARED_DIR)
// ∪ MIDI_ROOTS (Docker mounts). These define the security boundary — nothing outside
// them is ever browsable. The folder picker and scan-folder validation use ONLY these.
Func<IEnumerable<string>> baseRootsFn = () => SharedRoots().Concat(roots);
var baseBrowser = new FileBrowser(baseRootsFn);
// Full jail also includes the user's picked scan folders (each validated to be under a
// base root on save, so they never widen access — just remembered browse locations).
var browser = new FileBrowser(() => baseRootsFn().Concat(settings.Get().ScanFolders));
// SMB shares the owner added in Settings (browsed directly, no OS mount).
var smb = new SmbBrowser(() => settings.Get().SmbShares);
var version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0";

// ---- Static UI (www/) ---------------------------------------------------
var wwwRoot = ResolveWwwRoot();
if (Directory.Exists(wwwRoot))
{
    var provider = new PhysicalFileProvider(wwwRoot);
    var contentTypes = new FileExtensionContentTypeProvider();
    contentTypes.Mappings[".sf3"] = "application/octet-stream";
    contentTypes.Mappings[".sf2"] = "application/octet-stream";
    contentTypes.Mappings[".mid"] = "audio/midi";
    contentTypes.Mappings[".midi"] = "audio/midi";
    contentTypes.Mappings[".wasm"] = "application/wasm";

    var staticOpts = new StaticFileOptions
    {
        FileProvider = provider,
        ContentTypeProvider = contentTypes,
    };
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
    app.UseStaticFiles(staticOpts);
    // SPA fallback for client-side routes.
    app.MapFallbackToFile("index.html", staticOpts);
}

// ---- API ----------------------------------------------------------------
var api = app.MapGroup("/api");

api.MapGet("/health", () =>
    TypedResults.Ok(new HealthResponse("ok", version, browser.Roots().Select(r => r.Path).ToArray())));

api.MapGet("/fs/roots", () =>
    TypedResults.Ok(browser.Roots().Concat(smb.Roots()).ToArray()));

api.MapGet("/fs/list", Results<Ok<FsListResponse>, NotFound<ErrorResponse>> (string? path) =>
{
    if (SmbBrowser.IsSmb(path))
    {
        var smbResult = smb.List(path!);
        return smbResult is null
            ? TypedResults.NotFound(new ErrorResponse("smb path not found"))
            : TypedResults.Ok(smbResult);
    }
    // No path → the first local root (or nothing configured).
    var target = string.IsNullOrWhiteSpace(path)
        ? browser.Roots().FirstOrDefault()?.Path
        : path;
    var result = browser.List(target);
    return result is null
        ? TypedResults.NotFound(new ErrorResponse("path not allowed or not found"))
        : TypedResults.Ok(result);
});

// Directory-only picker — JAILED to base roots (mounts / UGOS-authorized folders).
// Empty path → the roots themselves; never the filesystem root or anything above.
api.MapGet("/fs/explore", Results<Ok<FsListResponse>, NotFound<ErrorResponse>> (string? path) =>
{
    var result = baseBrowser.Explore(path);
    return result is null
        ? TypedResults.NotFound(new ErrorResponse("path not allowed or not found"))
        : TypedResults.Ok(result);
});

api.MapGet("/fs/scan", Results<Ok<ScanEntry[]>, NotFound<ErrorResponse>> (string? path) =>
{
    var result = SmbBrowser.IsSmb(path) ? smb.Scan(path!) : browser.Scan(path);
    return result is null
        ? TypedResults.NotFound(new ErrorResponse("path not allowed or not found"))
        : TypedResults.Ok(result);
});

// Stream a MIDI file. SMB files are read into memory; local files stream.
api.MapGet("/stream", (string? path) =>
{
    if (SmbBrowser.IsSmb(path))
    {
        var bytes = smb.ReadFile(path!);
        return bytes is null
            ? Results.NotFound(new ErrorResponse("smb file not allowed or not found"))
            : Results.Bytes(bytes, "audio/midi");
    }
    var real = browser.ResolveMidiFile(path);
    if (real is null)
        return Results.NotFound(new ErrorResponse("file not allowed or not found"));
    var stream = File.OpenRead(real);
    return Results.Stream(stream, "audio/midi", enableRangeProcessing: true);
});

// Settings. Passwords are never sent to the client; a blank incoming password
// means "keep the stored one".
api.MapGet("/settings", () =>
{
    var s = settings.Get();
    foreach (var sh in s.SmbShares) sh.Password = "";
    return TypedResults.Ok(s);
});
api.MapPut("/settings", (AppSettings incoming) =>
{
    // Scan folders must resolve UNDER a base root — they can never widen access
    // to an arbitrary path (defense in depth against a crafted settings PUT).
    incoming.ScanFolders = incoming.ScanFolders
        .Select(f => baseBrowser.Resolve(f))
        .Where(f => f is not null)
        .Select(f => f!)
        .Distinct()
        .ToList();
    // Preserve stored SMB passwords when the client sends a blank one.
    var existing = settings.Get().SmbShares;
    foreach (var sh in incoming.SmbShares)
    {
        if (string.IsNullOrEmpty(sh.Password))
            sh.Password = existing.FirstOrDefault(e => e.Name == sh.Name)?.Password ?? "";
    }
    var saved = settings.Save(incoming);
    foreach (var sh in saved.SmbShares) sh.Password = "";
    return TypedResults.Ok(saved);
});

// Test an SMB connection (Settings "test" button). Password may be blank to
// reuse a stored one for an existing share name.
api.MapPost("/smb/test", (SmbShare share) =>
{
    if (string.IsNullOrEmpty(share.Password))
        share.Password = settings.Get().SmbShares.FirstOrDefault(e => e.Name == share.Name)?.Password ?? "";
    return TypedResults.Ok(new SmbTestResult(smb.TestConnection(share)));
});

// ---- BitMidi proxy (avoids browser CORS; still needs NAS internet) -------
var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
http.DefaultRequestHeaders.Add("User-Agent", "midi-ani-player");

api.MapGet("/bitmidi/search", async (string? q) =>
{
    if (string.IsNullOrWhiteSpace(q))
        return Results.BadRequest(new ErrorResponse("q required"));
    var url = $"https://bitmidi.com/api/midi/search?q={Uri.EscapeDataString(q)}&page=0";
    try
    {
        var body = await http.GetStringAsync(url);
        return Results.Content(body, "application/json");
    }
    catch (HttpRequestException)
    {
        return Results.StatusCode((int)HttpStatusCode.BadGateway);
    }
    catch (TaskCanceledException)
    {
        return Results.StatusCode((int)HttpStatusCode.GatewayTimeout);
    }
});

// Proxy a bitmidi .mid (whitelisted host only) to sidestep CORS on playback.
api.MapGet("/bitmidi/file", async (string? url) =>
{
    if (string.IsNullOrWhiteSpace(url)
        || !Uri.TryCreate(url, UriKind.Absolute, out var uri)
        || uri.Host != "bitmidi.com")
        return Results.BadRequest(new ErrorResponse("only bitmidi.com urls allowed"));
    try
    {
        var upstream = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
        if (!upstream.IsSuccessStatusCode)
            return Results.StatusCode((int)HttpStatusCode.BadGateway);
        var stream = await upstream.Content.ReadAsStreamAsync();
        return Results.Stream(stream, "audio/midi");
    }
    catch (HttpRequestException)
    {
        return Results.StatusCode((int)HttpStatusCode.BadGateway);
    }
});

app.Run();

// ---- helpers ------------------------------------------------------------
static string ResolveWwwRoot()
{
    // 1) explicit override
    var env = Environment.GetEnvironmentVariable("MIDI_WWW");
    if (!string.IsNullOrWhiteSpace(env)) return env;

    var baseDir = AppContext.BaseDirectory;
    // 2) UGOS layout: binary in bin/, www a sibling → <app>/www
    var sibling = Path.GetFullPath(Path.Combine(baseDir, "..", "www"));
    if (Directory.Exists(sibling)) return sibling;
    // 3) www next to the binary
    var local = Path.Combine(baseDir, "www");
    if (Directory.Exists(local)) return local;
    return sibling; // reported as "not found" if it also doesn't exist
}

public partial class Program { }
