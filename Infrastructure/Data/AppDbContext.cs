using Microsoft.EntityFrameworkCore;

namespace Nl2Sql.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Nl2Sql.Core.Entities.DatabaseConfig> DatabaseConfigs { get; set; }
    public DbSet<Nl2Sql.Core.Entities.QueryHistory> QueryHistories { get; set; }
}
