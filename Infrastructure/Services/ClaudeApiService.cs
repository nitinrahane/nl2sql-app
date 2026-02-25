using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Infrastructure.Services;

public class ClaudeApiService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<ClaudeApiService> _logger;
    private const string AnthropicApiUrl = "https://api.anthropic.com/v1/messages";
    private const string DefaultModel = "claude-sonnet-4-20250514";
    private const int MaxRetries = 2;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ClaudeApiService(HttpClient httpClient, IConfiguration configuration, ILogger<ClaudeApiService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = configuration["Anthropic:ApiKey"] ?? throw new ArgumentNullException("Anthropic:ApiKey configuration is missing");
        _httpClient.DefaultRequestHeaders.Add("x-api-key", _apiKey);
        _httpClient.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
    }

    public async Task<AiQueryResponse> GenerateSqlAsync(string naturalLanguageQuery, SchemaInfo schemaInfo, DatabaseType databaseType)
    {
        var filteredSchema = FilterRelevantTables(schemaInfo, naturalLanguageQuery);
        var schemaContext = FormatSchema(filteredSchema);
        
        _logger.LogDebug("Schema sent to AI: {TableCount} tables", filteredSchema.Tables.Count);

        var dbName = databaseType.ToString();
        var systemPrompt = BuildSqlGenerationPrompt(schemaContext, dbName, databaseType);

        var requestBody = new
        {
            model = DefaultModel,
            max_tokens = 2048,
            system = systemPrompt,
            messages = new object[]
            {
                new { role = "user", content = naturalLanguageQuery }
            }
        };

        var responseText = await CallAnthropicApiWithRetry(requestBody);
        return ParseSqlResponse(responseText, databaseType);
    }

    public async Task<List<string>> GenerateSuggestionsAsync(SchemaInfo schemaInfo, DatabaseType dbType)
    {
        var schemaContext = FormatSchema(schemaInfo);
        var systemPrompt = $@"You are a data analyst helping a non-technical user explore their database. Based on the schema below, suggest 5 diverse, practical questions that would reveal useful business insights.

Schema:
{schemaContext}

Guidelines:
- Questions should range from simple (counts, lists) to analytical (trends, comparisons, aggregations)
- Use natural, conversational language a non-technical person would use
- Focus on questions that would produce interesting visualizable results
- Include at least one time-based question if date columns exist
- Include at least one comparison/ranking question

Return ONLY a JSON array of strings, no other text:
[""Question 1?"", ""Question 2?"", ""Question 3?"", ""Question 4?"", ""Question 5?""]";

        var requestBody = new
        {
            model = DefaultModel,
            max_tokens = 512,
            system = systemPrompt,
            messages = new object[]
            {
                new { role = "user", content = "Suggest 5 insightful questions for this database." }
            }
        };

        var responseText = await CallAnthropicApiWithRetry(requestBody);
        return ParseSuggestionsResponse(responseText);
    }

    private string BuildSqlGenerationPrompt(string schemaContext, string dbName, DatabaseType databaseType)
    {
        var dialectNotes = databaseType switch
        {
            DatabaseType.SqlServer => @"
SQL Server specific syntax:
- Use TOP N instead of LIMIT N
- Use GETDATE() instead of NOW()
- Use DATEADD()/DATEDIFF() for date arithmetic
- Use FORMAT() for date formatting
- Use ISNULL() instead of COALESCE() for simple cases
- Use square brackets [name] for reserved words
Example: SELECT TOP 10 * FROM [Order] WHERE OrderDate >= DATEADD(YEAR, -1, GETDATE())",

            DatabaseType.PostgreSql => @"
PostgreSQL specific syntax:
- Use LIMIT N for row limiting
- Use NOW() or CURRENT_TIMESTAMP for current time
- Use :: for type casting (e.g., '2024-01-01'::date)
- Use EXTRACT(YEAR FROM date) for date parts
- Use double quotes ""name"" for reserved words
Example: SELECT * FROM orders WHERE order_date >= NOW() - INTERVAL '1 year' LIMIT 10",

            DatabaseType.MySql => @"
MySQL specific syntax:
- Use LIMIT N for row limiting
- Use NOW() or CURDATE() for current time
- Use DATE_SUB()/DATE_ADD() for date arithmetic
- Use backticks `name` for reserved words
Example: SELECT * FROM orders WHERE order_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR) LIMIT 10",

            _ => ""
        };

        return $@"You are an expert SQL assistant that converts natural language to SQL. You help non-technical users query their databases.

