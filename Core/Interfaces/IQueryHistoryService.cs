using System.Collections.Generic;
using System.Threading.Tasks;
using Nl2Sql.Core.Entities;

namespace Nl2Sql.Core.Interfaces;

public interface IQueryHistoryService
{
    Task<IEnumerable<QueryHistory>> GetHistoryAsync(int limit = 50);
    Task<QueryHistory> AddHistoryAsync(QueryHistory history);
    Task ClearHistoryAsync();
}
