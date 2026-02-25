using Microsoft.AspNetCore.Mvc;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DatabaseConfigController : ControllerBase
{
    private readonly IDatabaseConfigService _service;
    private readonly IDatabaseConnectionFactory _connectionFactory;

    public DatabaseConfigController(IDatabaseConfigService service, IDatabaseConnectionFactory connectionFactory)
    {
        _service = service;
        _connectionFactory = connectionFactory;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DatabaseConfig>>> GetAll()
    {
        return Ok(await _service.GetAllConfigsAsync());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<DatabaseConfig>> GetById(int id)
    {
        var config = await _service.GetConfigByIdAsync(id);
        if (config == null)
        {
            return NotFound();
        }
        return Ok(config);
    }

    [HttpPost]
    public async Task<ActionResult<DatabaseConfig>> Create(DatabaseConfig config)
    {
        if (string.IsNullOrWhiteSpace(config.Name))
            return BadRequest("Name is required");
        if (string.IsNullOrWhiteSpace(config.ConnectionString))
            return BadRequest("Connection string is required");

        var createdConfig = await _service.CreateConfigAsync(config);
        return CreatedAtAction(nameof(GetById), new { id = createdConfig.Id }, createdConfig);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, DatabaseConfig config)
    {
        if (id != config.Id)
        {
            return BadRequest();
        }

        await _service.UpdateConfigAsync(config);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _service.DeleteConfigAsync(id);
        return NoContent();
    }

    [HttpPost("test")]
    public async Task<ActionResult<TestConnectionResponse>> TestConnection([FromBody] TestConnectionRequest request)
    {
        try
        {
            var dbType = (DatabaseType)request.Type;
            using var connection = _connectionFactory.CreateConnection(dbType, request.ConnectionString);
            
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await Task.Run(() => connection.Open());
            }

            var tableCountQuery = dbType switch
            {
                DatabaseType.SqlServer => "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'",
                DatabaseType.PostgreSql => "SELECT COUNT(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('information_schema', 'pg_catalog')",
                DatabaseType.MySql => "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = DATABASE()",
                _ => throw new ArgumentException("Unsupported database type")
            };

            using var cmd = connection.CreateCommand();
            cmd.CommandText = tableCountQuery;
            cmd.CommandTimeout = 10;
            var tableCount = Convert.ToInt32(await Task.Run(() => cmd.ExecuteScalar()));

            return Ok(new TestConnectionResponse
            {
                Success = true,
                Message = $"Connected successfully. Found {tableCount} table(s).",
                TableCount = tableCount
            });
        }
        catch (Exception ex)
        {
            return Ok(new TestConnectionResponse
            {
                Success = false,
                Message = $"Connection failed: {ex.Message}"
            });
        }
    }

    [HttpPost("{id}/test")]
    public async Task<ActionResult<TestConnectionResponse>> TestExistingConnection(int id)
    {
        var config = await _service.GetConfigByIdAsync(id);
        if (config == null)
        {
            return NotFound("Database configuration not found");
        }

        return await TestConnection(new TestConnectionRequest
        {
            Type = (int)config.Type,
            ConnectionString = config.ConnectionString
        });
    }
}
