# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

NL2SQL App — an AI-powered database explorer with a .NET 10 backend API and a React/TypeScript frontend. See `README.md` for full feature list and tech stack.

### Services

| Service | Port | Start command |
|---------|------|---------------|
| Backend API | 5001 | `cd Api && dotnet run --launch-profile http` |
| Frontend (Vite) | 5173 | `cd client && npm run dev` |

### Key commands

- **Restore backend:** `dotnet restore` (from repo root)
- **Build backend:** `dotnet build` (from repo root)
- **Run tests:** `dotnet test` (from repo root; xUnit, 1 test project in `Tests/`)
- **Frontend lint:** `cd client && npm run lint` (ESLint; has pre-existing lint errors in `ChartViewer.tsx` and `ConnectionManager.tsx`)
- **Frontend build:** `cd client && npm run build` (tsc + vite)

### Non-obvious caveats

- The backend uses **EF Core InMemory database** for its own storage — no external database is needed for the app to run. Data resets on restart.
- The frontend hardcodes the API base URL to `http://localhost:5001/api` in `client/src/services/api.ts`.
- The `Pomelo.EntityFrameworkCore.MySql` package (v9.0.0) emits NU1608 warnings because it targets EF Core 9.x while the project uses EF Core 10.x. These warnings are harmless and pre-existing.
- The `Anthropic:ApiKey` in `Api/appsettings.json` must be set for the NL-to-SQL generation feature to work. Without it, the app starts and CRUD/history endpoints work, but AI query generation will fail.
- The backend must be started with `ASPNETCORE_ENVIRONMENT=Development` (the `http` launch profile sets this) to enable Swagger UI at `/swagger`.
- `.NET 10 SDK` is a system dependency installed via `sudo apt-get install -y dotnet-sdk-10.0`. It is not managed by the update script.
