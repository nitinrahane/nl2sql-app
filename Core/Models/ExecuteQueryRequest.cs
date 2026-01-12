namespace Nl2Sql.Core.Models;

public class ExecuteQueryRequest
{
    public string SqlQuery { get; set; } = string.Empty;
    public int DatabaseConfigId { get; set; }
}
