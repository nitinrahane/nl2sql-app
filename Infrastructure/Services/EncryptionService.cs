using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Nl2Sql.Core.Interfaces;

namespace Nl2Sql.Infrastructure.Services;

public class EncryptionService : IEncryptionService
{
    private readonly byte[] _key;
    private readonly byte[] _iv;

    public EncryptionService(IConfiguration configuration)
    {
        // In a real enterprise app, these should be stored in a secure vault (e.g., Azure Key Vault)
        // For this implementation, we use a key from configuration or a fallback for demo purposes.
        var keyString = configuration["Encryption:Key"] ?? "EnterpriseGradeKey123456789012345"; // 32 chars for AES-256
        var ivString = configuration["Encryption:IV"] ?? "EnterpriseIV1234"; // 16 chars for AES

        _key = Encoding.UTF8.GetBytes(keyString.Substring(0, 32));
        _iv = Encoding.UTF8.GetBytes(ivString.Substring(0, 16));
    }

    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return plainText;

        using var aes = Aes.Create();
        aes.Key = _key;
        aes.IV = _iv;

        var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

        using var ms = new MemoryStream();
        using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
        {
            using (var sw = new StreamWriter(cs))
            {
                sw.Write(plainText);
            }
        }

        return Convert.ToBase64String(ms.ToArray());
    }

    public string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return cipherText;

        try
        {
            using var aes = Aes.Create();
            aes.Key = _key;
            aes.IV = _iv;

            var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

            using var ms = new MemoryStream(Convert.FromBase64String(cipherText));
            using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using var sr = new StreamReader(cs);
            
            return sr.ReadToEnd();
        }
        catch
        {
            // If decryption fails, it might be that the text was not encrypted (e.g., legacy data)
            // In a strict enterprise app, you should log this and handle it accordingly.
            return cipherText;
        }
    }
}
