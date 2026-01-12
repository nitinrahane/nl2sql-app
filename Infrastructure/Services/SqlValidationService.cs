using System.Text.RegularExpressions;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;

namespace Nl2Sql.Infrastructure.Services;

public class SqlValidationService : ISqlValidationService
{
    private static readonly string[] ForbiddenKeywords = 
    { 
        "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "MERGE" 
    };

    public bool ValidateQuery(string query, DatabaseType databaseType, out string errorMessage)
    {
        errorMessage = string.Empty;

        if (string.IsNullOrWhiteSpace(query))
        {
            errorMessage = "Query cannot be empty.";
            return false;
        }

        // 1. Basic Keyword Check (Case-insensitive)
        foreach (var keyword in ForbiddenKeywords)
        {
            // Use word boundary to avoid matching inside other words
            if (Regex.IsMatch(query, $@"\b{keyword}\b", RegexOptions.IgnoreCase))
            {
                errorMessage = $"Query contains forbidden keyword: {keyword}";
                return false;
            }
        }

        // 2. Lightweight validation - focus on security, not perfect syntax
        return ValidateSecure(query, out errorMessage);
    }

    private bool ValidateSecure(string query, out string errorMessage)
    {
        errorMessage = string.Empty;
        
        var queryUpper = query.ToUpper();
        
        // Check if it starts with SELECT (allowing whitespace)
        if (!Regex.IsMatch(queryUpper.Trim(), @"^SELECT\s", RegexOptions.IgnoreCase))
        {
            errorMessage = "Query must start with SELECT";
            return false;
        }
        
        // Additional security check: ensure no dangerous operations or functions
        var forbiddenPatterns = new[]
        {
            @"\bINTO\s+OUTFILE\b",  // MySQL file write
            @"\bLOAD_FILE\b",        // MySQL file read
            @"\bxp_cmdshell\b",      // SQL Server command execution
            @"\bsp_executesql\b",    // Dynamic SQL execution
            @"\bOPENROWSET\b",       // SQL Server external data access
            @"\bOPENQUERY\b"         // SQL Server linked server query
        };
        
        foreach (var pattern in forbiddenPatterns)
        {
            if (Regex.IsMatch(query, pattern, RegexOptions.IgnoreCase))
            {
                errorMessage = "Query contains potentially dangerous operations";
                return false;
            }
        }
        
        return true;
    }
}
