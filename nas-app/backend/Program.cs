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
// Data dir (writable): where settings.json lives. On UGOS the process working
// directory IS the app's data dir (/volume{n}/@appdata/{app_id}); use it.
var dataDir = Environment.GetEnvironmentVariable("MIDI_DATA_DIR")
              ?? Directory.GetCurrentDirectory();
Directory.CreateDirectory(dataDir);

// Allowed root folders (the jail). Semicolon-separated. On a NAS these are the
// shared folders / network mounts the admin exposes. Dev falls back to data/music.
var rootsRaw = Environment.GetEnvironmentVariable("MIDI_ROOTS");
var roots = string.IsNullOrWhiteSpace(rootsRaw)
    ? new[] { Path.Combine(dataDir, "music") }
    : rootsRaw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
foreach (var r in roots)
{
    try { Directory.CreateDirectory(r); } catch { /* mount may be read-only */ }
}

// Port precedence: --port=NNNN arg (UGOS start_cmd) → MIDI_PORT env → 29090.
var portArg = args.FirstOrDefault(a => a.StartsWith("--port=", StringComparison.Ordinal))
    ?.Substring("--port=".Length);
var port = portArg ?? Environment.GetEnvironmentVariable("MIDI_PORT") ?? "29090";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

var settings = new SettingsStore(dataDir);
// Jail roots = admin-configured MIDI_ROOTS ∪ folders the owner added in Settings.
var browser = new FileBrowser(() => roots.Concat(settings.Get().ScanFolders));
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

api.MapGet("/fs/roots", () => TypedResults.Ok(browser.Roots()));

api.MapGet("/fs/list", Results<Ok<FsListResponse>, NotFound<ErrorResponse>> (string? path) =>
{
    // No path → the first root (or nothing configured).
    var target = string.IsNullOrWhiteSpace(path)
        ? browser.Roots().FirstOrDefault()?.Path
        : path;
    var result = browser.List(target);
    return result is null
        ? TypedResults.NotFound(new ErrorResponse("path not allowed or not found"))
        : TypedResults.Ok(result);
});

// Directory-only picker to choose new root folders (empty path → top-level).
api.MapGet("/fs/explore", Results<Ok<FsListResponse>, NotFound<ErrorResponse>> (string? path) =>
{
    var result = browser.Explore(path);
    return result is null
        ? TypedResults.NotFound(new ErrorResponse("path not found"))
        : TypedResults.Ok(result);
});

api.MapGet("/fs/scan", Results<Ok<ScanEntry[]>, NotFound<ErrorResponse>> (string? path) =>
{
    var result = browser.Scan(path);
    return result is null
        ? TypedResults.NotFound(new ErrorResponse("path not allowed or not found"))
        : TypedResults.Ok(result);
});

// Stream a MIDI file (validated to live under a root, byte-range enabled).
api.MapGet("/stream", (string? path) =>
{
    var real = browser.ResolveMidiFile(path);
    if (real is null)
        return Results.NotFound(new ErrorResponse("file not allowed or not found"));
    var stream = File.OpenRead(real);
    return Results.Stream(stream, "audio/midi", enableRangeProcessing: true);
});

// Settings
api.MapGet("/settings", () => TypedResults.Ok(settings.Get()));
api.MapPut("/settings", (AppSettings incoming) =>
{
    // Scan folders become jail roots, so keep only real, existing directories.
    incoming.ScanFolders = incoming.ScanFolders
        .Select(f => browser.CanonicalDir(f))
        .Where(f => f is not null)
        .Select(f => f!)
        .Distinct()
        .ToList();
    return TypedResults.Ok(settings.Save(incoming));
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
