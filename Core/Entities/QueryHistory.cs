using System;

namespace Nl2Sql.Core.Entities;

public class QueryHistory
{
    public int Id { get; set; }
    public string NaturalLanguageQuery { get; set; } = string.Empty;
    public string SqlQuery { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public string ChartType { get; set; } = string.Empty;
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
    public int DatabaseConfigId { get; set; }
    public bool IsSuccessful { get; set; }
    public string? ErrorMessage { get; set; }
}
