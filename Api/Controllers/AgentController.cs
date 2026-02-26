using Microsoft.AspNetCore.Mvc;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AgentController : ControllerBase
{
    private readonly IAgentService _agentService;
    private readonly ILogger<AgentController> _logger;

    public AgentController(IAgentService agentService, ILogger<AgentController> logger)
    {
        _agentService = agentService;
        _logger = logger;
    }

    [HttpPost("ask")]
    public async Task<ActionResult<AgentResponse>> Ask([FromBody] AgentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
            return BadRequest(new { error = "Question is required" });

        _logger.LogInformation("Agent request: {Question} (db: {DbId})", request.Question, request.DatabaseConfigId);

        var response = await _agentService.AskAsync(request.Question, request.DatabaseConfigId);
        return Ok(response);
    }
}
