using Nl2Sql.Core.Models;

namespace Nl2Sql.Core.Interfaces;

public interface IAgentService
{
    Task<AgentResponse> AskAsync(string question, int databaseConfigId);
}
