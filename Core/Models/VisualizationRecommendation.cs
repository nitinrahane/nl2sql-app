using System.Text.Json;
using System.Text.Json.Serialization;

namespace Nl2Sql.Core.Models;

public class VisualizationRecommendation
{
    public string ChartType { get; set; } = "Table";
    public string XAxisColumn { get; set; } = string.Empty;

    [JsonConverter(typeof(YAxisColumnConverter))]
    public List<string> YAxisColumns { get; set; } = new();

    public string Title { get; set; } = string.Empty;
}

public class YAxisColumnConverter : JsonConverter<List<string>>
{
    public override List<string> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            var value = reader.GetString();
            return string.IsNullOrEmpty(value) ? new List<string>() : new List<string> { value };
        }

        if (reader.TokenType == JsonTokenType.StartArray)
        {
            var list = new List<string>();
            while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
            {
                if (reader.TokenType == JsonTokenType.String)
                    list.Add(reader.GetString() ?? string.Empty);
            }
            return list;
        }

        return new List<string>();
    }

    public override void Write(Utf8JsonWriter writer, List<string> value, JsonSerializerOptions options)
    {
        if (value.Count == 1)
        {
            writer.WriteStringValue(value[0]);
        }
        else
        {
            writer.WriteStartArray();
            foreach (var item in value)
                writer.WriteStringValue(item);
            writer.WriteEndArray();
        }
    }
}
