using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Core.Interfaces;

public interface IQueryExecutionService
{
    Task<QueryResult> ExecuteQueryAsync(string query, DatabaseConfig config);
}
