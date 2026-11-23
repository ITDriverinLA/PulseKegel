/**
 * P9 test-device exclusion. A device is test if any of its events ever
 * had buildEnv in {simulator, testflight, xcode, dev, expo_go}, or
 * isSandbox: true, or its id is listed in ANALYTICS_TEST_DEVICE_IDS
 * (comma-separated 64-hex). Device ids are never logged or committed.
 */
import { sql, type SQL } from "drizzle-orm";
import { analyticsEvents } from "../shared/schema";

export const TEST_BUILD_ENVS = [
  "simulator",
  "testflight",
  "xcode",
  "dev",
  "expo_go",
] as const;

export const ANALYTICS_TEST_DEVICE_IDS_ENV = "ANALYTICS_TEST_DEVICE_IDS";

const DEVICE_ID_RE = /^[a-fA-F0-9]{64}$/;

let warnedMalformedIds = false;

/** Test-only: allow the malformed-id warning to fire again. */
export function resetTestDeviceIdWarningForTests(): void {
  warnedMalformedIds = false;
}

/**
 * Default is exclude. Only the exact query value `include_test=1` opts in.
 * Any other value (missing, "true", "yes", "0") keeps the filter on.
 */
export function wantIncludeTest(
  query: { include_test?: unknown } | undefined,
): boolean {
  const value = query?.include_test;
  if (Array.isArray(value)) return value[0] === "1";
  return value === "1";
}

export function parseTestDeviceIds(
  raw: string | undefined | null,
  log: (message: string) => void = defaultLog,
): string[] {
  if (raw == null || raw.trim() === "") return [];
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const valid: string[] = [];
  let malformed = 0;
  for (const part of parts) {
    if (DEVICE_ID_RE.test(part)) valid.push(part);
    else malformed += 1;
  }
  if (malformed > 0 && !warnedMalformedIds) {
    warnedMalformedIds = true;
    log(
      `${ANALYTICS_TEST_DEVICE_IDS_ENV}: ignored ${malformed} malformed id(s)`,
    );
  }
  return [...new Set(valid)];
}

function defaultLog(message: string): void {
  console.warn(message);
}

export function envTestDeviceIds(
  env: NodeJS.Dict<string> = process.env,
  log?: (message: string) => void,
): string[] {
  return parseTestDeviceIds(env[ANALYTICS_TEST_DEVICE_IDS_ENV], log);
}

/** True when this one event marks the device as test. */
export function eventSignalsTestDevice(eventData: unknown): boolean {
  const data = asRecord(eventData);
  if (!data) return false;
  const buildEnv = data.buildEnv;
  if (
    typeof buildEnv === "string" &&
    (TEST_BUILD_ENVS as readonly string[]).includes(buildEnv)
  ) {
    return true;
  }
  return data.isSandbox === true;
}

export function collectTestDeviceIds(
  events: { deviceId: string; eventData?: unknown }[],
  envIds: readonly string[] = [],
): Set<string> {
  const testIds = new Set<string>(envIds);
  for (const event of events) {
    if (eventSignalsTestDevice(event.eventData)) testIds.add(event.deviceId);
  }
  return testIds;
}

/**
 * Default = drop test devices. `includeTest: true` returns the rows unchanged.
 * Used by tests and any in-memory path; SQL queries use the same rules
 * via `notTestDeviceSql`.
 */
export function excludeTestDevices<
  T extends { deviceId: string; eventData?: unknown },
>(
  events: T[],
  options: { includeTest: boolean; envIds?: readonly string[] },
): { rows: T[]; testDevicesExcluded: number } {
  const testIds = collectTestDeviceIds(events, options.envIds ?? []);
  // Count only test devices that actually appear in this event set.
  const present = new Set(
    events
      .filter((event) => testIds.has(event.deviceId))
      .map((e) => e.deviceId),
  );
  if (options.includeTest) {
    return { rows: events, testDevicesExcluded: 0 };
  }
  return {
    rows: events.filter((event) => !testIds.has(event.deviceId)),
    testDevicesExcluded: present.size,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

type DeviceIdExpr = SQL | string | object;

function columnSql(deviceIdExpr: DeviceIdExpr): SQL {
  return typeof deviceIdExpr === "string"
    ? sql.raw(deviceIdExpr)
    : sql`${deviceIdExpr}`;
}

/**
 * SQL predicate: this row's event marks a test device, or its device id is
 * in the seeded env list. The one helper every exclusion query uses.
 */
export function isTestDevicePredicateSql(
  envIds: readonly string[] = envTestDeviceIds(),
): SQL {
  const buildEnvList = sql.join(
    TEST_BUILD_ENVS.map((env) => sql`${env}`),
    sql`, `,
  );
  const envIdPred =
    envIds.length === 0
      ? sql`FALSE`
      : sql`${analyticsEvents.deviceId} IN (${sql.join(
          envIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;
  return sql`(
    ${analyticsEvents.eventData}->>'buildEnv' IN (${buildEnvList})
    OR ${analyticsEvents.eventData}->>'isSandbox' = 'true'
    OR ${envIdPred}
  )`;
}

/** Distinct device_id of every test device in analytics_events. */
export function testDeviceIdSubquery(
  envIds: readonly string[] = envTestDeviceIds(),
): SQL {
  return sql`(
    SELECT DISTINCT ${analyticsEvents.deviceId}
    FROM ${analyticsEvents}
    WHERE ${isTestDevicePredicateSql(envIds)}
  )`;
}

/**
 * Boolean SQL for "this device is not a test device".
 * When includeTest is true, always TRUE (no filter).
 */
export function notTestDeviceSql(
  deviceIdExpr: DeviceIdExpr,
  includeTest: boolean,
  envIds?: readonly string[],
): SQL {
  if (includeTest) return sql`TRUE`;
  return sql`${columnSql(deviceIdExpr)} NOT IN ${testDeviceIdSubquery(envIds)}`;
}
