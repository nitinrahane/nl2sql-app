using System.Data;
using Microsoft.Data.SqlClient;
using MySqlConnector;
using Npgsql;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;

namespace Nl2Sql.Infrastructure.Database;

public class DatabaseConnectionFactory : IDatabaseConnectionFactory
{
    public IDbConnection CreateConnection(DatabaseType databaseType, string connectionString)
    {
        return databaseType switch
        {
            DatabaseType.SqlServer => new SqlConnection(connectionString),
            DatabaseType.PostgreSql => new NpgsqlConnection(connectionString),
            DatabaseType.MySql => new MySqlConnection(connectionString),
            _ => throw new ArgumentException($"Unsupported database type: {databaseType}")
        };
    }
}
