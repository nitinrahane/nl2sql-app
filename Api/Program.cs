using Microsoft.EntityFrameworkCore;
using Nl2Sql.Api.Middleware;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/nl2sql-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache();

// Add Infrastructure Services
builder.Services.AddRateLimiting();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        builder => builder
            .SetIsOriginAllowed(origin => true) // Allow any origin for development
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

builder.Services.AddScoped<Nl2Sql.Core.Interfaces.IDatabaseConnectionFactory, Nl2Sql.Infrastructure.Database.DatabaseConnectionFactory>();
builder.Services.AddScoped<Nl2Sql.Core.Interfaces.IEncryptionService, Nl2Sql.Infrastructure.Services.EncryptionService>();
builder.Services.AddScoped<Nl2Sql.Core.Interfaces.IDatabaseConfigService, Nl2Sql.Infrastructure.Services.DatabaseConfigService>();
builder.Services.AddScoped<Nl2Sql.Core.Interfaces.ISchemaService, Nl2Sql.Infrastructure.Services.SchemaService>();
builder.Services.AddScoped<Nl2Sql.Core.Interfaces.ISqlValidationService, Nl2Sql.Infrastructure.Services.SqlValidationService>();
builder.Services.AddScoped<Nl2Sql.Core.Interfaces.IQueryHistoryService, Nl2Sql.Infrastructure.Services.QueryHistoryService>();
builder.Services.AddScoped<Nl2Sql.Core.Interfaces.IQueryExecutionService, Nl2Sql.Infrastructure.Services.QueryExecutionService>();
builder.Services.AddHttpClient<Nl2Sql.Core.Interfaces.IAIService, Nl2Sql.Infrastructure.Services.ClaudeApiService>();


// Add DbContext
builder.Services.AddDbContext<Nl2Sql.Infrastructure.Data.AppDbContext>(options =>
    options.UseInMemoryDatabase("Nl2SqlDb"));


var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowReactApp");
app.UseRateLimiter();
app.MapControllers();

app.Run();
