namespace Nl2Sql.Core.Models;

public class QueryResult
{
    public IEnumerable<dynamic> Data { get; set; } = Enumerable.Empty<dynamic>();
    public int RowCount { get; set; }
    public long ExecutionTimeMs { get; set; }
    public List<string> Columns { get; set; } = new();
    public int TotalRowCount { get; set; }
    public bool IsTruncated { get; set; }
}
