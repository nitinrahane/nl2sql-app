using Dapper;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
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
        public object IsNullable { get; set; } = null!;
        public int? MaxLength { get; set; }
    }

    private class RawPrimaryKeyInfo
    {
        public string TableName { get; set; } = string.Empty;
        public string SchemaName { get; set; } = string.Empty;
        public string ColumnName { get; set; } = string.Empty;
    }

    private class RawForeignKeyInfo
    {
        public string TableName { get; set; } = string.Empty;
        public string SchemaName { get; set; } = string.Empty;
        public string ColumnName { get; set; } = string.Empty;
        public string ReferencedTable { get; set; } = string.Empty;
        public string ReferencedColumn { get; set; } = string.Empty;
        public string ConstraintName { get; set; } = string.Empty;
    }

    private readonly IDatabaseConnectionFactory _connectionFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SchemaService> _logger;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);

    public SchemaService(IDatabaseConnectionFactory connectionFactory, IMemoryCache cache, ILogger<SchemaService> logger)
    {
        _connectionFactory = connectionFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<SchemaInfo> GetSchemaInfoAsync(DatabaseConfig config)
    {
        string cacheKey = $"schema_{config.Id}";
        
        if (_cache.TryGetValue(cacheKey, out SchemaInfo? cachedSchema) && cachedSchema != null)
        {
            return cachedSchema;
        }

        using var connection = _connectionFactory.CreateConnection(config.Type, config.ConnectionString);
        
        var schemaInfo = new SchemaInfo();

        var tables = (await connection.QueryAsync<TableInfo>(GetTableQuery(config.Type))).ToList();
        var columns = (await connection.QueryAsync<RawColumnInfo>(GetColumnQuery(config.Type))).ToList();
        
        List<RawPrimaryKeyInfo> primaryKeys;
        List<RawForeignKeyInfo> foreignKeys;
        try
        {
            primaryKeys = (await connection.QueryAsync<RawPrimaryKeyInfo>(GetPrimaryKeyQuery(config.Type))).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve primary keys");
            primaryKeys = new List<RawPrimaryKeyInfo>();
        }

        try
        {
            foreignKeys = (await connection.QueryAsync<RawForeignKeyInfo>(GetForeignKeyQuery(config.Type))).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve foreign keys");
            foreignKeys = new List<RawForeignKeyInfo>();
        }

        var pkLookup = primaryKeys.ToLookup(pk => (pk.SchemaName, pk.TableName));
        var fkLookup = foreignKeys.ToLookup(fk => (fk.SchemaName, fk.TableName));

        foreach (var table in tables)
        {
            var tablePks = pkLookup[(table.Schema, table.Name)].Select(pk => pk.ColumnName).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var tableColumns = columns
                .Where(c => c.TableName == table.Name && c.SchemaName == table.Schema)
                .Select(c => new ColumnInfo
                {
                    Name = c.ColumnName,
                    DataType = c.DataType,
                    IsNullable = IsNullableValue(c.IsNullable),
                    IsPrimaryKey = tablePks.Contains(c.ColumnName),
                    MaxLength = c.MaxLength
                })
                .ToList();

            var tableFks = fkLookup[(table.Schema, table.Name)]
                .Select(fk => new ForeignKeyInfo
                {
                    Column = fk.ColumnName,
                    ReferencedTable = fk.ReferencedTable,
                    ReferencedColumn = fk.ReferencedColumn,
                    ConstraintName = fk.ConstraintName
                })
                .ToList();

            table.Columns = tableColumns;
            table.ForeignKeys = tableFks;
            schemaInfo.Tables.Add(table);
        }

        schemaInfo.TotalTableCount = schemaInfo.Tables.Count;
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
                  WHERE TABLE_TYPE = 'BASE TABLE'
                  ORDER BY TABLE_SCHEMA, TABLE_NAME",
            
            DatabaseType.PostgreSql => 
                @"SELECT table_name as Name, table_schema as Schema 
                  FROM information_schema.tables 
                  WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('information_schema', 'pg_catalog')
                  ORDER BY table_schema, table_name",
            
            DatabaseType.MySql => 
                @"SELECT TABLE_NAME as Name, TABLE_SCHEMA as `Schema` 
                  FROM INFORMATION_SCHEMA.TABLES 
                  WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = DATABASE()
                  ORDER BY TABLE_NAME",
            
            _ => throw new ArgumentException("Unsupported database type")
        };
    }

    private string GetColumnQuery(DatabaseType type)
    {
        return type switch
        {
            DatabaseType.SqlServer => 
                @"SELECT TABLE_NAME as TableName, TABLE_SCHEMA as SchemaName, 
                         COLUMN_NAME as ColumnName, DATA_TYPE as DataType, 
                         IS_NULLABLE as IsNullable, CHARACTER_MAXIMUM_LENGTH as MaxLength
                  FROM INFORMATION_SCHEMA.COLUMNS
                  ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION",
            
            DatabaseType.PostgreSql => 
                @"SELECT table_name as TableName, table_schema as SchemaName, 
                         column_name as ColumnName, data_type as DataType, 
                         is_nullable as IsNullable, character_maximum_length as MaxLength
                  FROM information_schema.columns 
                  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                  ORDER BY table_schema, table_name, ordinal_position",
            
            DatabaseType.MySql => 
                @"SELECT TABLE_NAME as TableName, TABLE_SCHEMA as SchemaName, 
                         COLUMN_NAME as ColumnName, DATA_TYPE as DataType, 
                         IS_NULLABLE as IsNullable, CHARACTER_MAXIMUM_LENGTH as MaxLength
                  FROM INFORMATION_SCHEMA.COLUMNS 
                  WHERE TABLE_SCHEMA = DATABASE()
                  ORDER BY TABLE_NAME, ORDINAL_POSITION",
            
            _ => throw new ArgumentException("Unsupported database type")
        };
    }

    private string GetPrimaryKeyQuery(DatabaseType type)
    {
        return type switch
        {
            DatabaseType.SqlServer =>
                @"SELECT kcu.TABLE_NAME as TableName, kcu.TABLE_SCHEMA as SchemaName, kcu.COLUMN_NAME as ColumnName
                  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'",

            DatabaseType.PostgreSql =>
                @"SELECT kcu.table_name as TableName, kcu.table_schema as SchemaName, kcu.column_name as ColumnName
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                  WHERE tc.constraint_type = 'PRIMARY KEY' 
                    AND kcu.table_schema NOT IN ('information_schema', 'pg_catalog')",

            DatabaseType.MySql =>
                @"SELECT kcu.TABLE_NAME as TableName, kcu.TABLE_SCHEMA as SchemaName, kcu.COLUMN_NAME as ColumnName
                  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND kcu.TABLE_SCHEMA = DATABASE()",

            _ => throw new ArgumentException("Unsupported database type")
        };
    }

    private string GetForeignKeyQuery(DatabaseType type)
    {
        return type switch
        {
            DatabaseType.SqlServer =>
                @"SELECT kcu.TABLE_NAME as TableName, kcu.TABLE_SCHEMA as SchemaName,
                         kcu.COLUMN_NAME as ColumnName, ccu.TABLE_NAME as ReferencedTable,
                         ccu.COLUMN_NAME as ReferencedColumn, tc.CONSTRAINT_NAME as ConstraintName
                  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                  JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu 
                    ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = ccu.TABLE_SCHEMA
                  WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'",

            DatabaseType.PostgreSql =>
                @"SELECT kcu.table_name as TableName, kcu.table_schema as SchemaName,
                         kcu.column_name as ColumnName, ccu.table_name as ReferencedTable,
                         ccu.column_name as ReferencedColumn, tc.constraint_name as ConstraintName
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                  JOIN information_schema.constraint_column_usage ccu 
                    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
                  WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND kcu.table_schema NOT IN ('information_schema', 'pg_catalog')",

            DatabaseType.MySql =>
                @"SELECT kcu.TABLE_NAME as TableName, kcu.TABLE_SCHEMA as SchemaName,
                         kcu.COLUMN_NAME as ColumnName, kcu.REFERENCED_TABLE_NAME as ReferencedTable,
                         kcu.REFERENCED_COLUMN_NAME as ReferencedColumn, kcu.CONSTRAINT_NAME as ConstraintName
                  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                  WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL AND kcu.TABLE_SCHEMA = DATABASE()",

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
