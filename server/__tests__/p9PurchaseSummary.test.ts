import { resolveP8Range } from "../p8RetentionSummary";
import {
  completionKind,
  parseEventCode,
  summarizeP9Purchases,
  type P9PlatformWeekRow,
  type P9SummaryEvent,
} from "../p9PurchaseSummary";
import { excludeTestDevices } from "../testDevices";

const hex = (ch: string) => ch.repeat(64);

const TF_IPHONE = hex("1");
const SIMULATOR = hex("2");
const PLAY_TESTER = hex("3");
const SANDBOX_BUY = hex("4");
const ANDROID_RC3 = hex("5");
const IOS_CANCEL = hex("6");
const REAL_TRIAL = hex("7");
const REAL_PAID = hex("8");

const now = new Date("2026-11-23T21:00:00.000Z"); // 1:00 PM PT
const range = resolveP8Range("2026-10-20", "2026-11-23", now);
if (!range.ok) throw new Error("fixture range");

function ev(
  deviceId: string,
  type: string,
  at: string,
  platform: string,
  eventData: Record<string, unknown> = {},
): P9SummaryEvent {
  return {
    deviceId,
    platform,
    eventType: type,
    eventData,
    createdAt: at,
  };
}

/**
 * Mirrors the Nov 23 diagnosis with synthetic device ids:
 * four test completions (TestFlight, Simulator, Play license tester via
 * the env list, and an isSandbox buy) and one Android rc_3 unavailable.
 */
function nov23Events(): P9SummaryEvent[] {
  return [
    ev(TF_IPHONE, "paywall_viewed", "2026-10-22T17:00:00.000Z", "ios", {
      source: "settings",
      buildEnv: "testflight",
    }),
    ev(TF_IPHONE, "subscribe_tapped", "2026-10-22T17:00:01.000Z", "ios", {
      hasPackages: true,
      buildEnv: "testflight",
    }),
    ev(TF_IPHONE, "purchase_started", "2026-10-22T17:00:02.000Z", "ios", {
      result: "started",
      buildEnv: "testflight",
    }),
    ev(TF_IPHONE, "purchase_completed", "2026-10-22T17:00:05.000Z", "ios", {
      result: "completed",
      buildEnv: "testflight",
      isSandbox: true,
    }),

    ev(SIMULATOR, "purchase_completed", "2026-10-22T18:00:00.000Z", "ios", {
      result: "completed",
      buildEnv: "simulator",
    }),

    // Pre-P9 Play license-tester row: no buildEnv, identified only by env id.
    ev(
      PLAY_TESTER,
      "purchase_completed",
      "2026-10-22T19:00:00.000Z",
      "android",
      {
        result: "completed",
      },
    ),

    ev(SANDBOX_BUY, "purchase_completed", "2026-10-26T16:00:00.000Z", "ios", {
      result: "completed",
      isSandbox: true,
    }),

    ev(ANDROID_RC3, "paywall_viewed", "2026-10-26T18:00:00.000Z", "android", {
      source: "settings",
    }),
    ev(
      ANDROID_RC3,
      "purchase_unavailable",
      "2026-10-26T18:00:02.000Z",
      "android",
      {
        result: "unavailable",
        errorCode: "rc_3",
      },
    ),

    ev(IOS_CANCEL, "paywall_viewed", "2026-10-26T20:00:00.000Z", "ios", {
      source: "day1_soft",
    }),
    ev(IOS_CANCEL, "subscribe_tapped", "2026-10-26T20:00:01.000Z", "ios", {
      hasPackages: true,
    }),
    ev(IOS_CANCEL, "purchase_cancelled", "2026-10-26T20:00:04.000Z", "ios", {
      result: "cancelled",
    }),
  ];
}

function row(
  summary: ReturnType<typeof summarizeP9Purchases>,
  platform: string,
  weekStart: string,
): P9PlatformWeekRow {
  const found = summary.byPlatformWeek.find(
    (item) => item.platform === platform && item.weekStart === weekStart,
  );
  if (!found) {
    throw new Error(`missing row ${platform} ${weekStart}`);
  }
  return found;
}

