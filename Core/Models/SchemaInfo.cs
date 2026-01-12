namespace Nl2Sql.Core.Models;

public class SchemaInfo
{
    public List<TableInfo> Tables { get; set; } = new();
}

public class TableInfo
{
    public string Name { get; set; } = string.Empty;
    public string Schema { get; set; } = string.Empty;
    public List<ColumnInfo> Columns { get; set; } = new();
    public List<ForeignKeyInfo> ForeignKeys { get; set; } = new();
}

public class ColumnInfo
{
    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public bool IsNullable { get; set; }
    public bool IsPrimaryKey { get; set; }
}

public class ForeignKeyInfo
{
    public string Column { get; set; } = string.Empty;
    public string ReferencedTable { get; set; } = string.Empty;
    public string ReferencedColumn { get; set; } = string.Empty;
}
