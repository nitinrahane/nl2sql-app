# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

DataLens AI — a production-grade agentic AI database explorer. Uses Claude's tool-use API to autonomously discover database schema, generate SQL from natural language, execute queries with self-healing retry, and deliver business insights with visualizations. Built with .NET 10 backend and React/TypeScript frontend.

### Architecture: Agentic Flow

The core of the application is `AgentOrchestrator` (`Infrastructure/Services/AgentOrchestrator.cs`). It implements a **Claude tool-use loop** with three tools:

| Tool | Purpose | Called by Claude when... |
|------|---------|------------------------|
| `discover_schema` | Auto-discovers tables, columns, PKs, FKs from the live database | Agent needs to understand the DB structure (always first) |
| `execute_sql` | Validates (read-only) and executes SQL via Dapper | Agent has generated a query to run |
| `present_results` | Captures insights, visualization config, assumptions, limitations | Agent is ready to present final analysis |

The loop runs until Claude ends its turn or 10 iterations are reached. If SQL execution fails, Claude sees the error and self-corrects (up to 3 SQL attempts).

The endpoint is `POST /api/Agent/ask` with body `{ "question": "...", "databaseConfigId": N }`. The old generate/execute endpoints still exist at `/api/Query/*` for backward compatibility.

### Services

| Service | Port | Start command |
|---------|------|---------------|
| Backend API | 5001 | `cd Api && Anthropic__ApiKey="$ANTHROPIC_API_KEY" ASPNETCORE_ENVIRONMENT=Development dotnet run --launch-profile http` |
| Frontend (Vite) | 5173 | `cd client && npm run dev` |
| PostgreSQL | 5432 | `sudo service postgresql start` (if using a local test DB) |

### Key commands

- **Restore backend:** `dotnet restore` (from repo root)
- **Build backend:** `dotnet build` (from repo root)
- **Run tests:** `dotnet test` (from repo root)
- **Frontend build:** `cd client && npm run build` (tsc + vite)

### Non-obvious caveats

- The `Anthropic__ApiKey` environment variable must be set when starting the backend. It maps to `Anthropic:ApiKey` in .NET configuration. Without it, the agent endpoint returns an auth error.
- The app uses **EF Core InMemory database** for its own config/history storage — data resets on backend restart.
- The frontend hardcodes the API base URL to `http://localhost:5001/api` in `client/src/services/api.ts`.
- The `Pomelo.EntityFrameworkCore.MySql` package emits NU1608 warnings (harmless, pre-existing).
- Agent calls take 15-30 seconds because the orchestrator makes multiple Claude API round-trips (discover_schema → execute_sql → present_results). The frontend timeout is set to 120s.
- `.NET 10 SDK` is a system dependency installed via `sudo apt-get install -y dotnet-sdk-10.0`.
- The `QueryController.suggest` endpoint expects an `AiQueryRequest` body (with `databaseConfigId`) not a raw int.
- To test end-to-end locally, install PostgreSQL (`sudo apt-get install -y postgresql`), start it (`sudo service postgresql start`), create a test database, and register it via the Connections page or API.
