import {
  MISSING_P6_COLUMNS_WARNING,
  insertAnalyticsEvents,
  isMissingColumnError,
  toAnalyticsRows,
  type AnalyticsInsertRow,
} from "../analyticsIngest";

const deviceId = "a".repeat(64);
const now = new Date("2026-10-31T18:00:00.000Z");

function inserter(values: jest.Mock) {
  return {
    insert: () => ({ values }),
  };
}

describe("analytics ingest before db:push", () => {
  it("writes an old client batch without naming the new columns", async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const rows = toAnalyticsRows(
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
    );

    await insertAnalyticsEvents(inserter(values), rows);

    expect(values).toHaveBeenCalledTimes(1);
    const row = values.mock.calls[0][0][0] as AnalyticsInsertRow;
    expect(row.eventType).toBe("paywall_viewed");
    expect(row.platform).toBe("ios");
    expect(row.appVersion).toBe("2.2.4");
    expect(row).not.toHaveProperty("deviceModel");
    expect(row).not.toHaveProperty("displayClass");
    expect(row).not.toHaveProperty("windowWidthBucket");
  });

  it("retries a new client batch when the P6 columns are missing", async () => {
    const missing = Object.assign(
      new Error(
        'column "device_model" of relation "analytics_events" does not exist',
      ),
      { code: "42703" },
    );
    const values = jest
      .fn()
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce(undefined);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const rows = toAnalyticsRows(
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
    );

    await insertAnalyticsEvents(inserter(values), rows);

    expect(values).toHaveBeenCalledTimes(2);
    const first = values.mock.calls[0][0][0] as AnalyticsInsertRow;
    expect(first.deviceModel).toBe("iPhone18,1");
    expect(first.displayClass).toBe("regular");
    expect(first.windowWidthBucket).toBe("500-800");
    const retry = values.mock.calls[1][0][0] as AnalyticsInsertRow;
    expect(retry.eventType).toBe("purchase_completed");
    expect(retry.appVersion).toBe("2.2.5");
    expect(retry).not.toHaveProperty("deviceModel");
    expect(retry).not.toHaveProperty("displayClass");
    expect(retry).not.toHaveProperty("windowWidthBucket");
    expect(warn).toHaveBeenCalledWith(MISSING_P6_COLUMNS_WARNING);
    expect(isMissingColumnError(missing)).toBe(true);
    warn.mockRestore();
  });

  it("does not retry an insert that failed for another reason", async () => {
    const values = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("down"), { code: "57P01" }));
    const rows = toAnalyticsRows(
      deviceId,
      [
        {
          type: "app_open",
          data: {},
          device_model: "iPhone18,1",
          displayClass: "compact",
          windowWidthBucket: "<500",
        },
      ],
      now,
    );

    await expect(insertAnalyticsEvents(inserter(values), rows)).rejects.toThrow(
      "down",
    );
    expect(values).toHaveBeenCalledTimes(1);
  });
});
