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

    public QueryExecutionService(IDatabaseConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<QueryResult> ExecuteQueryAsync(string query, DatabaseConfig config)
    {
        using var connection = _connectionFactory.CreateConnection(config.Type, config.ConnectionString);
        
        var stopwatch = Stopwatch.StartNew();
        
        // Use Dapper to execute the query and map to dynamic
        var data = await connection.QueryAsync<dynamic>(query, commandTimeout: DefaultTimeoutSeconds);
        
        stopwatch.Stop();

        var dataList = data.ToList();
        var columns = new List<string>();

        if (dataList.Any())
        {
            // Extract column names from the first row (which is an IDictionary<string, object>)
            var firstRow = (IDictionary<string, object>)dataList.First();
            columns = firstRow.Keys.ToList();
        }

        return new QueryResult
        {
            Data = dataList,
            RowCount = dataList.Count,
            ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
            Columns = columns
        };
    }
}
