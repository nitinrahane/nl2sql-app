using Nl2Sql.Core.Enums;

namespace Nl2Sql.Core.Interfaces;

public interface ISqlValidationService
{
    bool ValidateQuery(string query, DatabaseType databaseType, out string errorMessage);
}
