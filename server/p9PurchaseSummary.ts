/**
 * P9 purchase funnel. Distinct devices and raw event counts, per platform
 * and per UTC week. No new columns: everything is in event_data.
 *
 * Completed purchases split trial / paid / unknown (pre-P9 rows have no
 * periodType or isTrial). purchase_failed with rcCode 20 is pending, not
 * failed, so the funnel is ready when Phase B starts logging it.
 */
import { type P8Range, utcWeekStart } from "./p8RetentionSummary";

export const P9_PURCHASE_EVENT_TYPES = [
  "paywall_viewed",
  "subscribe_tapped",
  "purchase_started",
  "purchase_completed",
  "purchase_cancelled",
  "purchase_failed",
  "purchase_unavailable",
  "purchase_entitlement_missing",
  "offering_fallback_used",
  "offerings_failed",
  "subscription_status_changed",
] as const;

export const P9_PLATFORMS = ["ios", "android", "web"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface P9SummaryEvent {
  deviceId: string;
  platform: string | null;
  eventType: string;
  eventData: unknown;
  createdAt: Date | string | number;
}

export interface P9CountPair {
  devices: number;
  events: number;
}

export interface P9CodeBucket extends P9CountPair {
  code: string;
}

export interface P9PlatformWeekRow {
  weekStart: string;
  platform: string;
  paywallViewed: P9CountPair;
  subscribeTapped: P9CountPair;
  purchaseStarted: P9CountPair;
  purchaseCompleted: {
    trial: P9CountPair;
    paid: P9CountPair;
    unknown: P9CountPair;
  };
  cancelled: P9CountPair;
  failedByRcCode: P9CodeBucket[];
  /** purchase_failed with rcCode 20 (PAYMENT_PENDING). */
  pending: P9CountPair;
  unavailableByCode: P9CodeBucket[];
  entitlementMissing: P9CountPair;
  fallbackUsed: P9CountPair;
  offeringsFailedByReason: P9CodeBucket[];
  /** subscription_status_changed from trial to paid. */
  trialToPaid: P9CountPair;
}

export interface P9PurchaseSummary {
  range: { from: string; to: string; timezone: "UTC" };
  generatedAt: string;
  includeTest: boolean;
  testDevicesExcluded: number;
  definitions: Record<string, string>;
  byPlatformWeek: P9PlatformWeekRow[];
}

export const P9_DEFINITIONS: Record<string, string> = {
  counting:
    "Distinct devices and raw event counts, labeled. Days and weeks are UTC. Weeks start Monday.",
  testDevices:
    "Excluded by default. A device is test if any event has buildEnv in {simulator, testflight, xcode, dev, expo_go}, isSandbox true, or its id is in ANALYTICS_TEST_DEVICE_IDS. Pass include_test=1 to include them. testDevicesExcluded is 0 when they are included.",
  paywallViewed: "paywall_viewed.",
  subscribeTapped: "subscribe_tapped.",
  purchaseStarted: "purchase_started.",
  purchaseCompleted:
    "purchase_completed, split by periodType / isTrial. trial = isTrial true or periodType TRIAL. paid = isTrial false or any other periodType. unknown = pre-P9 rows with neither field. A free-week start is never counted as paid.",
  cancelled: "purchase_cancelled.",
  failedByRcCode:
    "purchase_failed, bucketed by rcCode (or errorCode such as rc_3). rcCode 20 is pending, not failed.",
  pending: "purchase_failed with rcCode 20 (PAYMENT_PENDING).",
  unavailableByCode:
    "purchase_unavailable, bucketed by rcCode when present, otherwise errorCode (rc_3 and 3 both land under 3).",
  entitlementMissing: "purchase_entitlement_missing.",
  fallbackUsed: "offering_fallback_used.",
  offeringsFailedByReason: "offerings_failed, bucketed by reason.",
  trialToPaid:
    "subscription_status_changed from trial to paid. Undercounts because the charge can happen while the app is closed; RevenueCat is the source of truth for paid conversions.",
};

export interface P9SummaryOptions {
  now?: Date;
  includeTest?: boolean;
  testDevicesExcluded?: number;
}

function emptyPair(): P9CountPair {
  return { devices: 0, events: 0 };
}

function eventTime(value: Date | string | number): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function platformOf(event: P9SummaryEvent): string {
  const platform = event.platform;
  if (platform === "ios" || platform === "android" || platform === "web") {
    return platform;
  }
  return "unknown";
}

export function weeksOverlapping(range: P8Range): string[] {
  const weeks: string[] = [];
  let ms = Date.parse(`${utcWeekStart(range.fromMs)}T00:00:00.000Z`);
  const last = range.toEndMs - 1;
  while (ms <= last) {
    weeks.push(utcWeekStart(ms));
    ms += WEEK_MS;
  }
  return weeks;
}

/** Prefer rcCode; else parse errorCode like rc_3 or 3. */
export function parseEventCode(eventData: unknown): string {
  const data = asRecord(eventData);
  if (!data) return "unknown";
  if (typeof data.rcCode === "number" && Number.isInteger(data.rcCode)) {
    return String(data.rcCode);
  }
  if (typeof data.errorCode === "string") {
    const trimmed = data.errorCode.trim();
    const rc = /^rc_(\d{1,2})$/i.exec(trimmed);
    if (rc) return rc[1];
    const bare = /^(\d{1,2})$/.exec(trimmed);
    if (bare) return bare[1];
    return trimmed.length > 0 ? trimmed.slice(0, 100) : "unknown";
  }
  return "unknown";
}

export function completionKind(
  eventData: unknown,
): "trial" | "paid" | "unknown" {
  const data = asRecord(eventData);
  if (!data) return "unknown";
  if (data.isTrial === true || data.periodType === "TRIAL") return "trial";
  if (data.isTrial === false || typeof data.periodType === "string") {
    return "paid";
  }
  return "unknown";
}

class PairAcc {
  devices = new Set<string>();
  events = 0;

  add(deviceId: string): void {
    this.devices.add(deviceId);
    this.events += 1;
  }

  toPair(): P9CountPair {
    return { devices: this.devices.size, events: this.events };
  }
}

class RowAcc {
  paywallViewed = new PairAcc();
  subscribeTapped = new PairAcc();
  purchaseStarted = new PairAcc();
  completedTrial = new PairAcc();
  completedPaid = new PairAcc();
  completedUnknown = new PairAcc();
  cancelled = new PairAcc();
  pending = new PairAcc();
  entitlementMissing = new PairAcc();
  fallbackUsed = new PairAcc();
  trialToPaid = new PairAcc();
  failedByRcCode = new Map<string, PairAcc>();
  unavailableByCode = new Map<string, PairAcc>();
  offeringsFailedByReason = new Map<string, PairAcc>();

  bucket(map: Map<string, PairAcc>, code: string, deviceId: string): void {
    let acc = map.get(code);
    if (!acc) {
      acc = new PairAcc();
      map.set(code, acc);
    }
    acc.add(deviceId);
  }
}

function bucketsOf(map: Map<string, PairAcc>): P9CodeBucket[] {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))
    .map(([code, acc]) => ({ code, ...acc.toPair() }));
}

