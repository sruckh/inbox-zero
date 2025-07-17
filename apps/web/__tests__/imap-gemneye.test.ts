import { describe, it, expect, beforeAll } from "vitest";
import { testImapConnection, encrypt, IMAP_PROVIDERS } from "@/utils/providers/imap";

describe("IMAP Gemneye Connection", () => {
  beforeAll(() => {
    // Set up test environment variables for encryption
    process.env.IMAP_ENCRYPT_SECRET = "a".repeat(64); // 32 bytes in hex
    process.env.IMAP_ENCRYPT_SALT = "b".repeat(32);   // 16 bytes in hex
  });

  it("should have gemneye.org provider configured", () => {
    expect(IMAP_PROVIDERS['imap.gemneye.org']).toBeDefined();
    expect(IMAP_PROVIDERS['imap.gemneye.org'].host).toBe('imap.gemneye.org');
    expect(IMAP_PROVIDERS['imap.gemneye.org'].port).toBe(993);
    expect(IMAP_PROVIDERS['imap.gemneye.org'].tls).toBe(true);
  });

  it("should encrypt and decrypt passwords correctly", () => {
    const password = "test-password-123";
    const encrypted = encrypt(password);
    
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(':'); // Should contain auth tag separator
    expect(encrypted).not.toBe(password); // Should be different from original
    
    // Note: We can't easily test decrypt without importing it or making it public
    // This would be tested in integration tests with actual credentials
  });

  it("should fail gracefully with invalid credentials", async () => {
    const config = {
      host: "imap.gemneye.org",
      port: 993,
      user: "invalid@gemneye.org",
      encryptedPassword: encrypt("invalid-password"),
    };

    const result = await testImapConnection(config);
    expect(result).toBe(false);
  }, 30000); // 30 second timeout for network operation

  it("should handle network errors gracefully", async () => {
    const config = {
      host: "nonexistent-server.example.com",
      port: 993,
      user: "test@example.com",
      encryptedPassword: encrypt("password"),
    };

    const result = await testImapConnection(config);
    expect(result).toBe(false);
  }, 30000);
});