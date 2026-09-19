/**
 * Path B — passphrase-based encrypt/decrypt for local progress backups.
 *
 * Format PKB2: PBKDF2-SHA256 (210k iters) + AES-256-GCM (AEAD).
 * PKB1 (custom SHA-256 XOR + weak KDF) is rejected with a clear safe-fail —
 * re-export from a current build. Min passphrase length: 8.
 */

import * as ExpoCrypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const MAGIC = "PKB2";
const LEGACY_MAGIC = "PKB1";
const PBKDF2_ITERATIONS = 210_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
export const MIN_PASSPHRASE_LENGTH = 8;

export type EncryptedBackupEnvelope = {
  magic: typeof MAGIC;
  schema_version: number;
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt_b64: string;
  iv_b64: string;
  ciphertext_b64: string;
};

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function b64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function utf8ToBytes(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  return new Uint8Array(Buffer.from(text, "utf8"));
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(bytes).toString("utf8");
}

async function randomBytes(size: number): Promise<Uint8Array> {
  return ExpoCrypto.getRandomBytesAsync(size);
}

function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Uint8Array {
  return pbkdf2(sha256, passphrase, salt, {
    c: iterations,
    dkLen: KEY_BYTES,
  });
}

export async function encryptBackupPayload(
  plaintextJson: string,
  passphrase: string,
  schemaVersion: number = 1,
): Promise<string> {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
    );
  }
  const salt = await randomBytes(SALT_BYTES);
  const iv = await randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const aes = gcm(key, iv);
  const cipherBytes = aes.encrypt(utf8ToBytes(plaintextJson));
  const envelope: EncryptedBackupEnvelope = {
    magic: MAGIC,
    schema_version: schemaVersion,
    kdf: "pbkdf2-sha256",
    iterations: PBKDF2_ITERATIONS,
    salt_b64: bytesToB64(salt),
    iv_b64: bytesToB64(iv),
    ciphertext_b64: bytesToB64(cipherBytes),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackupPayload(
  envelopeText: string,
  passphrase: string,
): Promise<string> {
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(envelopeText) as Record<string, unknown>;
  } catch {
    throw new Error("Corrupt backup: not valid JSON");
  }

  if (envelope.magic === LEGACY_MAGIC) {
    throw new Error(
      "Corrupt backup: unsupported format (PKB1). Re-export with a current app build (PKB2).",
    );
  }
  if (envelope.magic !== MAGIC) {
    throw new Error("Corrupt backup: unknown format");
  }

  const saltB64 = envelope.salt_b64;
  const ivB64 = envelope.iv_b64;
  const ciphertextB64 = envelope.ciphertext_b64;
  const iterations = envelope.iterations;
  if (
    typeof saltB64 !== "string" ||
    typeof ivB64 !== "string" ||
    typeof ciphertextB64 !== "string" ||
    typeof iterations !== "number" ||
    !Number.isFinite(iterations) ||
    iterations < 100_000
  ) {
    throw new Error("Corrupt backup: missing fields");
  }

  const salt = b64ToBytes(saltB64);
  const iv = b64ToBytes(ivB64);
  const cipherBytes = b64ToBytes(ciphertextB64);
  if (iv.length !== IV_BYTES) {
    throw new Error("Corrupt backup: invalid IV");
  }

  const key = deriveKey(passphrase, salt, iterations);
  try {
    const aes = gcm(key, iv);
    const plainBytes = aes.decrypt(cipherBytes);
    return bytesToUtf8(plainBytes);
  } catch {
    throw new Error(
      "Corrupt backup: authentication failed (wrong passphrase or tampered file)",
    );
  }
}

/** True when text looks like a PKB2 (or legacy PKB1) envelope. */
export function looksLikeEncryptedBackup(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { magic?: string };
    return parsed?.magic === MAGIC || parsed?.magic === LEGACY_MAGIC;
  } catch {
    return false;
  }
}
