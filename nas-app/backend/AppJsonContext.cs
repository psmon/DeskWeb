using System.Text.Json.Serialization;
using MidiAniPlayer.Models;

namespace MidiAniPlayer;

/// <summary>
/// System.Text.Json source-generation context. Required for Native AOT —
/// every type that crosses the JSON boundary must be registered here so the
/// serializer never falls back to reflection.
/// </summary>
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(HealthResponse))]
[JsonSerializable(typeof(FsRoot[]))]
[JsonSerializable(typeof(FsListResponse))]
[JsonSerializable(typeof(ScanEntry[]))]
[JsonSerializable(typeof(TrackPage))]
[JsonSerializable(typeof(TrackDto[]))]
[JsonSerializable(typeof(List<BitmidiSeed>))]
[JsonSerializable(typeof(AppSettings))]
[JsonSerializable(typeof(SmbShare))]
[JsonSerializable(typeof(SmbTestResult))]
[JsonSerializable(typeof(ErrorResponse))]
public partial class AppJsonContext : JsonSerializerContext
{
}
