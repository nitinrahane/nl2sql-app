using Nl2Sql.Core.Entities;

namespace Nl2Sql.Core.Interfaces;

public interface IDatabaseConfigService
{
    Task<IEnumerable<DatabaseConfig>> GetAllConfigsAsync();
    Task<DatabaseConfig?> GetConfigByIdAsync(int id);
    Task<DatabaseConfig> CreateConfigAsync(DatabaseConfig config);
    Task UpdateConfigAsync(DatabaseConfig config);
    Task DeleteConfigAsync(int id);
}