function totals(
  summary: ReturnType<typeof summarizeP9Purchases>,
  pick: (r: P9PlatformWeekRow) => { devices: number; events: number },
) {
  return summary.byPlatformWeek.reduce(
    (acc, item) => {
      const pair = pick(item);
      acc.devices += pair.devices;
      acc.events += pair.events;
      return acc;
    },
    { devices: 0, events: 0 },
  );
}

describe("parseEventCode and completionKind", () => {
  it("buckets rc_3 and bare 3 under code 3, preferring rcCode", () => {
    expect(parseEventCode({ errorCode: "rc_3" })).toBe("3");
    expect(parseEventCode({ errorCode: "3" })).toBe("3");
    expect(parseEventCode({ rcCode: 3, errorCode: "rc_23" })).toBe("3");
    expect(parseEventCode({ errorCode: "no_offerings" })).toBe("no_offerings");
    expect(parseEventCode({})).toBe("unknown");
  });

  it("splits trial / paid / unknown", () => {
    expect(completionKind({ isTrial: true })).toBe("trial");
    expect(completionKind({ periodType: "TRIAL" })).toBe("trial");
    expect(completionKind({ isTrial: false })).toBe("paid");
    expect(completionKind({ periodType: "NORMAL" })).toBe("paid");
    expect(completionKind({ periodType: "INTRO" })).toBe("paid");
    expect(completionKind({ result: "completed" })).toBe("unknown");
    expect(completionKind(undefined)).toBe("unknown");
  });
});

