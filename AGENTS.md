# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

DataLens AI (formerly NL2SQL App) — a production-grade AI-powered database explorer with a .NET 10 backend API and a React/TypeScript frontend. Converts natural language questions into SQL queries via Anthropic Claude, executes them, and visualizes results. See `README.md` for the original feature list.

### Services

| Service | Port | Start command |
|---------|------|---------------|
| Backend API | 5001 | `cd Api && ASPNETCORE_ENVIRONMENT=Development dotnet run --launch-profile http` |
| Frontend (Vite) | 5173 | `cd client && npm run dev` |

### Key commands

- **Restore backend:** `dotnet restore` (from repo root)
- **Build backend:** `dotnet build` (from repo root)
- **Run tests:** `dotnet test` (from repo root; xUnit, 1 test project in `Tests/`)
- **Frontend lint:** `cd client && npm run lint`
- **Frontend build:** `cd client && npm run build` (tsc + vite)

### Non-obvious caveats

- The backend uses **EF Core InMemory database** — no external database is needed for the app to run. All config/history data resets on restart.
- The frontend hardcodes the API base URL to `http://localhost:5001/api` in `client/src/services/api.ts`.
- The `Pomelo.EntityFrameworkCore.MySql` package (v9.0.0) emits NU1608 warnings because it targets EF Core 9.x while the project uses EF Core 10.x. These warnings are harmless.
- The `Anthropic:ApiKey` in `Api/appsettings.json` must be set for AI query generation. Without it the app starts fine, but the generate/suggest endpoints will throw. CRUD and history endpoints work without it.
- `.NET 10 SDK` is a system dependency installed via `sudo apt-get install -y dotnet-sdk-10.0`.
- The `QueryController.suggest` endpoint now expects an `AiQueryRequest` body (with `databaseConfigId`) instead of a raw int.
- The frontend uses a chat-based conversational interface (messages + responses, not a form). State is managed in-component, not via React Query for the conversation flow.
- The SchemaExplorer panel requires an active database connection to load table/column info.
