using Dapper;
using Microsoft.Extensions.Caching.Memory;
using Nl2Sql.Core.Entities;
using Nl2Sql.Core.Enums;
using Nl2Sql.Core.Interfaces;
using Nl2Sql.Core.Models;

namespace Nl2Sql.Infrastructure.Services;

public class SchemaService : ISchemaService
{
    private class RawColumnInfo
    {
        public string TableName { get; set; } = string.Empty;
        public string SchemaName { get; set; } = string.Empty;
        public string ColumnName { get; set; } = string.Empty;
        public string DataType { get; set; } = string.Empty;
        public object IsNullable { get; set; }
    }

    private readonly IDatabaseConnectionFactory _connectionFactory;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);

    public SchemaService(IDatabaseConnectionFactory connectionFactory, IMemoryCache cache)
    {
        _connectionFactory = connectionFactory;
        _cache = cache;
    }

    public async Task<SchemaInfo> GetSchemaInfoAsync(DatabaseConfig config)
    {
        string cacheKey = $"schema_{config.Id}_{config.ConnectionString.GetHashCode()}";
        
        if (_cache.TryGetValue(cacheKey, out SchemaInfo? cachedSchema) && cachedSchema != null)
        {
            return cachedSchema;
        }

        using var connection = _connectionFactory.CreateConnection(config.Type, config.ConnectionString);
        
        var schemaInfo = new SchemaInfo();
        
        string tableQuery = GetTableQuery(config.Type);
        string columnQuery = GetColumnQuery(config.Type);

        var tables = await connection.QueryAsync<TableInfo>(tableQuery);
        var columns = await connection.QueryAsync<RawColumnInfo>(columnQuery);

        foreach (var table in tables)
        {
            var tableColumns = columns
                .Where(c => c.TableName == table.Name && c.SchemaName == table.Schema)
                .Select(c => new ColumnInfo
                {
                    Name = c.ColumnName,
                    DataType = c.DataType,
                    IsNullable = IsNullableValue(c.IsNullable),
                    IsPrimaryKey = false // To be implemented with key query
                })
                .ToList();

            table.Columns = tableColumns;
            schemaInfo.Tables.Add(table);
        }

        _cache.Set(cacheKey, schemaInfo, CacheDuration);
        return schemaInfo;
    }

    private string GetTableQuery(DatabaseType type)
    {
        return type switch
        {
            DatabaseType.SqlServer => 
                @"SELECT TABLE_NAME as Name, TABLE_SCHEMA as [Schema] 
                  FROM INFORMATION_SCHEMA.TABLES 
                  WHERE TABLE_TYPE = 'BASE TABLE'",
            
            DatabaseType.PostgreSql => 
                @"SELECT table_name as Name, table_schema as Schema 
                  FROM information_schema.tables 
                  WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('information_schema', 'pg_catalog')",
            
            DatabaseType.MySql => 
                @"SELECT TABLE_NAME as Name, TABLE_SCHEMA as `Schema` 
                  FROM INFORMATION_SCHEMA.TABLES 
                  WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = DATABASE()",
            
            _ => throw new ArgumentException("Unsupported database type")
        };
    }

    private string GetColumnQuery(DatabaseType type)
    {
        return type switch
        {
            DatabaseType.SqlServer => 
                @"SELECT TABLE_NAME as TableName, TABLE_SCHEMA as SchemaName, COLUMN_NAME as ColumnName, DATA_TYPE as DataType, IS_NULLABLE as IsNullable 
                  FROM INFORMATION_SCHEMA.COLUMNS",
            
            DatabaseType.PostgreSql => 
                @"SELECT table_name as TableName, table_schema as SchemaName, column_name as ColumnName, data_type as DataType, is_nullable as IsNullable 
                  FROM information_schema.columns 
                  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')",
            
            DatabaseType.MySql => 
                @"SELECT TABLE_NAME as TableName, TABLE_SCHEMA as SchemaName, COLUMN_NAME as ColumnName, DATA_TYPE as DataType, IS_NULLABLE as IsNullable 
                  FROM INFORMATION_SCHEMA.COLUMNS 
                  WHERE TABLE_SCHEMA = DATABASE()",
            
            _ => throw new ArgumentException("Unsupported database type")
        };
    }

    private bool IsNullableValue(dynamic value)
    {
        if (value == null) return false;
        string s = value.ToString().ToUpper();
        return s == "YES" || s == "1" || s == "TRUE";
    }
}
