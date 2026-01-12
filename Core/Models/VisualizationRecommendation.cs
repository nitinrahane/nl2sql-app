namespace Nl2Sql.Core.Models;

public class VisualizationRecommendation
{
    public string ChartType { get; set; } = "Table"; // Bar, Line, Pie, Table
    public string XAxisColumn { get; set; } = string.Empty;
    public object YAxisColumn { get; set; } = new();
    public string Title { get; set; } = string.Empty;
}
