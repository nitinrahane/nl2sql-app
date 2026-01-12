# NL2SQL App - AI Powered Database Explorer

An enterprise-grade application that allows users to query databases using natural language. It generates optimized SQL, executes queries, provides data visualizations, and maintains a history of interactions.

## 🚀 Features

- **Natural Language to SQL**: Powered by Anthropic's Claude 3.5 Sonnet to generate accurate SQL queries.
- **Dynamic Database Connections**: Support for SQL Server, PostgreSQL, and MySQL.
- **Smart Visualizations**: Automatically recommends and renders charts (Line, Bar, Pie) based on query results.
- **Query History**: Track and manage previous queries and their results.
- **Security First**: Encrypted connection strings and SQL validation.
- **Professional UI**: Modern, responsive dashboard built with React, Tailwind CSS, and Shadcn UI.

## 🛠 Tech Stack

### Backend

- **Framework**: .NET 10 Web API
- **ORM**: Entity Framework Core
- **AI Integration**: Claude 3.5 Sonnet (Anthropic API)
- **Logging**: Serilog
- **Authentication**: JWT Ready

### Frontend

- **Framework**: React 18 (TypeScript)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Components**: Shadcn UI & Lucide Icons
- **State Management**: React Hooks & Axios

## 📋 Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js (v18+)](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/) (or any supported DB for the application storage)
- Anthropic API Key

## 🛠 Setup & Installation

### 1. Backend Setup

```bash
cd Api
# Copy and update appsettings.json with your settings
# dotnet restore
# dotnet run
```

*Note: Ensure you set your `Anthropic:ApiKey` in `appsettings.json`.*

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev
```

The client will be running at `http://localhost:5173`.

## 🔒 Security Note

- **No Secrets**: API keys and sensitive connection strings are scrubbed or encrypted.
- **Validation**: Generated SQL is validated against a schema before execution.

## 📄 License

MIT
