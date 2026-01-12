using Microsoft.AspNetCore.Mvc;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Interfaces;

namespace Nl2Sql.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DatabaseConfigController : ControllerBase
{
    private readonly IDatabaseConfigService _service;

    public DatabaseConfigController(IDatabaseConfigService service)
    {
        _service = service;
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
}
