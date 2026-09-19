jest.mock("expo-crypto", () => {
  const nodeCrypto = require("node:crypto") as typeof import("node:crypto");
  return {
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: jest.fn(async (_algo: string, data: string) =>
      nodeCrypto.createHash("sha256").update(data).digest("hex"),
    ),
    getRandomBytesAsync: jest.fn(
      async (size: number) => new Uint8Array(nodeCrypto.randomBytes(size)),
    ),
  };
});

import {
  decryptBackupPayload,
  encryptBackupPayload,
  looksLikeEncryptedBackup,
  MIN_PASSPHRASE_LENGTH,
} from "../backupCrypto";

describe("backupCrypto (PKB2 AES-GCM)", () => {
  it("roundtrips encrypt → decrypt", async () => {
    const plaintext = JSON.stringify({
      schema_version: 1,
      hello: "world",
      n: 42,
    });
    const envelope = await encryptBackupPayload(plaintext, "test-pass");
    expect(looksLikeEncryptedBackup(envelope)).toBe(true);
    const parsed = JSON.parse(envelope) as { magic: string; kdf: string };
    expect(parsed.magic).toBe("PKB2");
    expect(parsed.kdf).toBe("pbkdf2-sha256");
    const decoded = await decryptBackupPayload(envelope, "test-pass");
    expect(decoded).toBe(plaintext);
  });

  it("fails closed on wrong passphrase", async () => {
    const envelope = await encryptBackupPayload('{"a":1}', "correct-horse");
    await expect(decryptBackupPayload(envelope, "wrong-pass")).rejects.toThrow(
      /authentication failed|Corrupt backup/,
    );
  });

  it("fails closed on tampered ciphertext", async () => {
    const envelope = await encryptBackupPayload('{"a":1}', "correct-horse");
    const parsed = JSON.parse(envelope) as { ciphertext_b64: string };
    parsed.ciphertext_b64 = Buffer.from("tampered-ciphertext!!").toString(
      "base64",
    );
    await expect(
      decryptBackupPayload(JSON.stringify(parsed), "correct-horse"),
    ).rejects.toThrow(/authentication failed|Corrupt backup/);
  });

  it("rejects short passphrase", async () => {
    await expect(encryptBackupPayload("{}", "abcdefg")).rejects.toThrow(
      new RegExp(String(MIN_PASSPHRASE_LENGTH)),
    );
  });

  it("safe-fails legacy PKB1 envelopes", async () => {
    const legacy = JSON.stringify({
      magic: "PKB1",
      schema_version: 1,
      salt_b64: "YWJj",
      ciphertext_b64: "ZGVm",
      mac_b64: "Z2hp",
    });
    expect(looksLikeEncryptedBackup(legacy)).toBe(true);
    await expect(decryptBackupPayload(legacy, "correct-horse")).rejects.toThrow(
      /PKB1/,
    );
  });
});
