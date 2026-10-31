import {
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { analyticsEvents } from "../shared/schema";

/**
 * INSERT-only copy of `analyticsEvents` in `shared/schema.ts`.
 * Keep every column here identical to that table except `deviceModel`,
 * `displayClass`, and `windowWidthBucket`. Drizzle 0.45 names every column
 * on the primary table and sends `default` for the ones a row omits, which
 * is 42703 until those columns exist. This object stays out of
 * `shared/schema.ts` so `db:push` still treats the primary definition as canonical.
 */
export const analyticsEventsLegacy = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventData: jsonb("event_data"),
  platform: varchar("platform", { length: 10 }),
  appVersion: varchar("app_version", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Idempotent. Nullable, matching `analyticsEvents` in `shared/schema.ts`. No NOT NULL. */
export const ANALYTICS_P6_STARTUP_STATEMENTS = [
  "ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS device_model varchar(64)",
  "ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS display_class varchar(16)",
  "ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS window_width_bucket varchar(16)",
] as const;

export const MISSING_P6_COLUMNS_WARNING =
  "Analytics insert retried without device_model, display_class, and window_width_bucket because those columns are not in the database yet. The startup migration and npm run db:push add them.";

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

type LegacyInsertRow = {
  deviceId: string;
  eventType: string;
  eventData: unknown;
  platform: string | null;
  appVersion: string | null;
  createdAt: Date;
};

type AnalyticsInserter = {
  insert: (table: typeof analyticsEvents | typeof analyticsEventsLegacy) => {
    values: (
      rows: AnalyticsInsertRow[] | LegacyInsertRow[],
    ) => Promise<unknown>;
  };
};

/** Include a P6 value only when this client sent it. The primary INSERT still names the columns. */
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

function toLegacyRow(row: AnalyticsInsertRow): LegacyInsertRow {
  return {
    deviceId: row.deviceId,
    eventType: row.eventType,
    eventData: row.eventData,
    platform: row.platform,
    appVersion: row.appVersion,
    createdAt: row.createdAt,
  };
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

/**
 * Insert through the primary table. On undefined-column, retry the whole
 * batch through the legacy table definition, which does not name the P6 columns.
 */
export async function insertAnalyticsEvents(
  database: AnalyticsInserter,
  rows: AnalyticsInsertRow[],
): Promise<void> {
  try {
    await database.insert(analyticsEvents).values(rows);
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    console.warn(MISSING_P6_COLUMNS_WARNING);
    await database.insert(analyticsEventsLegacy).values(rows.map(toLegacyRow));
  }
}

/** Caps a locked ALTER so the background migration cannot hold a pool connection. */
export const ANALYTICS_P6_STATEMENT_TIMEOUT = "5s";
export const ANALYTICS_P6_LOCK_TIMEOUT = "2s";

type MigrationClient = {
  query: (text: string) => Promise<unknown>;
  release: () => void;
};

type MigrationPool = {
  connect: () => Promise<MigrationClient>;
};

function migrationFailure(err: unknown): string {
  return err instanceof Error ? err.message.split("\n")[0] : "unknown";
}

/**
 * Heal production after listen. The Replit deploy build does not run `db:push`.
 * Runs on its own connection with statement and lock timeouts. A failure is
 * logged and does not stop the server; inserts then use `analyticsEventsLegacy`
 * until the columns from `shared/schema.ts` exist.
 */
export async function ensureAnalyticsP6Columns(
  pool: MigrationPool,
): Promise<void> {
  let client: MigrationClient | undefined;
  try {
    client = await pool.connect();
    await client.query(
      `SET statement_timeout = '${ANALYTICS_P6_STATEMENT_TIMEOUT}'`,
    );
    await client.query(`SET lock_timeout = '${ANALYTICS_P6_LOCK_TIMEOUT}'`);
    for (const statement of ANALYTICS_P6_STARTUP_STATEMENTS) {
      try {
        await client.query(statement);
      } catch (err) {
        console.warn(
          `Analytics P6 startup migration failed (${migrationFailure(err)}). Inserts omit the new columns until they exist. Run npm run db:push against production as well.`,
        );
      }
    }
  } catch (err) {
    console.warn(
      `Analytics P6 startup migration failed to start (${migrationFailure(err)}). Inserts omit the new columns until they exist. Run npm run db:push against production as well.`,
    );
  } finally {
    client?.release();
  }
}
