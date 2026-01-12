using System.Data;
using Nl2Sql.Core.Enums;

namespace Nl2Sql.Core.Interfaces;

public interface IDatabaseConnectionFactory
{
    IDbConnection CreateConnection(DatabaseType databaseType, string connectionString);
}