DATABASE SCHEMA:
{schemaContext}

TARGET DATABASE: {dbName}
{dialectNotes}

RULES:
1. Generate ONLY SELECT statements. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, EXEC, or EXECUTE.
2. CRITICAL: Use ONLY exact table and column names from the schema above. Do NOT invent columns.
3. Always qualify column names with table name/alias to avoid ambiguity.
4. Use appropriate JOINs when data spans multiple tables. Leverage the foreign key relationships shown in the schema.
5. Add reasonable defaults: LIMIT/TOP 100 if no limit specified, ORDER BY for ranked results.
6. Handle NULLs gracefully in aggregations.
7. For date-related questions, use the correct date functions for {dbName}.
8. Provide a clear, concise explanation of what the query does, written for a non-technical user.
9. Recommend the best visualization:
   - ""Bar"" for category comparisons
   - ""Line"" for time series / trends
   - ""Pie"" for parts-of-whole / proportions (limit to ≤10 slices)
   - ""Area"" for cumulative trends
   - ""Table"" when data is too complex or has many columns

OUTPUT FORMAT — return ONLY this JSON, no other text:
{{
    ""sqlQuery"": ""SELECT ..."",
    ""explanation"": ""Plain English explanation"",
    ""visualization"": {{
        ""chartType"": ""Bar|Line|Pie|Area|Table"",
        ""xAxisColumn"": ""column_name"",
        ""yAxisColumns"": [""column_name""],
        ""title"": ""Descriptive Chart Title""
    }}
}}";
    }

    private async Task<string> CallAnthropicApiWithRetry(object requestBody)
    {
        Exception? lastException = null;

        for (int attempt = 0; attempt <= MaxRetries; attempt++)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, AnthropicApiUrl);
                request.Content = JsonContent.Create(requestBody);

                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    
                    if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500)
                    {
                        _logger.LogWarning("Anthropic API returned {StatusCode}, attempt {Attempt}/{MaxRetries}", 
                            response.StatusCode, attempt + 1, MaxRetries + 1);
                        
                        if (attempt < MaxRetries)
                        {
                            await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt + 1)));
                            continue;
                        }
                    }
                    
                    throw new HttpRequestException($"Anthropic API Error: {response.StatusCode} - {errorContent}");
                }

                var responseData = await response.Content.ReadFromJsonAsync<JsonElement>();
                return responseData.GetProperty("content")[0].GetProperty("text").GetString() ?? string.Empty;
            }
            catch (HttpRequestException ex)
            {
                lastException = ex;
                if (attempt < MaxRetries)
                {
                    await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt + 1)));
                    continue;
                }
            }
        }

        throw lastException ?? new HttpRequestException("Failed to call Anthropic API after retries");
    }

    private AiQueryResponse ParseSqlResponse(string responseText, DatabaseType databaseType)
    {
        try
        {
            var cleaned = CleanJsonResponse(responseText);
            
            using var doc = JsonDocument.Parse(cleaned);
            var root = doc.RootElement;

            var sqlQuery = root.GetProperty("sqlQuery").GetString() ?? "ERROR";
            var explanation = root.GetProperty("explanation").GetString() ?? "";

            var viz = new VisualizationRecommendation();
            if (root.TryGetProperty("visualization", out var vizEl))
            {
                viz.ChartType = vizEl.TryGetProperty("chartType", out var ct) ? ct.GetString() ?? "Table" : "Table";
                viz.XAxisColumn = vizEl.TryGetProperty("xAxisColumn", out var xa) ? xa.GetString() ?? "" : "";
                viz.Title = vizEl.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";

                if (vizEl.TryGetProperty("yAxisColumns", out var yc))
                {
                    if (yc.ValueKind == JsonValueKind.Array)
                    {
                        viz.YAxisColumns = yc.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s != "").ToList();
                    }
                    else if (yc.ValueKind == JsonValueKind.String)
                    {
                        var val = yc.GetString();
                        viz.YAxisColumns = string.IsNullOrEmpty(val) ? new List<string>() : new List<string> { val };
                    }
                }
                else if (vizEl.TryGetProperty("yAxisColumn", out var ycSingle))
                {
                    if (ycSingle.ValueKind == JsonValueKind.Array)
                    {
                        viz.YAxisColumns = ycSingle.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s != "").ToList();
                    }
                    else if (ycSingle.ValueKind == JsonValueKind.String)
                    {
                        var val = ycSingle.GetString();
                        viz.YAxisColumns = string.IsNullOrEmpty(val) ? new List<string>() : new List<string> { val };
                    }
                }
            }

            sqlQuery = ConvertDialect(sqlQuery, databaseType);

            return new AiQueryResponse
            {
                SqlQuery = sqlQuery,
                Explanation = explanation,
                Visualization = viz
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI response: {Response}", responseText);
            return new AiQueryResponse
            {
                SqlQuery = "ERROR",
                Explanation = $"Failed to parse AI response. Please try rephrasing your question."
            };
        }
    }

    private List<string> ParseSuggestionsResponse(string responseText)
    {
        try
        {
            var cleaned = CleanJsonResponse(responseText);
            
            int startIndex = cleaned.IndexOf('[');
            int endIndex = cleaned.LastIndexOf(']');
            if (startIndex >= 0 && endIndex > startIndex)
            {
                cleaned = cleaned.Substring(startIndex, endIndex - startIndex + 1);
            }

            var suggestions = JsonSerializer.Deserialize<List<string>>(cleaned, JsonOptions);
            return suggestions ?? new List<string>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse suggestions response");
            return new List<string> { "Show me all tables and their row counts", "What are the most recent records?", "Show me a summary of the data" };
        }
    }

    private static string CleanJsonResponse(string text)
    {
        text = text.Replace("```json", "").Replace("```", "").Trim();
        
        int startIndex = text.IndexOf('{');
        int endIndex = text.LastIndexOf('}');
        if (startIndex >= 0 && endIndex > startIndex)
        {
            text = text.Substring(startIndex, endIndex - startIndex + 1);
        }
        
        return text;
    }

    private SchemaInfo FilterRelevantTables(SchemaInfo schemaInfo, string naturalLanguageQuery)
    {
        var queryLower = naturalLanguageQuery.ToLower();
        var keywords = queryLower
            .Split(new[] { ' ', ',', '.', '?', '!', '(', ')', '[', ']', '{', '}', '\'', '"' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(k => k.Length > 2)
            .Where(k => !StopWords.Contains(k))
            .ToList();
        
        var scoredTables = schemaInfo.Tables.Select(table =>
        {
            int score = 0;
            var tableNameLower = table.Name.ToLower();
            var tableNameParts = SplitIdentifier(tableNameLower);

            foreach (var keyword in keywords)
            {
                if (tableNameLower.Contains(keyword) || keyword.Contains(tableNameLower))
                    score += 10;
                
                if (tableNameParts.Any(part => part.Contains(keyword) || keyword.Contains(part)))
                    score += 5;

                foreach (var col in table.Columns)
                {
                    var colNameLower = col.Name.ToLower();
                    if (colNameLower.Contains(keyword) || keyword.Contains(colNameLower))
                        score += 3;
                }
            }

            if (table.ForeignKeys.Any())
            {
                foreach (var fk in table.ForeignKeys)
                {
                    var refTableLower = fk.ReferencedTable.ToLower();
                    if (keywords.Any(k => refTableLower.Contains(k)))
                        score += 2;
                }
            }

            return (table, score);
        })
        .OrderByDescending(x => x.score)
        .ToList();

        var relevantTables = scoredTables.Where(x => x.score > 0).Select(x => x.table).ToList();

        if (relevantTables.Count > 0)
        {
            var additionalTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var table in relevantTables.ToList())
            {
                foreach (var fk in table.ForeignKeys)
                {
                    additionalTables.Add(fk.ReferencedTable);
                }
            }

            foreach (var addTable in additionalTables)
            {
                if (!relevantTables.Any(t => t.Name.Equals(addTable, StringComparison.OrdinalIgnoreCase)))
                {
                    var related = schemaInfo.Tables.FirstOrDefault(t => t.Name.Equals(addTable, StringComparison.OrdinalIgnoreCase));
                    if (related != null)
                        relevantTables.Add(related);
                }
            }
        }

        if (relevantTables.Count == 0)
        {
            relevantTables = schemaInfo.Tables.Take(25).ToList();
        }
        else if (relevantTables.Count > 50)
        {
            relevantTables = relevantTables.Take(50).ToList();
        }
        
        return new SchemaInfo { Tables = relevantTables, TotalTableCount = schemaInfo.TotalTableCount };
    }

    private static List<string> SplitIdentifier(string name)
    {
        var parts = new List<string>();
        parts.AddRange(name.Split('_', '-').Where(p => p.Length > 0));
        parts.AddRange(Regex.Split(name, @"(?<=[a-z])(?=[A-Z])").Where(p => p.Length > 0));
        return parts.Select(p => p.ToLower()).Distinct().ToList();
    }

    private string FormatSchema(SchemaInfo schemaInfo)
    {
        var sb = new StringBuilder();
        
        foreach (var table in schemaInfo.Tables)
        {
            sb.AppendLine($"TABLE: {table.Schema}.{table.Name}");
            sb.AppendLine("  COLUMNS:");
            foreach (var col in table.Columns)
            {
                var pk = col.IsPrimaryKey ? " [PK]" : "";
                var nullable = col.IsNullable ? "NULL" : "NOT NULL";
                sb.AppendLine($"    - {col.Name} ({col.DataType}, {nullable}){pk}");
            }
            
            if (table.ForeignKeys.Any())
            {
                sb.AppendLine("  FOREIGN KEYS:");
                foreach (var fk in table.ForeignKeys)
                {
                    sb.AppendLine($"    - {fk.Column} → {fk.ReferencedTable}.{fk.ReferencedColumn}");
                }
            }
            sb.AppendLine();
        }
        
        return sb.ToString();
    }

    private string ConvertDialect(string sql, DatabaseType databaseType)
    {
        if (databaseType == DatabaseType.SqlServer)
        {
            var limitOffsetMatch = Regex.Match(sql, @"LIMIT\s+(\d+)\s+OFFSET\s+(\d+)", RegexOptions.IgnoreCase);
            if (limitOffsetMatch.Success)
            {
                var limit = limitOffsetMatch.Groups[1].Value;
                var offset = limitOffsetMatch.Groups[2].Value;
                sql = Regex.Replace(sql, @"LIMIT\s+\d+\s+OFFSET\s+\d+", $"OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY", RegexOptions.IgnoreCase);
            }
            else
            {
                var limitMatch = Regex.Match(sql, @"LIMIT\s+(\d+)", RegexOptions.IgnoreCase);
                if (limitMatch.Success && !sql.Contains("TOP", StringComparison.OrdinalIgnoreCase))
                {
                    var limitValue = limitMatch.Groups[1].Value;
                    sql = Regex.Replace(sql, @"LIMIT\s+\d+", "", RegexOptions.IgnoreCase).Trim();
                    if (Regex.IsMatch(sql, @"^SELECT", RegexOptions.IgnoreCase))
                    {
                        sql = Regex.Replace(sql, @"^SELECT", $"SELECT TOP {limitValue}", RegexOptions.IgnoreCase);
                    }
                }
            }

            sql = Regex.Replace(sql, @"\bNOW\(\)", "GETDATE()", RegexOptions.IgnoreCase);
            sql = Regex.Replace(sql, @"\bIFNULL\(", "ISNULL(", RegexOptions.IgnoreCase);
            sql = Regex.Replace(sql, @"EXTRACT\((YEAR|MONTH|DAY)\s+FROM\s+([^)]+)\)", "$1($2)", RegexOptions.IgnoreCase);
        }
        return sql;
    }

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
        "her", "was", "one", "our", "out", "has", "have", "from", "been", "some",
        "them", "than", "its", "over", "also", "that", "with", "this", "will",
        "each", "make", "like", "long", "look", "many", "most", "only", "come",
        "show", "give", "get", "what", "which", "how", "who", "where", "when",
        "much", "more", "list", "find", "display", "tell", "about"
    };
}
