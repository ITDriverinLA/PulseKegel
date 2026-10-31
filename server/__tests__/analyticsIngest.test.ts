import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { analyticsEvents } from "../../shared/schema";
import {
  ANALYTICS_P6_LOCK_TIMEOUT,
  ANALYTICS_P6_STARTUP_STATEMENTS,
  ANALYTICS_P6_STATEMENT_TIMEOUT,
  MISSING_P6_COLUMNS_WARNING,
  analyticsEventsLegacy,
  ensureAnalyticsP6Columns,
  insertAnalyticsEvents,
  toAnalyticsRows,
  type AnalyticsInsertRow,
} from "../analyticsIngest";

const deviceId = "a".repeat(64);
const now = new Date("2026-10-31T18:00:00.000Z");

const oldClientRow: AnalyticsInsertRow = toAnalyticsRows(
  deviceId,
  [
    {
      type: "paywall_viewed",
      data: { source: "settings", trialDaysRemaining: 2 },
      platform: "ios",
      appVersion: "2.2.4",
    },
  ],
  now,
)[0];

const newClientRow: AnalyticsInsertRow = toAnalyticsRows(
  deviceId,
  [
    {
      type: "purchase_completed",
      data: { result: "completed", source: "day1_soft" },
      platform: "ios",
      appVersion: "2.2.5",
      device_model: "iPhone18,1",
      displayClass: "regular",
      windowWidthBucket: "500-800",
    },
  ],
  now,
)[0];

describe("analytics INSERT SQL", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: "postgres://127.0.0.1/pulsekegel_sql_only",
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  function compiled(
    table: typeof analyticsEvents | typeof analyticsEventsLegacy,
    row: AnalyticsInsertRow,
  ) {
    const db = drizzle(pool);
    if (table === analyticsEventsLegacy) {
      const { deviceModel, displayClass, windowWidthBucket, ...legacy } = row;
      void deviceModel;
      void displayClass;
      void windowWidthBucket;
      return db.insert(table).values(legacy).toSQL().sql;
    }
    return db.insert(table).values(row).toSQL().sql;
  }

  it("names the three P6 columns on the primary table even for a 2.2.4 client", () => {
    const statement = compiled(analyticsEvents, oldClientRow);
    expect(statement).toContain('"device_model"');
    expect(statement).toContain('"display_class"');
    expect(statement).toContain('"window_width_bucket"');
    expect(statement).toMatch(
      /device_model", "display_class", "window_width_bucket"/,
    );
  });

  it("names the three P6 columns when the new client sent them", () => {
    const statement = compiled(analyticsEvents, newClientRow);
    expect(statement).toContain('"device_model"');
    expect(statement).toContain('"display_class"');
    expect(statement).toContain('"window_width_bucket"');
    expect(statement).not.toMatch(
      /"device_model", "display_class", "window_width_bucket"\) values \(default, .+ default, default, default/,
    );
  });

  it("does not name the three columns on the legacy fallback table", () => {
    for (const row of [oldClientRow, newClientRow]) {
      const statement = compiled(analyticsEventsLegacy, row);
      expect(statement).toContain('insert into "analytics_events"');
      expect(statement).not.toContain("device_model");
      expect(statement).not.toContain("display_class");
      expect(statement).not.toContain("window_width_bucket");
      expect(statement).toContain('"app_version"');
    }
  });
});

describe("analytics insert fallback", () => {
  function databaseThatRejectsPrimary() {
    const calls: ("primary" | "legacy")[] = [];
    return {
      calls,
      insert(table: typeof analyticsEvents | typeof analyticsEventsLegacy) {
        return {
          values: async () => {
            if (table === analyticsEventsLegacy) {
              calls.push("legacy");
              return;
            }
            calls.push("primary");
            throw Object.assign(
              new Error(
                'column "device_model" of relation "analytics_events" does not exist',
              ),
              { code: "42703" },
            );
          },
        };
      },
    };
  }

  it("retries an old client and a new client through the legacy table", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    for (const row of [oldClientRow, newClientRow]) {
      const database = databaseThatRejectsPrimary();
      await insertAnalyticsEvents(database, [row]);
      expect(database.calls).toEqual(["primary", "legacy"]);
    }
    expect(warn).toHaveBeenCalledWith(MISSING_P6_COLUMNS_WARNING);
    warn.mockRestore();
  });

  it("does not use the legacy table when the error is not a missing column", async () => {
    const calls: string[] = [];
    const database = {
      insert() {
        return {
          values: async () => {
            calls.push("primary");
            throw Object.assign(new Error("down"), { code: "57P01" });
          },
        };
      },
    };
    await expect(
      insertAnalyticsEvents(database, [oldClientRow]),
    ).rejects.toThrow("down");
    expect(calls).toEqual(["primary"]);
  });
});

describe("analytics P6 startup migration", () => {
  it("adds each nullable column only if it is missing", () => {
    expect(ANALYTICS_P6_STARTUP_STATEMENTS).toEqual([
      "ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS device_model varchar(64)",
      "ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS display_class varchar(16)",
      "ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS window_width_bucket varchar(16)",
    ]);
    for (const statement of ANALYTICS_P6_STARTUP_STATEMENTS) {
      expect(statement).toContain("ADD COLUMN IF NOT EXISTS");
      expect(statement.toLowerCase()).not.toContain("not null");
    }
  });

  it("sets timeouts, continues after one ALTER fails, and releases the connection", async () => {
    const queries: string[] = [];
    let released = false;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      ensureAnalyticsP6Columns({
        connect: async () => ({
          query: async (text: string) => {
            queries.push(text);
            if (text.includes("display_class")) {
              throw new Error("permission denied");
            }
          },
          release: () => {
            released = true;
          },
        }),
      }),
    ).resolves.toBeUndefined();
    expect(queries).toEqual([
      `SET statement_timeout = '${ANALYTICS_P6_STATEMENT_TIMEOUT}'`,
      `SET lock_timeout = '${ANALYTICS_P6_LOCK_TIMEOUT}'`,
      ...ANALYTICS_P6_STARTUP_STATEMENTS,
    ]);
    expect(released).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("logs and returns when the pool cannot connect", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      ensureAnalyticsP6Columns({
        connect: async () => {
          throw new Error("connection refused");
        },
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
