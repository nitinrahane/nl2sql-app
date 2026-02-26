namespace Nl2Sql.Core.Models;

public class AgentRequest
{
    public string Question { get; set; } = string.Empty;
    public int DatabaseConfigId { get; set; }
}

public class AgentResponse
{
    public bool Success { get; set; }
    public string Explanation { get; set; } = string.Empty;
    public string? SqlQuery { get; set; }
    public QueryResult? Results { get; set; }
    public VisualizationRecommendation? Visualization { get; set; }
    public List<string> Insights { get; set; } = new();
    public List<string> Assumptions { get; set; } = new();
    public List<string> Limitations { get; set; } = new();
    public List<string> SafetyChecks { get; set; } = new();
    public List<AgentStep> Steps { get; set; } = new();
    public AgentMetadata Metadata { get; set; } = new();
    public string? Error { get; set; }
}

public class AgentStep
{
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Detail { get; set; }
    public bool Success { get; set; } = true;
    public long? DurationMs { get; set; }
}

public class AgentMetadata
{
    public int SqlAttempts { get; set; }
    public int TablesDiscovered { get; set; }
    public long TotalDurationMs { get; set; }
    public int ToolCallCount { get; set; }
}
