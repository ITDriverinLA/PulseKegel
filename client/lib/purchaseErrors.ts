/**
 * P9a.2: readable error fields for every purchase, offerings and restore
 * failure. Field names and bounds match server/requestValidation.ts:
 * rcCode int 0–99, readableErrorCode ≤64, errorMessage ≤100.
 */

/** RevenueCat PURCHASES_ERROR_CODE values (react-native-purchases 10.16.0). */
export const RC_PURCHASE_NOT_ALLOWED = 3;
export const RC_PAYMENT_PENDING = 20;
export const RC_CONFIGURATION_ERROR = 23;

export interface PurchaseErrorFields {
  rcCode?: number;
  readableErrorCode?: string;
  errorMessage?: string;
  userCancelled: boolean;
}

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  userCancelled?: unknown;
  readableErrorCode?: unknown;
  userInfo?: { readableErrorCode?: unknown } | null;
};

function asErrorLike(error: unknown): ErrorLike {
  return error !== null && typeof error === "object"
    ? (error as ErrorLike)
    : {};
}

/** Parse RevenueCat's digit-string (or numeric) code into 0–99. */
export function parseRcCode(code: unknown): number | undefined {
  let n: number | undefined;
  if (typeof code === "number") n = code;
  else if (typeof code === "string" && /^\d{1,2}$/.test(code.trim())) {
    n = Number(code.trim());
  }
  if (n === undefined || !Number.isInteger(n) || n < 0 || n > 99) {
    return undefined;
  }
  return n;
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Long ids: hex/uuid-ish runs, store order ids (GPA.xxxx), long digit runs.
const ID_RE =
  /\bGPA\.[\w.-]+|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\$RCAnonymousID:[\w-]+|\b[0-9a-fA-F]{16,}\b|\b\d{8,}\b/g;

/** Trim, strip emails and ids, collapse whitespace, cap length. */
export function sanitizeErrorMessage(
  message: unknown,
  max = 100,
): string | undefined {
  if (typeof message !== "string") return undefined;
  const cleaned = message
    .replace(EMAIL_RE, "[email]")
    .replace(ID_RE, "[id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function boundedString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().slice(0, max).trim();
  return v.length > 0 ? v : undefined;
}

export function toPurchaseError(error: unknown): PurchaseErrorFields {
  const e = asErrorLike(error);
  const fields: PurchaseErrorFields = {
    userCancelled: e.userCancelled === true,
  };
  const rcCode = parseRcCode(e.code);
  if (rcCode !== undefined) fields.rcCode = rcCode;
  const readable =
    boundedString(e.userInfo?.readableErrorCode, 64) ??
    boundedString(e.readableErrorCode, 64);
  if (readable) fields.readableErrorCode = readable;
  const message = sanitizeErrorMessage(
    e.message ?? (typeof error === "string" ? error : undefined),
  );
  if (message) fields.errorMessage = message;
  return fields;
}

/** Fields for the analytics payload (drops `userCancelled: false`). */
export function purchaseErrorPayload(error: unknown): {
  rcCode?: number;
  readableErrorCode?: string;
  errorMessage?: string;
  userCancelled?: boolean;
} {
  const { userCancelled, ...rest } = toPurchaseError(error);
  return userCancelled ? { ...rest, userCancelled } : rest;
}

/** Today's `purchase_failed.errorCode`: the raw string code, if any. */
export function legacyPurchaseErrorCode(error: unknown): string | undefined {
  const code = asErrorLike(error).code;
  return typeof code === "string" && code.trim()
    ? code.trim().slice(0, 100)
    : undefined;
}

/** Today's `restore_failed.errorCode`: String(code) or "unknown". */
export function legacyRestoreErrorCode(error: unknown): string {
  const code = asErrorLike(error).code;
  const s =
    typeof code === "string" || typeof code === "number"
      ? String(code).trim().slice(0, 100)
      : "";
  return s || "unknown";
}

/** Today's H3 offerings code: `rc_<code>` or `offerings_fetch_error`. */
export function legacyOfferingsErrorCode(error: unknown): string {
  const code = asErrorLike(error).code;
  return typeof code === "string" || typeof code === "number"
    ? `rc_${String(code)}`.slice(0, 100)
    : "offerings_fetch_error";
}
