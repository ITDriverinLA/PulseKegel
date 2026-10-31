import { analyticsEvents } from "../shared/schema";

/**
 * P6 columns. The Replit deploy build does not run `db:push`, so production
 * can be on this server code before the columns exist. Naming them in INSERT
 * then fails every analytics write, including old clients.
 */
const P6_ROW_KEYS = [
  "deviceModel",
  "displayClass",
  "windowWidthBucket",
] as const;

export const MISSING_P6_COLUMNS_WARNING =
  "Analytics insert retried without device_model, display_class, and window_width_bucket because those columns are not in the database yet. Run db:push to store them.";

export type AnalyticsEventInput = {
  type: string;
  data: unknown;
  platform?: string;
  appVersion?: string;
  device_model?: string;
  displayClass?: string;
  windowWidthBucket?: string;
};

export type AnalyticsInsertRow = {
  deviceId: string;
  eventType: string;
  eventData: unknown;
  platform: string | null;
  appVersion: string | null;
  createdAt: Date;
  deviceModel?: string;
  displayClass?: string;
  windowWidthBucket?: string;
};

type AnalyticsInserter = {
  insert: (table: typeof analyticsEvents) => {
    values: (rows: AnalyticsInsertRow[]) => Promise<unknown>;
  };
};

/** Include a P6 field only when this client actually sent it. */
export function toAnalyticsRows(
  deviceId: string,
  events: AnalyticsEventInput[],
  now: Date = new Date(),
): AnalyticsInsertRow[] {
  return events.map((event) => {
    const row: AnalyticsInsertRow = {
      deviceId,
      eventType: event.type,
      eventData: event.data,
      platform: event.platform ?? null,
      appVersion: event.appVersion ?? null,
      createdAt: now,
    };
    if (event.device_model !== undefined) row.deviceModel = event.device_model;
    if (event.displayClass !== undefined) row.displayClass = event.displayClass;
    if (event.windowWidthBucket !== undefined) {
      row.windowWidthBucket = event.windowWidthBucket;
    }
    return row;
  });
}

export function isMissingColumnError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (record.code === "42703") return true;
    if (
      typeof record.message === "string" &&
      /column ["']?.+["']? does not exist/i.test(record.message)
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

function rowHasP6Field(row: AnalyticsInsertRow): boolean {
  return P6_ROW_KEYS.some((key) => row[key] !== undefined);
}

function withoutP6Columns(row: AnalyticsInsertRow): AnalyticsInsertRow {
  const next: AnalyticsInsertRow = {
    deviceId: row.deviceId,
    eventType: row.eventType,
    eventData: row.eventData,
    platform: row.platform,
    appVersion: row.appVersion,
    createdAt: row.createdAt,
  };
  return next;
}

/**
 * Insert analytics rows. If Postgres rejects the statement because a column
 * does not exist and the batch named the P6 columns, retry once without them.
 */
export async function insertAnalyticsEvents(
  database: AnalyticsInserter,
  rows: AnalyticsInsertRow[],
): Promise<void> {
  const insert = (batch: AnalyticsInsertRow[]) =>
    database.insert(analyticsEvents).values(batch);

  try {
    await insert(rows);
  } catch (err) {
    if (!isMissingColumnError(err) || !rows.some(rowHasP6Field)) {
      throw err;
    }
    console.warn(MISSING_P6_COLUMNS_WARNING);
    await insert(rows.map(withoutP6Columns));
  }
}
