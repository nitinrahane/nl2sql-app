using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Infrastructure.Services;

public class ClaudeApiService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private const string AnthropicApiUrl = "https://api.anthropic.com/v1/messages";

    public ClaudeApiService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Anthropic:ApiKey"] ?? throw new ArgumentNullException("Anthropic:ApiKey configuration is missing");
        _httpClient.DefaultRequestHeaders.Add("x-api-key", _apiKey); // Set default header
        _httpClient.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01"); // Set default header
    }

    public async Task<AiQueryResponse> GenerateSqlAsync(string naturalLanguageQuery, SchemaInfo schemaInfo, DatabaseType databaseType)
    {
        // Filter schema to only include relevant tables based on query keywords
        var filteredSchema = FilterRelevantTables(schemaInfo, naturalLanguageQuery);
        
        var schemaContext = FormatSchema(filteredSchema);
        Console.WriteLine($"[DEBUG] Schema Context Sent to AI:\n{schemaContext}"); // Log schema for debugging

        var systemPrompt = $@"You are an expert SQL assistant. Your goal is to convert natural language questions into accurate SQL queries for {databaseType}.
        
Schema:
{schemaContext}

Examples:
User: ""Show me the top 5 customers by total order amount in the last year""
Assistant: {{
    ""sqlQuery"": ""SELECT TOP 5 cp.FIRST_NAME, cp.LAST_NAME, SUM(oo.TOTAL_AMOUNT) as TotalSpent FROM dbo.CUSTOMER_PROFILE cp JOIN dbo.OnlineOrder oo ON cp.ID = oo.CUSTOMER_ID WHERE oo.ORDER_DATE >= DATEADD(YEAR, -1, GETDATE()) GROUP BY cp.FIRST_NAME, cp.LAST_NAME ORDER BY TotalSpent DESC"",
    ""explanation"": ""This query joins the customer profile with their online orders, filters for orders in the last year, sums the total amount per customer, and returns the top 5 spenders."",
    ""visualization"": {{
        ""chartType"": ""Bar"",
        ""xAxisColumn"": ""FIRST_NAME"",
        ""yAxisColumn"": ""TotalSpent"",
        ""title"": ""Top 5 Customers by Spending (Last Year)""
    }}
}}

User: ""How many washes were completed each month this year?""
Assistant: {{
    ""sqlQuery"": ""SELECT FORMAT(FINISHED_DATE, 'yyyy-MM') as Month, COUNT(*) as WashCount FROM dbo.OnlineOrder WHERE IS_FINISHED = 1 AND FINISHED_DATE >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1) GROUP BY FORMAT(FINISHED_DATE, 'yyyy-MM') ORDER BY Month"",
    ""explanation"": ""This query counts the number of finished orders grouped by month for the current year."",
    ""visualization"": {{
        ""chartType"": ""Line"",
        ""xAxisColumn"": ""Month"",
        ""yAxisColumn"": ""WashCount"",
        ""title"": ""Monthly Completed Washes (Current Year)""
    }}
}}

Rules:
1. Generate a valid SQL query for {databaseType}.
2. The query must be a SELECT statement only. No INSERT, UPDATE, DELETE, DROP, etc.
3. CRITICAL: USE ONLY THE EXACT TABLE AND COLUMN NAMES PROVIDED IN THE SCHEMA ABOVE.
4. Always use the format TABLE_NAME.COLUMN_NAME when referencing columns to avoid ambiguity.
5. If a column name is not listed under a specific table in the schema, DO NOT USE IT for that table.
6. Double-check that every column you use exists in the table you're querying.
7. **IMPORTANT FOR SQL SERVER**: Use SQL Server syntax:
   - Use TOP N instead of LIMIT N
   - Use GETDATE() instead of NOW()
   - Use DATEADD() for date arithmetic
   - Use DATEDIFF() for date differences
   Example: SELECT TOP 10 * FROM Table WHERE Date >= DATEADD(YEAR, -1, GETDATE())
8. Provide a brief explanation of the query.
9. Recommend the best visualization for the result (Table, Bar, Line, Pie).
   - If the result is time-series, suggest 'Line'.
   - If comparing categories, suggest 'Bar'.
   - If parts of a whole, suggest 'Pie'.
   - Otherwise, default to 'Table'.
   - Identify the X-axis (category/time) and Y-axis (value) columns.

