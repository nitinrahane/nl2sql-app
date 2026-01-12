using Microsoft.AspNetCore.Mvc;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SchemaController : ControllerBase
{
    private readonly ISchemaService _schemaService;
    private readonly IDatabaseConfigService _configService;

    public SchemaController(ISchemaService schemaService, IDatabaseConfigService configService)
    {
        _schemaService = schemaService;
        _configService = configService;
    }

    [HttpGet("{configId}")]
    public async Task<ActionResult<SchemaInfo>> GetSchema(int configId)
    {
        var config = await _configService.GetConfigByIdAsync(configId);
        if (config == null)
        {
            return NotFound("Database configuration not found");
        }

        try
        {
            var schema = await _schemaService.GetSchemaInfoAsync(config);
            return Ok(schema);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error retrieving schema: {ex.Message}");
        }
    }
}
