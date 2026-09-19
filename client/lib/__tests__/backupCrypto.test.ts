import { createHash, randomBytes } from "node:crypto";

jest.mock("expo-crypto", () => {
  const nodeCrypto = require("node:crypto") as typeof import("node:crypto");
  return {
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: jest.fn(async (_algo: string, data: string) =>
      nodeCrypto.createHash("sha256").update(data).digest("hex"),
    ),
    getRandomBytesAsync: jest.fn(async (size: number) =>
      new Uint8Array(nodeCrypto.randomBytes(size)),
    ),
  };
});

import {
  decryptBackupPayload,
  encryptBackupPayload,
  looksLikeEncryptedBackup,
} from "../backupCrypto";

describe("backupCrypto", () => {
  it("roundtrips encrypt → decrypt", async () => {
    const plaintext = JSON.stringify({
      schema_version: 1,
      hello: "world",
      n: 42,
    });
    const envelope = await encryptBackupPayload(plaintext, "test-pass");
    expect(looksLikeEncryptedBackup(envelope)).toBe(true);
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
    parsed.ciphertext_b64 = Buffer.from("tampered").toString("base64");
    await expect(
      decryptBackupPayload(JSON.stringify(parsed), "correct-horse"),
    ).rejects.toThrow(/authentication failed|Corrupt backup/);
  });

  it("rejects short passphrase", async () => {
    await expect(encryptBackupPayload("{}", "abc")).rejects.toThrow(/4/);
  });
});

// silence unused in case tree-shaking analyzers complain in editors
void createHash;
void randomBytes;
