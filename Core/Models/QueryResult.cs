namespace Nl2Sql.Core.Models;

public class QueryResult
{
    public IEnumerable<dynamic> Data { get; set; } = new List<dynamic>();
    public int RowCount { get; set; }
    public long ExecutionTimeMs { get; set; }
    public List<string> Columns { get; set; } = new();
}
