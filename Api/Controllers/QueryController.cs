using Microsoft.AspNetCore.Mvc;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QueryController : ControllerBase
{
    private readonly IAIService _aiService;
    private readonly ISchemaService _schemaService;
    private readonly IDatabaseConfigService _configService;
    private readonly ISqlValidationService _validationService;
    private readonly IQueryExecutionService _executionService;
    private readonly IQueryHistoryService _historyService;
    private readonly ILogger<QueryController> _logger;

    public QueryController(
        IAIService aiService, 
        ISchemaService schemaService, 
        IDatabaseConfigService configService,
        ISqlValidationService validationService,
        IQueryExecutionService executionService,
        IQueryHistoryService historyService,
        ILogger<QueryController> logger)
    {
        _aiService = aiService;
        _schemaService = schemaService;
        _configService = configService;
        _validationService = validationService;
        _executionService = executionService;
        _historyService = historyService;
        _logger = logger;
    }

    [HttpPost("generate")]
    public async Task<ActionResult<AiQueryResponse>> GenerateSql([FromBody] AiQueryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NaturalLanguageQuery))
            return BadRequest(new { error = "Query text is required" });

        var config = await _configService.GetConfigByIdAsync(request.DatabaseConfigId);
        if (config == null)
            return NotFound(new { error = "Database configuration not found" });

        try
        {
            var schema = await _schemaService.GetSchemaInfoAsync(config);
            var response = await _aiService.GenerateSqlAsync(request.NaturalLanguageQuery, schema, config.Type);

            bool isSuccessful = !response.SqlQuery.StartsWith("ERROR");
            string? validationError = null;

            if (isSuccessful)
            {
                if (!_validationService.ValidateQuery(response.SqlQuery, config.Type, out validationError))
                {
                    isSuccessful = false;
                    response.SqlQuery = $"ERROR: Validation failed. {validationError}";
                    response.Explanation = "The generated query was blocked by security policies. Please try rephrasing.";
                }
            }

            await _historyService.AddHistoryAsync(new Nl2Sql.Core.Entities.QueryHistory
            {
                NaturalLanguageQuery = request.NaturalLanguageQuery,
                SqlQuery = response.SqlQuery,
                Explanation = response.Explanation,
                ChartType = response.Visualization?.ChartType ?? "Table",
                DatabaseConfigId = request.DatabaseConfigId,
                IsSuccessful = isSuccessful,
                ErrorMessage = validationError
            });

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating SQL for query: {Query}", request.NaturalLanguageQuery);
            return StatusCode(500, new { error = "Failed to generate SQL. Please try again.", details = ex.Message });
        }
    }

    [HttpPost("execute")]
    public async Task<ActionResult<QueryResult>> ExecuteQuery([FromBody] ExecuteQueryRequest request)
    {
        var config = await _configService.GetConfigByIdAsync(request.DatabaseConfigId);
        if (config == null)
            return NotFound(new { error = "Database configuration not found" });

        if (!_validationService.ValidateQuery(request.SqlQuery, config.Type, out var validationError))
            return BadRequest(new { error = $"Query validation failed: {validationError}" });

        try
        {
            var result = await _executionService.ExecuteQueryAsync(request.SqlQuery, config);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing query: {Query}", request.SqlQuery);
            return StatusCode(500, new { error = "Failed to execute query.", details = ex.Message });
        }
    }

    [HttpPost("suggest")]
    public async Task<ActionResult<List<string>>> SuggestQuestions([FromBody] AiQueryRequest request)
    {
        var config = await _configService.GetConfigByIdAsync(request.DatabaseConfigId);
        if (config == null)
            return NotFound(new { error = "Database configuration not found" });

        try
        {
            var schema = await _schemaService.GetSchemaInfoAsync(config);
            var suggestions = await _aiService.GenerateSuggestionsAsync(schema, config.Type);
            return Ok(suggestions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating suggestions");
            return StatusCode(500, new { error = "Failed to generate suggestions.", details = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<Nl2Sql.Core.Entities.QueryHistory>>> GetHistory([FromQuery] int limit = 50)
    {
        var history = await _historyService.GetHistoryAsync(limit);
        return Ok(history);
    }

    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        await _historyService.ClearHistoryAsync();
        return NoContent();
    }
}
