using System.ComponentModel.DataAnnotations;
using Nl2Sql.Core.Enums;

namespace Nl2Sql.Core.Entities;

public class DatabaseConfig
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public DatabaseType Type { get; set; }

    [Required]
    public string ConnectionString { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
