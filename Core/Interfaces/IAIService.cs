using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Core.Interfaces;

public interface IAIService
{
    Task<AiQueryResponse> GenerateSqlAsync(string naturalLanguageQuery, SchemaInfo schemaInfo, DatabaseType dbType);
    Task<List<string>> GenerateSuggestionsAsync(SchemaInfo schemaInfo, DatabaseType dbType);
}