Output Format:
Return ONLY a JSON object with the following structure:
{{
    ""sqlQuery"": ""SELECT ..."",
    ""explanation"": ""..."",
    ""visualization"": {{
        ""chartType"": ""Bar"",
        ""xAxisColumn"": ""ColumnName"",
        ""yAxisColumn"": ""ColumnName"",
        ""title"": ""Chart Title""
    }}
}}
";

        var requestBody = new
        {
            model = "claude-3-haiku-20240307",
            max_tokens = 1024,
            system = systemPrompt,
            messages = new object[]
            {
                new { role = "user", content = naturalLanguageQuery },
                new { role = "assistant", content = "{" }
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, AnthropicApiUrl);
        request.Content = JsonContent.Create(requestBody);
        
        var response = await _httpClient.SendAsync(request);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Anthropic API Error: {response.StatusCode} - {errorContent}");
        }

        var responseData = await response.Content.ReadFromJsonAsync<JsonElement>();
        var contentText = responseData.GetProperty("content")[0].GetProperty("text").GetString();
        contentText = "{" + contentText; // Prepend the prefilled brace

        try 
        {
            // Clean up markdown code blocks if present
            contentText = contentText.Replace("```json", "").Replace("```", "").Trim();
            
            // Extract JSON object if surrounded by text
            int startIndex = contentText.IndexOf('{');
            int endIndex = contentText.LastIndexOf('}');
            if (startIndex >= 0 && endIndex > startIndex)
            {
                contentText = contentText.Substring(startIndex, endIndex - startIndex + 1);
            }

            // Sanitize: Replace unescaped newlines with spaces to prevent JSON parsing errors
            // This is a simple heuristic; for more complex cases, a proper parser might be needed.
            // We replace newlines that are likely inside the SQL string.
            contentText = contentText.Replace("\r\n", " ").Replace("\n", " ").Replace("\r", " ");

            var result = JsonSerializer.Deserialize<AiQueryResponse>(contentText, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            if (result != null)
            {
                result.SqlQuery = ConvertDialect(result.SqlQuery, databaseType);
            }

            return result ?? new AiQueryResponse { SqlQuery = "ERROR", Explanation = "Failed to parse AI response." };
        }
        catch (Exception ex)
        {
             return new AiQueryResponse { SqlQuery = "ERROR", Explanation = $"Failed to parse AI response JSON. Raw: {contentText}. Error: {ex.Message}" };
        }
    }

    public async Task<List<string>> GenerateSuggestionsAsync(SchemaInfo schemaInfo, DatabaseType dbType)
    {
        var schemaContext = FormatSchema(schemaInfo);
        var systemPrompt = $@"You are a data analyst. Based on the database schema below, suggest 3 interesting questions that a user might ask to explore the data.

Schema:
{schemaContext}

Output Format:
Return ONLY a JSON array of strings:
[""Question 1?"", ""Question 2?"", ""Question 3?""]
";

        var requestBody = new
        {
            model = "claude-3-haiku-20240307",
            max_tokens = 512,
            system = systemPrompt,
            messages = new object[]
            {
                new { role = "user", content = "Suggest 3 questions." },
                new { role = "assistant", content = "[" }
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, AnthropicApiUrl);
        request.Content = JsonContent.Create(requestBody);

        var response = await _httpClient.SendAsync(request);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Anthropic API Error: {response.StatusCode} - {errorContent}");
        }

        var responseData = await response.Content.ReadFromJsonAsync<JsonElement>();
        var contentText = responseData.GetProperty("content")[0].GetProperty("text").GetString();
        contentText = "[" + contentText; // Prepend the prefilled bracket

        try
        {
            contentText = contentText.Replace("```json", "").Replace("```", "").Trim();

            // Extract JSON array if surrounded by text
            int startIndex = contentText.IndexOf('[');
            int endIndex = contentText.LastIndexOf(']');
            if (startIndex >= 0 && endIndex > startIndex)
            {
                contentText = contentText.Substring(startIndex, endIndex - startIndex + 1);
            }

            var suggestions = JsonSerializer.Deserialize<List<string>>(contentText);
            return suggestions ?? new List<string>();
        }
        catch (Exception ex)
        {
            return new List<string> { $"Failed to generate suggestions. Raw: {contentText}. Error: {ex.Message}" };
        }
    }

    private SchemaInfo FilterRelevantTables(SchemaInfo schemaInfo, string naturalLanguageQuery)
    {
        // Extract keywords from the query (convert to uppercase for matching)
        var queryUpper = naturalLanguageQuery.ToUpper();
        var keywords = queryUpper.Split(new[] { ' ', ',', '.', '?', '!', '(', ')', '[', ']', '{', '}' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(k => k.Length > 2) // Ignore very short words
            .ToList();
        
        // Filter tables based on keyword matching (table name or column names)
        var relevantTables = schemaInfo.Tables.Where(table =>
        {
            var tableNameUpper = table.Name.ToUpper();
            
            // 1. Check table name
            if (keywords.Any(keyword => 
                tableNameUpper.Contains(keyword) || 
                keyword.Contains(tableNameUpper)))
            {
                return true;
            }

            // 2. Check column names
            if (table.Columns.Any(col => 
                keywords.Any(keyword => 
                    col.Name.ToUpper().Contains(keyword) || 
                    keyword.Contains(col.Name.ToUpper()))))
            {
                return true;
            }

            return false;
        }).ToList();
        
        // If no tables match, return top 20 most likely tables (to avoid empty schema)
        if (!relevantTables.Any())
        {
            relevantTables = schemaInfo.Tables.Take(20).ToList();
        }
        // If too many tables match, limit to top 40 (increased from 30 for better coverage)
        else if (relevantTables.Count > 40)
        {
            relevantTables = relevantTables.Take(40).ToList();
        }
        
        return new SchemaInfo { Tables = relevantTables };
    }

    private string FormatSchema(SchemaInfo schemaInfo)
    {
        var schemaDescription = new StringBuilder();
        schemaDescription.AppendLine("DATABASE SCHEMA:");
        schemaDescription.AppendLine("================");
        schemaDescription.AppendLine();
        
        foreach (var table in schemaInfo.Tables)
        {
            schemaDescription.AppendLine($"TABLE: {table.Schema}.{table.Name}");
            schemaDescription.AppendLine("COLUMNS:");
            foreach (var col in table.Columns)
            {
                var nullable = col.IsNullable ? "NULL" : "NOT NULL";
                schemaDescription.AppendLine($"  - {col.Name} ({col.DataType}, {nullable})");
            }
            schemaDescription.AppendLine(); // Empty line between tables
        }
        return schemaDescription.ToString();
    }

    private AiQueryResponse ParseResponse(string? responseText)
    {
        if (string.IsNullOrEmpty(responseText))
        {
            return new AiQueryResponse { SqlQuery = "ERROR: Empty response from AI" };
        }

        var lines = responseText.Split('\n');
        var sql = "";
        var explanation = "";
        var isSql = false;
        var isExplanation = false;

        foreach (var line in lines)
        {
            if (line.StartsWith("SQL Query:"))
            {
                isSql = true;
                isExplanation = false;
                sql += line.Replace("SQL Query:", "").Trim() + " ";
            }
            else if (line.StartsWith("Explanation:"))
            {
                isSql = false;
                isExplanation = true;
                explanation += line.Replace("Explanation:", "").Trim() + " ";
            }
            else
            {
                if (isSql) sql += line.Trim() + " ";
                if (isExplanation) explanation += line.Trim() + " ";
            }
        }

        return new AiQueryResponse
        {
            SqlQuery = sql.Trim(),
            Explanation = explanation.Trim()
        };
    }

    private string ConvertDialect(string sql, DatabaseType databaseType)
    {
        if (databaseType == DatabaseType.SqlServer)
        {
            // 1. Convert LIMIT N OFFSET M to OFFSET M ROWS FETCH NEXT N ROWS ONLY
            // Or simple LIMIT N to TOP N
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
            
            // 2. Convert common functions
            sql = Regex.Replace(sql, @"\bNOW\(\)", "GETDATE()", RegexOptions.IgnoreCase);
            sql = Regex.Replace(sql, @"\bIFNULL\(", "ISNULL(", RegexOptions.IgnoreCase);
            sql = Regex.Replace(sql, @"\bSUBSTR\(", "SUBSTRING(", RegexOptions.IgnoreCase);
            
            // 3. Convert EXTRACT(YEAR FROM x) to YEAR(x)
            sql = Regex.Replace(sql, @"EXTRACT\((YEAR|MONTH|DAY)\s+FROM\s+([^)]+)\)", "$1($2)", RegexOptions.IgnoreCase);
            
            // 4. Convert CONCAT(a, b, ...) to (a + b + ...)
            // This is complex for arbitrary arguments, but we can handle simple cases
            var concatMatch = Regex.Match(sql, @"CONCAT\(([^)]+)\)", RegexOptions.IgnoreCase);
            if (concatMatch.Success)
            {
                var args = concatMatch.Groups[1].Value.Split(',').Select(a => a.Trim());
                var replacement = "(" + string.Join(" + ", args) + ")";
                sql = sql.Replace(concatMatch.Value, replacement);
            }

            // 5. Convert backticks to square brackets
            sql = sql.Replace("`", "[");
            var parts = sql.Split('`');
            if (parts.Length > 1)
            {
                var sb = new StringBuilder();
                for (int i = 0; i < parts.Length; i++)
                {
                    sb.Append(parts[i]);
                    if (i < parts.Length - 1)
                    {
                        sb.Append(i % 2 == 0 ? "[" : "]");
                    }
                }
                sql = sb.ToString();
            }
        }
        return sql;
    }
}