describe("summarizeP9Purchases — Nov 23 fixtures", () => {
  const envIds = [PLAY_TESTER];

  it("counts 0 real completions when test devices are excluded (4 test buys)", () => {
    const filtered = excludeTestDevices(nov23Events(), {
      includeTest: false,
      envIds,
    });
    expect(filtered.testDevicesExcluded).toBe(4);

    const summary = summarizeP9Purchases(filtered.rows, range.range, {
      now,
      includeTest: false,
      testDevicesExcluded: filtered.testDevicesExcluded,
    });

    const completed = totals(summary, (item) => ({
      devices:
        item.purchaseCompleted.trial.devices +
        item.purchaseCompleted.paid.devices +
        item.purchaseCompleted.unknown.devices,
      events:
        item.purchaseCompleted.trial.events +
        item.purchaseCompleted.paid.events +
        item.purchaseCompleted.unknown.events,
    }));
    expect(completed.devices).toBe(0);
    expect(completed.events).toBe(0);
    expect(summary.includeTest).toBe(false);
    expect(summary.testDevicesExcluded).toBe(4);

    const android = row(summary, "android", "2026-10-26");
    expect(android.unavailableByCode).toEqual([
      { code: "3", devices: 1, events: 1 },
    ]);

    const ios = row(summary, "ios", "2026-10-26");
    expect(ios.cancelled).toEqual({ devices: 1, events: 1 });
    expect(ios.paywallViewed.devices).toBe(1);
    expect(ios.subscribeTapped.devices).toBe(1);
  });

  it("includes the 4 test completions when include_test=1", () => {
    const filtered = excludeTestDevices(nov23Events(), {
      includeTest: true,
      envIds,
    });
    const summary = summarizeP9Purchases(filtered.rows, range.range, {
      now,
      includeTest: true,
      testDevicesExcluded: filtered.testDevicesExcluded,
    });
    expect(summary.testDevicesExcluded).toBe(0);
    const unknown = totals(summary, (item) => item.purchaseCompleted.unknown);
    expect(unknown.devices).toBe(4);
    expect(unknown.events).toBe(4);
    // Pre-P9 rows have no periodType, so they are unknown, not paid.
    expect(totals(summary, (item) => item.purchaseCompleted.paid).events).toBe(
      0,
    );
  });

  it("returns zeroed platform/week rows for an empty range, not an error", () => {
    const emptyRange = resolveP8Range("2026-01-01", "2026-01-07", now);
    if (!emptyRange.ok) throw new Error("empty range");
    const summary = summarizeP9Purchases([], emptyRange.range, { now });
    expect(summary.byPlatformWeek.length).toBeGreaterThan(0);
    for (const item of summary.byPlatformWeek) {
      expect(["ios", "android", "web"]).toContain(item.platform);
      expect(item.paywallViewed).toEqual({ devices: 0, events: 0 });
      expect(item.purchaseCompleted.paid).toEqual({ devices: 0, events: 0 });
      expect(item.unavailableByCode).toEqual([]);
    }
  });

  it("splits trial vs paid, buckets failed codes, and counts trial→paid", () => {
    const week = "2026-11-16";
    const events: P9SummaryEvent[] = [
      ev(REAL_TRIAL, "purchase_completed", "2026-11-18T12:00:00.000Z", "ios", {
        result: "completed",
        periodType: "TRIAL",
        isTrial: true,
      }),
      ev(
        REAL_PAID,
        "purchase_completed",
        "2026-11-18T13:00:00.000Z",
        "android",
        {
          result: "completed",
          periodType: "NORMAL",
          isTrial: false,
        },
      ),
      ev(REAL_PAID, "purchase_failed", "2026-11-18T12:30:00.000Z", "android", {
        result: "failed",
        rcCode: 23,
      }),
      ev(hex("9"), "purchase_failed", "2026-11-18T12:40:00.000Z", "ios", {
        result: "failed",
        rcCode: 20,
      }),
      ev(hex("a"), "offerings_failed", "2026-11-18T12:50:00.000Z", "android", {
        surface: "launch",
        reason: "not_configured",
      }),
      ev(
        hex("b"),
        "offering_fallback_used",
        "2026-11-18T12:51:00.000Z",
        "ios",
        {
          offeringId: "default",
          reason: "no_current",
          surface: "launch",
        },
      ),
      ev(
        REAL_TRIAL,
        "subscription_status_changed",
        "2026-11-20T12:00:00.000Z",
        "ios",
        { from: "trial", to: "paid", periodType: "NORMAL" },
      ),
    ];
    const weekRange = resolveP8Range("2026-11-16", "2026-11-22", now);
    if (!weekRange.ok) throw new Error("week range");
    const summary = summarizeP9Purchases(events, weekRange.range, { now });
    const ios = row(summary, "ios", week);
    const android = row(summary, "android", week);

    expect(ios.purchaseCompleted.trial).toEqual({ devices: 1, events: 1 });
    expect(ios.purchaseCompleted.paid).toEqual({ devices: 0, events: 0 });
    expect(android.purchaseCompleted.paid).toEqual({ devices: 1, events: 1 });
    expect(android.purchaseCompleted.trial).toEqual({ devices: 0, events: 0 });
    expect(android.failedByRcCode).toEqual([
      { code: "23", devices: 1, events: 1 },
    ]);
    expect(ios.pending).toEqual({ devices: 1, events: 1 });
    expect(ios.failedByRcCode).toEqual([]);
    expect(android.offeringsFailedByReason).toEqual([
      { code: "not_configured", devices: 1, events: 1 },
    ]);
    expect(ios.fallbackUsed).toEqual({ devices: 1, events: 1 });
    expect(ios.trialToPaid).toEqual({ devices: 1, events: 1 });
  });

  it("counts a device once per step even with repeated events", () => {
    const deviceId = hex("e");
    const events = [
      ev(deviceId, "paywall_viewed", "2026-11-18T10:00:00.000Z", "ios"),
      ev(deviceId, "paywall_viewed", "2026-11-18T11:00:00.000Z", "ios"),
      ev(deviceId, "subscribe_tapped", "2026-11-18T11:01:00.000Z", "ios"),
    ];
    const weekRange = resolveP8Range("2026-11-16", "2026-11-22", now);
    if (!weekRange.ok) throw new Error("week range");
    const summary = summarizeP9Purchases(events, weekRange.range, { now });
    const ios = row(summary, "ios", "2026-11-16");
    expect(ios.paywallViewed).toEqual({ devices: 1, events: 2 });
    expect(ios.subscribeTapped).toEqual({ devices: 1, events: 1 });
  });
});
