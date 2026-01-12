using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Infrastructure.Data;

namespace Nl2Sql.Infrastructure.Services;

public class QueryHistoryService : IQueryHistoryService
{
    private readonly AppDbContext _context;

    public QueryHistoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<QueryHistory>> GetHistoryAsync(int limit = 50)
    {
        return await _context.QueryHistories
            .OrderByDescending(h => h.ExecutedAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<QueryHistory> AddHistoryAsync(QueryHistory history)
    {
        _context.QueryHistories.Add(history);
        await _context.SaveChangesAsync();
        return history;
    }

    public async Task ClearHistoryAsync()
    {
        var history = await _context.QueryHistories.ToListAsync();
        _context.QueryHistories.RemoveRange(history);
        await _context.SaveChangesAsync();
    }
}
