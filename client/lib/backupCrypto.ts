/**
 * Path B — passphrase-based encrypt/decrypt for local progress backups.
 * Uses SHA-256 keystream + HMAC-SHA256 (encrypt-then-MAC) via expo-crypto
 * digests so no native AES module is required. Safe-fail on corrupt/tampered.
 */

import * as Crypto from "expo-crypto";

const MAGIC = "PKB1";
const PBKDF_ROUNDS = 256;
const SALT_BYTES = 16;

export type EncryptedBackupEnvelope = {
  magic: typeof MAGIC;
  schema_version: number;
  salt_b64: string;
  ciphertext_b64: string;
  mac_b64: string;
};

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa available in RN / Jest jsdom; Buffer fallback for Node.
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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

async function deriveKeyHex(passphrase: string, saltB64: string): Promise<string> {
  let acc = `${passphrase}:${saltB64}`;
  for (let i = 0; i < PBKDF_ROUNDS; i++) {
    acc = await sha256Hex(`${acc}:${i}`);
  }
  return acc;
}

async function keyedMacHex(keyHex: string, messageB64: string): Promise<string> {
  return sha256Hex(`${keyHex}:mac:${messageB64}`);
}

async function keystreamBytes(
  keyHex: string,
  length: number,
): Promise<Uint8Array> {
  const out = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  while (offset < length) {
    const block = hexToBytes(await sha256Hex(`${keyHex}:ks:${counter}`));
    const n = Math.min(block.length, length - offset);
    out.set(block.subarray(0, n), offset);
    offset += n;
    counter += 1;
  }
  return out;
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i]! ^ b[i]!;
  }
  return out;
}

export async function encryptBackupPayload(
  plaintextJson: string,
  passphrase: string,
  schemaVersion: number = 1,
): Promise<string> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error("Passphrase must be at least 4 characters");
  }
  const salt = await Crypto.getRandomBytesAsync(SALT_BYTES);
  const saltB64 = bytesToB64(salt);
  const keyHex = await deriveKeyHex(passphrase, saltB64);
  const plainBytes = utf8ToBytes(plaintextJson);
  const ks = await keystreamBytes(keyHex, plainBytes.length);
  const cipherBytes = xorBytes(plainBytes, ks);
  const ciphertextB64 = bytesToB64(cipherBytes);
  const macHex = await keyedMacHex(keyHex, ciphertextB64);
  const envelope: EncryptedBackupEnvelope = {
    magic: MAGIC,
    schema_version: schemaVersion,
    salt_b64: saltB64,
    ciphertext_b64: ciphertextB64,
    mac_b64: bytesToB64(hexToBytes(macHex)),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackupPayload(
  envelopeText: string,
  passphrase: string,
): Promise<string> {
  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(envelopeText) as EncryptedBackupEnvelope;
  } catch {
    throw new Error("Corrupt backup: not valid JSON");
  }
  if (envelope.magic !== MAGIC) {
    throw new Error("Corrupt backup: unknown format");
  }
  if (
    typeof envelope.salt_b64 !== "string" ||
    typeof envelope.ciphertext_b64 !== "string" ||
    typeof envelope.mac_b64 !== "string"
  ) {
    throw new Error("Corrupt backup: missing fields");
  }
  const keyHex = await deriveKeyHex(passphrase, envelope.salt_b64);
  const expectedMacHex = await keyedMacHex(keyHex, envelope.ciphertext_b64);
  const expectedMacB64 = bytesToB64(hexToBytes(expectedMacHex));
  if (expectedMacB64 !== envelope.mac_b64) {
    throw new Error("Corrupt backup: authentication failed (wrong passphrase or tampered file)");
  }
  const cipherBytes = b64ToBytes(envelope.ciphertext_b64);
  const ks = await keystreamBytes(keyHex, cipherBytes.length);
  const plainBytes = xorBytes(cipherBytes, ks);
  return bytesToUtf8(plainBytes);
}

/** True when text looks like a PKB1 envelope (not plaintext JSON payload). */
export function looksLikeEncryptedBackup(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { magic?: string };
    return parsed?.magic === MAGIC;
  } catch {
    return false;
  }
}