function emptyRow(weekStart: string, platform: string): P9PlatformWeekRow {
  return {
    weekStart,
    platform,
    paywallViewed: emptyPair(),
    subscribeTapped: emptyPair(),
    purchaseStarted: emptyPair(),
    purchaseCompleted: {
      trial: emptyPair(),
      paid: emptyPair(),
      unknown: emptyPair(),
    },
    cancelled: emptyPair(),
    failedByRcCode: [],
    pending: emptyPair(),
    unavailableByCode: [],
    entitlementMissing: emptyPair(),
    fallbackUsed: emptyPair(),
    offeringsFailedByReason: [],
    trialToPaid: emptyPair(),
  };
}

function toRow(
  weekStart: string,
  platform: string,
  row: RowAcc,
): P9PlatformWeekRow {
  return {
    weekStart,
    platform,
    paywallViewed: row.paywallViewed.toPair(),
    subscribeTapped: row.subscribeTapped.toPair(),
    purchaseStarted: row.purchaseStarted.toPair(),
    purchaseCompleted: {
      trial: row.completedTrial.toPair(),
      paid: row.completedPaid.toPair(),
      unknown: row.completedUnknown.toPair(),
    },
    cancelled: row.cancelled.toPair(),
    failedByRcCode: bucketsOf(row.failedByRcCode),
    pending: row.pending.toPair(),
    unavailableByCode: bucketsOf(row.unavailableByCode),
    entitlementMissing: row.entitlementMissing.toPair(),
    fallbackUsed: row.fallbackUsed.toPair(),
    offeringsFailedByReason: bucketsOf(row.offeringsFailedByReason),
    trialToPaid: row.trialToPaid.toPair(),
  };
}

