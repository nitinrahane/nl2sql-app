using Nl2Sql.Core.Enums;

namespace Nl2Sql.Core.Models;

public class AiQueryRequest
{
    public string NaturalLanguageQuery { get; set; } = string.Empty;
    public int DatabaseConfigId { get; set; }
}

public class AiQueryResponse
{
    public string SqlQuery { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public VisualizationRecommendation Visualization { get; set; } = new();
}
