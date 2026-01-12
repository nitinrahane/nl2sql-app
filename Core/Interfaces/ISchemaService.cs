using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Core.Interfaces;

public interface ISchemaService
{
    Task<SchemaInfo> GetSchemaInfoAsync(DatabaseConfig config);
}