function keyOf(weekStart: string, platform: string): string {
  return `${weekStart}\t${platform}`;
}

export function summarizeP9Purchases(
  events: P9SummaryEvent[],
  range: P8Range,
  options: P9SummaryOptions = {},
): P9PurchaseSummary {
  const now = options.now ?? new Date();
  const weeks = weeksOverlapping(range);
  const acc = new Map<string, RowAcc>();

  const accFor = (weekStart: string, platform: string): RowAcc => {
    const key = keyOf(weekStart, platform);
    let row = acc.get(key);
    if (!row) {
      row = new RowAcc();
      acc.set(key, row);
    }
    return row;
  };

  for (const event of events) {
    const time = eventTime(event.createdAt);
    if (time == null || time < range.fromMs || time >= range.toEndMs) continue;
    const weekStart = utcWeekStart(time);
    const platform = platformOf(event);
    const row = accFor(weekStart, platform);
    const data = asRecord(event.eventData);

    switch (event.eventType) {
      case "paywall_viewed":
        row.paywallViewed.add(event.deviceId);
        break;
      case "subscribe_tapped":
        row.subscribeTapped.add(event.deviceId);
        break;
      case "purchase_started":
        row.purchaseStarted.add(event.deviceId);
        break;
      case "purchase_completed": {
        const kind = completionKind(event.eventData);
        if (kind === "trial") row.completedTrial.add(event.deviceId);
        else if (kind === "paid") row.completedPaid.add(event.deviceId);
        else row.completedUnknown.add(event.deviceId);
        break;
      }
      case "purchase_cancelled":
        row.cancelled.add(event.deviceId);
        break;
      case "purchase_failed": {
        const code = parseEventCode(event.eventData);
        if (code === "20") row.pending.add(event.deviceId);
        else row.bucket(row.failedByRcCode, code, event.deviceId);
        break;
      }
      case "purchase_unavailable":
        row.bucket(
          row.unavailableByCode,
          parseEventCode(event.eventData),
          event.deviceId,
        );
        break;
      case "purchase_entitlement_missing":
        row.entitlementMissing.add(event.deviceId);
        break;
      case "offering_fallback_used":
        row.fallbackUsed.add(event.deviceId);
        break;
      case "offerings_failed": {
        const reason =
          data && typeof data.reason === "string" && data.reason.length > 0
            ? data.reason
            : "unknown";
        row.bucket(row.offeringsFailedByReason, reason, event.deviceId);
        break;
      }
      case "subscription_status_changed":
        if (data?.from === "trial" && data?.to === "paid") {
          row.trialToPaid.add(event.deviceId);
        }
        break;
      default:
        break;
    }
  }

  const platforms: string[] = [...P9_PLATFORMS];
  for (const key of acc.keys()) {
    const platform = key.split("\t")[1];
    if (platform && !platforms.includes(platform)) platforms.push(platform);
  }

  const byPlatformWeek: P9PlatformWeekRow[] = [];
  for (const weekStart of weeks) {
    for (const platform of platforms) {
      const row = acc.get(keyOf(weekStart, platform));
      byPlatformWeek.push(
        row ? toRow(weekStart, platform, row) : emptyRow(weekStart, platform),
      );
    }
  }

  return {
    range: { from: range.from, to: range.to, timezone: "UTC" },
    generatedAt: now.toISOString(),
    includeTest: options.includeTest ?? false,
    testDevicesExcluded: options.testDevicesExcluded ?? 0,
    definitions: P9_DEFINITIONS,
    byPlatformWeek,
  };
}
