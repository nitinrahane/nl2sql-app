using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Infrastructure.Services;

public class AgentOrchestrator : IAgentService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<AgentOrchestrator> _logger;
    private readonly ISchemaService _schemaService;
    private readonly ISqlValidationService _validationService;
    private readonly IQueryExecutionService _executionService;
    private readonly IDatabaseConfigService _configService;
    private readonly IQueryHistoryService _historyService;

    private const string AnthropicApiUrl = "https://api.anthropic.com/v1/messages";
    private const string Model = "claude-sonnet-4-20250514";
    private const int MaxLoopIterations = 10;

    private class AgentContext
    {
        public SchemaInfo? Schema { get; set; }
        public string? LastSql { get; set; }
        public string? LastExplanation { get; set; }
        public QueryResult? LastResult { get; set; }
        public VisualizationRecommendation? Visualization { get; set; }
        public List<string> Insights { get; set; } = new();
        public List<string> Assumptions { get; set; } = new();
        public List<string> Limitations { get; set; } = new();
        public List<AgentStep> Steps { get; set; } = new();
        public List<string> SafetyChecks { get; set; } = new();
        public int SqlAttempts { get; set; }
        public int ToolCallCount { get; set; }
        public string FinalExplanation { get; set; } = string.Empty;
    }

    public AgentOrchestrator(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<AgentOrchestrator> logger,
        ISchemaService schemaService,
        ISqlValidationService validationService,
        IQueryExecutionService executionService,
        IDatabaseConfigService configService,
        IQueryHistoryService historyService)
    {
        _httpClient = httpClient;
        _logger = logger;
        _schemaService = schemaService;
        _validationService = validationService;
        _executionService = executionService;
        _configService = configService;
        _historyService = historyService;
        _apiKey = configuration["Anthropic:ApiKey"] ?? throw new ArgumentNullException("Anthropic:ApiKey is required");
        _httpClient.DefaultRequestHeaders.TryAddWithoutValidation("x-api-key", _apiKey);
        _httpClient.DefaultRequestHeaders.TryAddWithoutValidation("anthropic-version", "2023-06-01");
    }

    public async Task<AgentResponse> AskAsync(string question, int databaseConfigId)
    {
        var totalStopwatch = Stopwatch.StartNew();
        var ctx = new AgentContext();

        var config = await _configService.GetConfigByIdAsync(databaseConfigId);
        if (config == null)
        {
            return new AgentResponse
            {
                Success = false,
                Error = "Database configuration not found."
            };
        }

        try
        {
            var systemPrompt = BuildSystemPrompt(config.Type);
            var tools = BuildToolDefinitions();
            var messages = new List<object>
            {
                new { role = "user", content = question }
            };

            for (int iteration = 0; iteration < MaxLoopIterations; iteration++)
            {
                var apiResponse = await CallClaude(systemPrompt, tools, messages);
                var contentArray = apiResponse.GetProperty("content");
                var stopReason = apiResponse.GetProperty("stop_reason").GetString();

                var assistantBlocks = new List<object>();
                var toolResultBlocks = new List<object>();
                bool hasToolUse = false;

                foreach (var block in contentArray.EnumerateArray())
                {
                    var blockType = block.GetProperty("type").GetString();

                    if (blockType == "text")
                    {
                        var text = block.GetProperty("text").GetString() ?? "";
                        assistantBlocks.Add(new { type = "text", text });
                        ctx.FinalExplanation = text;
                    }
                    else if (blockType == "tool_use")
                    {
                        hasToolUse = true;
                        ctx.ToolCallCount++;
                        var toolId = block.GetProperty("id").GetString()!;
                        var toolName = block.GetProperty("name").GetString()!;
                        var toolInput = block.GetProperty("input");

                        assistantBlocks.Add(new
                        {
                            type = "tool_use",
                            id = toolId,
                            name = toolName,
                            input = toolInput
                        });

                        var stepStopwatch = Stopwatch.StartNew();
                        var toolResultContent = await ProcessToolCall(toolName, toolInput, config, ctx);
                        stepStopwatch.Stop();

                        if (ctx.Steps.Count > 0)
                        {
                            ctx.Steps[^1].DurationMs = stepStopwatch.ElapsedMilliseconds;
                        }

                        toolResultBlocks.Add(new
                        {
                            type = "tool_result",
                            tool_use_id = toolId,
                            content = toolResultContent
                        });
                    }
                }

                messages.Add(new { role = "assistant", content = assistantBlocks });

                if (!hasToolUse || stopReason == "end_turn")
                    break;

                messages.Add(new { role = "user", content = toolResultBlocks });
            }

            totalStopwatch.Stop();

            var response = new AgentResponse
            {
                Success = ctx.LastResult != null,
                Explanation = ctx.FinalExplanation,
                SqlQuery = ctx.LastSql,
                Results = ctx.LastResult,
                Visualization = ctx.Visualization,
                Insights = ctx.Insights,
                Assumptions = ctx.Assumptions,
                Limitations = ctx.Limitations,
                SafetyChecks = ctx.SafetyChecks,
                Steps = ctx.Steps,
                Metadata = new AgentMetadata
                {
                    SqlAttempts = ctx.SqlAttempts,
                    TablesDiscovered = ctx.Schema?.Tables.Count ?? 0,
                    TotalDurationMs = totalStopwatch.ElapsedMilliseconds,
                    ToolCallCount = ctx.ToolCallCount
                }
            };

            await SaveHistory(question, databaseConfigId, response);
            return response;
        }
        catch (Exception ex)
        {
            totalStopwatch.Stop();
            _logger.LogError(ex, "Agent failed for question: {Question}", question);
            return new AgentResponse
            {
                Success = false,
                Error = $"Agent encountered an error: {ex.Message}",
                Steps = ctx.Steps,
                SafetyChecks = ctx.SafetyChecks,
                Metadata = new AgentMetadata
                {
                    SqlAttempts = ctx.SqlAttempts,
                    TotalDurationMs = totalStopwatch.ElapsedMilliseconds,
                    ToolCallCount = ctx.ToolCallCount
                }
            };
        }
    }

    private async Task<string> ProcessToolCall(string toolName, JsonElement input, DatabaseConfig config, AgentContext ctx)
    {
        switch (toolName)
        {
            case "discover_schema":
                return await HandleDiscoverSchema(config, ctx);
            case "execute_sql":
                return await HandleExecuteSql(input, config, ctx);
            case "present_results":
                HandlePresentResults(input, ctx);
                return "Results presented to the user.";
            default:
                return JsonSerializer.Serialize(new { error = $"Unknown tool: {toolName}" });
        }
    }

    private async Task<string> HandleDiscoverSchema(DatabaseConfig config, AgentContext ctx)
    {
        try
        {
            ctx.Schema = await _schemaService.GetSchemaInfoAsync(config);
            ctx.SafetyChecks.Add("schema_discovered");
            ctx.Steps.Add(new AgentStep
            {
                Type = "schema_discovery",
                Description = $"Discovered {ctx.Schema.Tables.Count} tables with columns, primary keys, and foreign key relationships",
                Success = true
            });

            return FormatSchemaForAgent(ctx.Schema);
        }
        catch (Exception ex)
        {
            ctx.Steps.Add(new AgentStep
            {
                Type = "schema_discovery",
                Description = $"Schema discovery failed: {ex.Message}",
                Success = false
            });
            return JsonSerializer.Serialize(new { error = $"Failed to discover schema: {ex.Message}" });
        }
    }

    private async Task<string> HandleExecuteSql(JsonElement input, DatabaseConfig config, AgentContext ctx)
    {
        ctx.SqlAttempts++;
        var sql = input.TryGetProperty("sql", out var sqlProp) ? sqlProp.GetString() ?? "" : "";
        var explanation = input.TryGetProperty("explanation", out var explProp) ? explProp.GetString() ?? "" : "";

        ctx.LastSql = sql;
        ctx.LastExplanation = explanation;

        if (!_validationService.ValidateQuery(sql, config.Type, out var validationError))
        {
            ctx.SafetyChecks.Add("read_only_enforced");
            ctx.Steps.Add(new AgentStep
            {
                Type = "sql_validation",
                Description = $"SQL validation failed: {validationError}",
                Detail = sql,
                Success = false
            });
            return JsonSerializer.Serialize(new { error = $"SQL validation failed: {validationError}. Only SELECT statements are allowed." });
        }

        ctx.SafetyChecks.Add("read_only_select");

        try
        {
            var result = await _executionService.ExecuteQueryAsync(sql, config);
            ctx.LastResult = result;
            ctx.SafetyChecks.Add("row_limit_applied");

            ctx.Steps.Add(new AgentStep
            {
                Type = "sql_execution",
                Description = $"Query executed successfully: {result.RowCount} rows returned in {result.ExecutionTimeMs}ms",
                Detail = sql,
                Success = true
            });

            return FormatResultsForAgent(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SQL execution failed (attempt {Attempt}): {Sql}", ctx.SqlAttempts, sql);
            ctx.Steps.Add(new AgentStep
            {
                Type = "sql_execution",
                Description = $"Query execution failed (attempt {ctx.SqlAttempts}): {ex.Message}",
                Detail = sql,
                Success = false
            });
            return JsonSerializer.Serialize(new
            {
                error = ex.Message,
                hint = "Analyze the error, fix the SQL, and call execute_sql again."
            });
        }
    }

    private void HandlePresentResults(JsonElement input, AgentContext ctx)
    {
        if (input.TryGetProperty("insights", out var insightsProp) && insightsProp.ValueKind == JsonValueKind.Array)
        {
            ctx.Insights = insightsProp.EnumerateArray()
                .Select(e => e.GetString() ?? "")
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }

        if (input.TryGetProperty("visualization", out var vizProp) && vizProp.ValueKind == JsonValueKind.Object)
        {
            ctx.Visualization = new VisualizationRecommendation
            {
                ChartType = vizProp.TryGetProperty("chartType", out var ct) ? ct.GetString() ?? "Table" : "Table",
                XAxisColumn = vizProp.TryGetProperty("xAxisColumn", out var xa) ? xa.GetString() ?? "" : "",
                YAxisColumns = vizProp.TryGetProperty("yAxisColumns", out var ya) && ya.ValueKind == JsonValueKind.Array
                    ? ya.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => s != "").ToList()
                    : new List<string>(),
                Title = vizProp.TryGetProperty("title", out var t) ? t.GetString() ?? "" : ""
            };
        }

        if (input.TryGetProperty("assumptions", out var assumptionsProp) && assumptionsProp.ValueKind == JsonValueKind.Array)
        {
            ctx.Assumptions = assumptionsProp.EnumerateArray()
                .Select(e => e.GetString() ?? "")
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }

        if (input.TryGetProperty("limitations", out var limitationsProp) && limitationsProp.ValueKind == JsonValueKind.Array)
        {
            ctx.Limitations = limitationsProp.EnumerateArray()
                .Select(e => e.GetString() ?? "")
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }

        ctx.Steps.Add(new AgentStep
        {
            Type = "presentation",
            Description = $"Analysis complete with {ctx.Insights.Count} insight(s)",
            Success = true
        });
    }

    private async Task<JsonElement> CallClaude(string systemPrompt, object[] tools, List<object> messages)
    {
        var requestBody = new
        {
            model = Model,
            max_tokens = 8192,
            system = systemPrompt,
            tools,
            messages
        };

        var request = new HttpRequestMessage(HttpMethod.Post, AnthropicApiUrl);
        request.Content = JsonContent.Create(requestBody, options: new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        });

        var response = await _httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Claude API error ({response.StatusCode}): {errorBody}");
        }

        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private string BuildSystemPrompt(DatabaseType dbType)
    {
        var dialectNotes = dbType switch
        {
            DatabaseType.SqlServer => "SQL Server: Use TOP N (not LIMIT), GETDATE(), DATEADD/DATEDIFF, FORMAT(), ISNULL(), [brackets] for reserved words.",
            DatabaseType.PostgreSql => "PostgreSQL: Use LIMIT N, NOW(), EXTRACT(), :: for casting, double-quotes for reserved words.",
            DatabaseType.MySql => "MySQL: Use LIMIT N, NOW()/CURDATE(), DATE_SUB/DATE_ADD, backticks for reserved words.",
            _ => ""
        };

        return $@"You are DataLens AI, an enterprise data analyst agent. You autonomously explore databases, generate SQL, execute queries, and deliver insights — all from a single natural-language question.

WORKFLOW (follow this order):
1. Call discover_schema to understand the database structure (tables, columns, PKs, FKs).
2. Identify the most relevant tables and join paths for the user's question.
3. Generate a safe SQL SELECT query and call execute_sql.
4. If execution fails, read the error carefully, fix your SQL, and call execute_sql again (up to 3 total attempts).
5. Once you have results, analyze them and call present_results with insights, visualization config, and any assumptions/limitations.

SQL RULES:
- ONLY generate SELECT statements. Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE.
- Database dialect: {dbType}. {dialectNotes}
- Use meaningful column aliases (e.g., AS total_revenue, AS customer_name).
- Qualify columns with table aliases to avoid ambiguity (e.g., o.amount, c.name).
- Prefer aggregated results (COUNT, SUM, AVG, MAX, MIN, GROUP BY) over raw record dumps.
- Include ORDER BY for ranked/sorted results.
- Always include a row limit: TOP 100 or LIMIT 100 for aggregations, TOP 500 or LIMIT 500 for detail queries.
- Use JOINs leveraging foreign key relationships from the schema.
- Handle NULLs gracefully (COALESCE / ISNULL).

ANALYSIS RULES:
- Write insights in plain English for non-technical users.
- Highlight the most significant finding first.
- Mention totals, percentages, trends, outliers, or comparisons where relevant.
- If results are empty, explain why and suggest what the user could try differently.

VISUALIZATION RULES:
- Bar: category comparisons (≤20 categories)
- Line: time series or trends
- Pie: parts-of-whole (≤8 slices)
- Area: cumulative trends
- Table: complex multi-column data or when no chart fits well
- Choose x/y/series columns that match the actual result column aliases.

SAFETY:
- You have read-only access. Query validation will block any unsafe operations.
- Row counts are capped automatically. Do not try to circumvent limits.";
    }

    private object[] BuildToolDefinitions()
    {
        return new object[]
        {
            new
            {
                name = "discover_schema",
                description = "Discover the database schema including all tables, columns (with data types and nullability), primary keys, and foreign key relationships. Call this first before generating any SQL.",
                input_schema = new
                {
                    type = "object",
                    properties = new { },
                    required = Array.Empty<string>()
                }
            },
            new
            {
                name = "execute_sql",
                description = "Execute a read-only SQL SELECT query against the database. The query is validated for safety before execution. If it fails, you'll receive an error message — analyze it, fix the SQL, and try again.",
                input_schema = new
                {
                    type = "object",
                    properties = new
                    {
                        sql = new { type = "string", description = "The SQL SELECT query to execute" },
                        explanation = new { type = "string", description = "Brief plain-English explanation of what this query does" }
                    },
                    required = new[] { "sql", "explanation" }
                }
            },
            new
            {
                name = "present_results",
                description = "Present the final analysis to the user after executing a successful query. Include data insights, chart configuration, and any assumptions or limitations.",
                input_schema = new
                {
                    type = "object",
                    properties = new
                    {
                        insights = new
                        {
                            type = "array",
                            items = new { type = "string" },
                            description = "2-5 key insight bullets in plain English based on the query results"
                        },
                        visualization = new
                        {
                            type = "object",
                            description = "Chart configuration for visualizing the results",
                            properties = new
                            {
                                chartType = new
                                {
                                    type = "string",
                                    @enum = new[] { "Bar", "Line", "Pie", "Area", "Table" },
                                    description = "The recommended chart type"
                                },
                                xAxisColumn = new { type = "string", description = "Result column for the X axis" },
                                yAxisColumns = new
                                {
                                    type = "array",
                                    items = new { type = "string" },
                                    description = "Result column(s) for the Y axis values"
                                },
                                title = new { type = "string", description = "Descriptive chart title" }
                            },
                            required = new[] { "chartType", "xAxisColumn", "yAxisColumns", "title" }
                        },
                        assumptions = new
                        {
                            type = "array",
                            items = new { type = "string" },
                            description = "Assumptions made during analysis (e.g., date range defaults, column interpretations)"
                        },
                        limitations = new
                        {
                            type = "array",
                            items = new { type = "string" },
                            description = "Limitations or caveats about the analysis"
                        }
                    },
                    required = new[] { "insights", "visualization" }
                }
            }
        };
    }

    private string FormatSchemaForAgent(SchemaInfo schema)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"DATABASE SCHEMA ({schema.Tables.Count} tables):");
        sb.AppendLine(new string('=', 50));

        foreach (var table in schema.Tables)
        {
            sb.AppendLine($"\nTABLE: {table.Schema}.{table.Name}");
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
                    sb.AppendLine($"    - {fk.Column} → {fk.ReferencedTable}.{fk.ReferencedColumn}");
            }
        }

        return sb.ToString();
    }

    private string FormatResultsForAgent(QueryResult result)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Query returned {result.RowCount} row(s) in {result.ExecutionTimeMs}ms.");
        if (result.IsTruncated)
            sb.AppendLine($"(Results truncated. Showing {result.RowCount} of {result.TotalRowCount} total rows.)");

        sb.AppendLine($"Columns: {string.Join(", ", result.Columns)}");
        sb.AppendLine();

        var maxPreview = Math.Min(result.RowCount, 30);
        sb.AppendLine($"Data preview (first {maxPreview} rows):");

        var rows = result.Data.Take(maxPreview).ToList();
        foreach (var row in rows)
        {
            var dict = (IDictionary<string, object>)row;
            var values = result.Columns.Select(c => dict.TryGetValue(c, out var v) ? v?.ToString() ?? "NULL" : "NULL");
            sb.AppendLine(string.Join(" | ", values));
        }

        return sb.ToString();
    }

    private async Task SaveHistory(string question, int databaseConfigId, AgentResponse response)
    {
        try
        {
            await _historyService.AddHistoryAsync(new QueryHistory
            {
                NaturalLanguageQuery = question,
                SqlQuery = response.SqlQuery ?? "",
                Explanation = response.Explanation,
                ChartType = response.Visualization?.ChartType ?? "Table",
                DatabaseConfigId = databaseConfigId,
                IsSuccessful = response.Success,
                ErrorMessage = response.Error
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to save agent query to history");
        }
    }
}
