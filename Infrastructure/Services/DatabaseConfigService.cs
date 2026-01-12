using Microsoft.EntityFrameworkCore;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Infrastructure.Data;

namespace Nl2Sql.Infrastructure.Services;

public class DatabaseConfigService : IDatabaseConfigService
{
    private readonly AppDbContext _context;
    private readonly IEncryptionService _encryptionService;

    public DatabaseConfigService(AppDbContext context, IEncryptionService encryptionService)
    {
        _context = context;
        _encryptionService = encryptionService;
    }

    public async Task<IEnumerable<DatabaseConfig>> GetAllConfigsAsync()
    {
        var configs = await _context.DatabaseConfigs.ToListAsync();
        foreach (var config in configs)
        {
            config.ConnectionString = _encryptionService.Decrypt(config.ConnectionString);
        }
        return configs;
    }

    public async Task<DatabaseConfig?> GetConfigByIdAsync(int id)
    {
        var config = await _context.DatabaseConfigs.FindAsync(id);
        if (config != null)
        {
            config.ConnectionString = _encryptionService.Decrypt(config.ConnectionString);
        }
        return config;
    }

    public async Task<DatabaseConfig> CreateConfigAsync(DatabaseConfig config)
    {
        config.ConnectionString = _encryptionService.Encrypt(config.ConnectionString);
        _context.DatabaseConfigs.Add(config);
        await _context.SaveChangesAsync();
        
        // Decrypt for the return value
        config.ConnectionString = _encryptionService.Decrypt(config.ConnectionString);
        return config;
    }

    public async Task UpdateConfigAsync(DatabaseConfig config)
    {
        config.ConnectionString = _encryptionService.Encrypt(config.ConnectionString);
        _context.Entry(config).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        
        // Decrypt back
        config.ConnectionString = _encryptionService.Decrypt(config.ConnectionString);
    }

    public async Task DeleteConfigAsync(int id)
    {
        var config = await _context.DatabaseConfigs.FindAsync(id);
        if (config != null)
        {
            _context.DatabaseConfigs.Remove(config);
            await _context.SaveChangesAsync();
        }
    }
}
