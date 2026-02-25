using System.Diagnostics;
using Dapper;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Infrastructure.Services;

public class QueryExecutionService : IQueryExecutionService
{
    private readonly IDatabaseConnectionFactory _connectionFactory;
    private const int DefaultTimeoutSeconds = 30;
    private const int MaxRowCount = 10000;

    public QueryExecutionService(IDatabaseConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<QueryResult> ExecuteQueryAsync(string query, DatabaseConfig config)
    {
        using var connection = _connectionFactory.CreateConnection(config.Type, config.ConnectionString);
        
        var stopwatch = Stopwatch.StartNew();
        
        var data = await connection.QueryAsync<dynamic>(query, commandTimeout: DefaultTimeoutSeconds);
        
        stopwatch.Stop();

        var dataList = data.Take(MaxRowCount).ToList();
        var columns = new List<string>();

        if (dataList.Any())
        {
            var firstRow = (IDictionary<string, object>)dataList.First();
            columns = firstRow.Keys.ToList();
        }

        var totalCount = data.Count();
        var isTruncated = totalCount > MaxRowCount;

        return new QueryResult
        {
            Data = dataList,
            RowCount = dataList.Count,
            ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
            Columns = columns,
            TotalRowCount = totalCount,
            IsTruncated = isTruncated
        };
    }
}
