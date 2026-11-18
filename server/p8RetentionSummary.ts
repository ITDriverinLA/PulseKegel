/**
 * P8 retention summary (Day-2 and lapsed-user retention). Distinct devices only.
 * Pure: no DB access, so it can be unit tested like p7AnalyticsSummary.
 * No new columns: everything is read from event_type, event_data, platform
 * and created_at. Days are UTC days, matching `dailyUniqueUsers`.
 *
 * Main measure: second-session start rate. Share of Day-1 completers that
 * start any session on a later UTC day within 7 days, by Day-1 week cohort
 * and platform. Day-2 and Day-3 returns are the breakdown.
 *
 * Push delivery is estimated: iOS and Android don't report delivery of a
 * local notification while the app is closed. A scheduled push counts as
 * estimated delivered when its fire_at has passed and no session start or
 * re-schedule of the same nudge happened between scheduling and fire_at.
 */

export interface P8SummaryEvent {
  deviceId: string;
  platform: string | null;
  eventType: string;
  eventData: unknown;
  createdAt: Date | string | number;
}

/** Event types the summary reads. The route loads only these. */
export const P8_DAY1_EVENT_TYPES = [
  "first_session_completed",
  "challenge_day_completed",
] as const;

export const P8_EVENT_TYPES = [
  ...P8_DAY1_EVENT_TYPES,
  "session_started",
  "challenge_day_started",
  "challenge_day2_nudge_scheduled",
  "challenge_day2_nudge_shown",
  "challenge_day2_nudge_tapped",
  "challenge_nudge_received",
  "challenge_nudge_fire_passed",
  "push_preprompt_shown",
  "push_preprompt_result",
  "permission_result",
  "comeback_shown",
  "comeback_tapped",
  "comeback_completed",
] as const;

const SESSION_START_TYPES = new Set([
  "session_started",
  "challenge_day_started",
]);

const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest range the endpoint accepts, in days (inclusive). */
export const P8_MAX_RANGE_DAYS = 92;
/** How far before `from` the route loads events (scheduled pushes firing in range). */
export const P8_LOOKBACK_DAYS = 15;
/** How far after `to` the route loads events (7-day second-session window). */
export const P8_LOOKAHEAD_DAYS = 8;
/** A fire_at further than this after scheduling is ignored as implausible. */
const MAX_FIRE_AHEAD_MS = 14 * DAY_MS;
/** A tap followed by a session start within this window counts as "session started". */
const TAP_TO_SESSION_MS = DAY_MS;

export interface P8Range {
  from: string;
  to: string;
  fromMs: number;
  /** Exclusive end: start of the UTC day after `to`. */
  toEndMs: number;
}

export type P8RangeResult =
  | { ok: true; range: P8Range }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDate(value: string): number | null {
  if (!DATE_RE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  // Reject rollovers such as 2026-02-31.
  if (new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return ms;
}

export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * `from` / `to` are YYYY-MM-DD UTC days, both inclusive. Missing values
 * default to the last 7 days ending today (UTC).
 */
export function resolveP8Range(
  fromRaw: unknown,
  toRaw: unknown,
  now: Date = new Date(),
): P8RangeResult {
  const todayMs = parseUtcDate(utcDate(now.getTime())) as number;
  const blank = (v: unknown) =>
    v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  if (!blank(fromRaw) && typeof fromRaw !== "string") {
    return { ok: false, error: "from must be YYYY-MM-DD" };
  }
  if (!blank(toRaw) && typeof toRaw !== "string") {
    return { ok: false, error: "to must be YYYY-MM-DD" };
  }
  let toMs = todayMs;
  if (!blank(toRaw)) {
    const parsed = parseUtcDate((toRaw as string).trim());
    if (parsed == null) return { ok: false, error: "to must be YYYY-MM-DD" };
    toMs = parsed;
  }
  let fromMs = toMs - 6 * DAY_MS;
  if (!blank(fromRaw)) {
    const parsed = parseUtcDate((fromRaw as string).trim());
    if (parsed == null) return { ok: false, error: "from must be YYYY-MM-DD" };
    fromMs = parsed;
  }
  if (fromMs > toMs)
    return { ok: false, error: "from must be on or before to" };
  if ((toMs - fromMs) / DAY_MS + 1 > P8_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `range must be at most ${P8_MAX_RANGE_DAYS} days`,
    };
  }
  return {
    ok: true,
    range: {
      from: utcDate(fromMs),
      to: utcDate(toMs),
      fromMs,
      toEndMs: toMs + DAY_MS,
    },
  };
}

/** Monday (UTC) of the week containing `ms`, as YYYY-MM-DD. */
export function utcWeekStart(ms: number): string {
  const dayStart = Math.floor(ms / DAY_MS) * DAY_MS;
  const dow = new Date(dayStart).getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7;
  return utcDate(dayStart - back * DAY_MS);
}

function eventTime(value: Date | string | number): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function platformOf(event: P8SummaryEvent): string {
  return typeof event.platform === "string" && event.platform.trim()
    ? event.platform
    : "unknown";
}

function dayIndex(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

type Nudge = "day2" | "followup";

interface NudgeKey {
  platform: string;
  channel: string;
  nudge: Nudge;
  followupDay: 3 | 5 | null;
}

function nudgeKeyOf(
  event: P8SummaryEvent,
  data: Record<string, unknown> | null,
  channelOverride?: string,
): NudgeKey {
  const followupDay =
    data?.followup_day === 3 || data?.followup_day === 5
      ? data.followup_day
      : null;
  const nudge: Nudge =
    followupDay != null || data?.nudge === "followup" ? "followup" : "day2";
  const channel =
    channelOverride ??
    (data?.channel === "push" || data?.channel === "in_app"
      ? data.channel
      : "unknown");
  return { platform: platformOf(event), channel, nudge, followupDay };
}

function keyString(k: NudgeKey): string {
  return `${k.platform}\n${k.channel}\n${k.nudge}\n${k.followupDay ?? ""}`;
}

type NudgeMetric =
  | "scheduled"
  | "estimatedDelivered"
  | "receivedForeground"
  | "firePassedReported"
  | "shown"
  | "tapped"
  | "sessionStartedAfterTap";

const NUDGE_METRICS: NudgeMetric[] = [
  "scheduled",
  "estimatedDelivered",
  "receivedForeground",
  "firePassedReported",
  "shown",
  "tapped",
  "sessionStartedAfterTap",
];

export type P8NudgeCounts = Record<NudgeMetric, number>;

export interface P8NudgeRow extends P8NudgeCounts {
  platform: string;
  channel: string;
  nudge: Nudge;
  followupDay: 3 | 5 | null;
}

export interface P8NudgeDailyRow extends P8NudgeRow {
  date: string;
}

export interface P8CohortRow {
  /** Monday (UTC) of the Day-1 completion week. */
  cohortWeek: string;
  /** Platform, or "all" for every platform together. */
  platform: string;
  day1Completers: number;
  /** Started any session on a later UTC day, within 7 days of Day 1. Main measure numerator. */
  secondSessionWithin7d: number;
  /** secondSessionWithin7d / day1Completers, 0..1. Null with no completers. */
  secondSessionRate: number | null;
  /** First later session was on Day 2 (Day-1 date + 1). */
  firstReturnDay2: number;
  /** First later session was on Day 3 (Day-1 date + 2). */
  firstReturnDay3: number;
  /** First later session was on Day 4 through Day 8 (still within 7 days). */
  firstReturnDay4to8: number;
  /** challenge_day_started day 2. Only meaningful for accelerated-path devices. */
  challengeDay2Started: number;
  /** False while some completers' 7-day window is still open. */
  windowComplete: boolean;
}

export interface P8DatePlatformRow {
  date: string;
  platform: string;
  devices: number;
}

export interface P8PrePromptRow {
  platform: string;
  attempt: number | null;
  shown: number;
  yes: number;
  notNow: number;
  dismissed: number;
  /** permission_result granted with a pre_prompt other than "none". */
  osGranted: number;
}

export interface P8ComebackRow {
  platform: string;
  source: string;
  shown: number;
  tappedStart: number;
  tappedNotNow: number;
  completed: number;
  /** Completed a comeback session and started another session within 7 days after it. */
  anotherSessionWithin7d: number;
}

export interface P8RetentionSummary {
  range: { from: string; to: string; timezone: "UTC" };
  generatedAt: string;
  definitions: Record<string, string>;
  secondSession: {
    cohortsByWeek: P8CohortRow[];
    /** Devices whose first session after their Day-1 date started on this date. */
    firstReturnByDate: P8DatePlatformRow[];
  };
  day1CompletersByDate: P8DatePlatformRow[];
  challengeDay2StartedByDate: P8DatePlatformRow[];
  nudges: {
    totals: P8NudgeRow[];
    byDate: P8NudgeDailyRow[];
  };
  prePrompt: P8PrePromptRow[];
  comeback: P8ComebackRow[];
}

export const P8_DEFINITIONS: Record<string, string> = {
  counting: "Distinct devices only. Days are UTC calendar days.",
  day1Completer:
    "Earliest first_session_completed or challenge_day_completed (week 1, day 1) per device.",
  secondSessionRate:
    "Main measure. Day-1 completers in the cohort week who started any session (session_started or challenge_day_started) on a later UTC day within 7 days, divided by Day-1 completers.",
  firstReturnDay2:
    "First later session was on the UTC day after Day 1 (Day-2 return).",
  firstReturnDay3:
    "First later session was two UTC days after Day 1 (Day-3 return).",
  challengeDay2Started:
    "challenge_day_started day 2. Meaningful only on the accelerated path; Day 2 is a rest day elsewhere.",
  estimatedDelivered:
    "Estimated. Push scheduled with fire_at that has passed, with no session start or re-schedule of the same nudge on that device in between. Grouped by fire_at date. Focus modes, revoked permission or battery rules can still hide it.",
  receivedForeground:
    "challenge_nudge_received: the app was open when the push fired.",
  firePassedReported:
    "challenge_nudge_fire_passed: on a later open, the device saw that a scheduled push's fire time had passed.",
  shown:
    "challenge_day2_nudge_shown (in-app banner actually rendered; old builds logged push taps here too).",
  tapped: "challenge_day2_nudge_tapped.",
  sessionStartedAfterTap:
    "Tapped, then started a session within 24 hours. Grouped by tap date.",
  nudge: "day2, or followup (followup_day 3 or 5).",
};

function emptyCounts(): Record<NudgeMetric, Set<string>> {
  const out = {} as Record<NudgeMetric, Set<string>>;
  for (const m of NUDGE_METRICS) out[m] = new Set();
  return out;
}

function countsOf(sets: Record<NudgeMetric, Set<string>>): P8NudgeCounts {
  const out = {} as P8NudgeCounts;
  for (const m of NUDGE_METRICS) out[m] = sets[m].size;
  return out;
}

function addDatePlatform(
  map: Map<string, Set<string>>,
  date: string,
  platform: string,
  deviceId: string,
) {
  const key = `${date}\n${platform}`;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(deviceId);
}

function datePlatformRows(map: Map<string, Set<string>>): P8DatePlatformRow[] {
  return Array.from(map.entries())
    .map(([key, set]) => {
      const [date, platform] = key.split("\n");
      return { date, platform, devices: set.size };
    })
    .sort((a, b) =>
      a.date !== b.date
        ? a.date.localeCompare(b.date)
        : a.platform.localeCompare(b.platform),
    );
}

function isDay1Completion(
  eventType: string,
  data: Record<string, unknown> | null,
): boolean {
  if (eventType === "first_session_completed") return true;
  if (eventType === "challenge_day_completed") {
    return data?.day === 1 && (data?.week === undefined || data?.week === 1);
  }
  return false;
}

export function summarizeP8Retention(
  events: P8SummaryEvent[],
  range: P8Range,
  options?: { now?: Date },
): P8RetentionSummary {
  const nowMs = (options?.now ?? new Date()).getTime();
  const inRange = (ms: number) => ms >= range.fromMs && ms < range.toEndMs;

  // Normalise and sort once so "earliest" logic is simple.
  const rows = events
    .map((event) => ({
      event,
      data: asRecord(event.eventData),
      at: eventTime(event.createdAt),
    }))
    .filter(
      (
        r,
      ): r is {
        event: P8SummaryEvent;
        data: Record<string, unknown> | null;
        at: number;
      } => !!r.event.deviceId && r.at != null,
    )
    .sort((a, b) => a.at - b.at);

  // Per-device facts.
  const day1 = new Map<string, { at: number; platform: string }>();
  const sessionStarts = new Map<string, number[]>();
  for (const { event, data, at } of rows) {
    if (isDay1Completion(event.eventType, data) && !day1.has(event.deviceId)) {
      day1.set(event.deviceId, { at, platform: platformOf(event) });
    }
    if (SESSION_START_TYPES.has(event.eventType)) {
      let list = sessionStarts.get(event.deviceId);
      if (!list) {
        list = [];
        sessionStarts.set(event.deviceId, list);
      }
      list.push(at);
    }
  }

  const hasSessionBetween = (
    deviceId: string,
    startMs: number,
    endMs: number,
  ) =>
    (sessionStarts.get(deviceId) ?? []).some((t) => t >= startMs && t < endMs);

  // ── Day-1 completers and second-session cohorts ──────────────────────────
  const day1ByDate = new Map<string, Set<string>>();
  const firstReturnByDate = new Map<string, Set<string>>();
  const challengeDay2ByDate = new Map<string, Set<string>>();

  type CohortAcc = {
    completers: Set<string>;
    within7: Set<string>;
    d2: Set<string>;
    d3: Set<string>;
    d4to8: Set<string>;
    challengeDay2: Set<string>;
    windowComplete: boolean;
  };
  const cohorts = new Map<string, CohortAcc>();
  const cohortAcc = (week: string, platform: string): CohortAcc => {
    const key = `${week}\n${platform}`;
    let acc = cohorts.get(key);
    if (!acc) {
      acc = {
        completers: new Set(),
        within7: new Set(),
        d2: new Set(),
        d3: new Set(),
        d4to8: new Set(),
        challengeDay2: new Set(),
        windowComplete: true,
      };
      cohorts.set(key, acc);
    }
    return acc;
  };

  const challengeDay2Devices = new Set<string>();
  for (const { event, data, at } of rows) {
    if (event.eventType === "challenge_day_started" && data?.day === 2) {
      challengeDay2Devices.add(event.deviceId);
      if (inRange(at)) {
        addDatePlatform(
          challengeDay2ByDate,
          utcDate(at),
          platformOf(event),
          event.deviceId,
        );
      }
    }
  }

  for (const [deviceId, d1] of day1.entries()) {
    const d1Day = dayIndex(d1.at);
    // First session on a later UTC day than Day 1 (any time, for the by-date view).
    const later = (sessionStarts.get(deviceId) ?? []).filter(
      (t) => dayIndex(t) > d1Day,
    );
    const firstLater = later.length ? Math.min(...later) : null;
    if (firstLater != null && inRange(firstLater)) {
      addDatePlatform(
        firstReturnByDate,
        utcDate(firstLater),
        d1.platform,
        deviceId,
      );
    }
    if (!inRange(d1.at)) continue;
    addDatePlatform(day1ByDate, utcDate(d1.at), d1.platform, deviceId);

    const week = utcWeekStart(d1.at);
    // Window: Day-1 date + 1 through Day-1 date + 7 (UTC days).
    const windowEndMs = (d1Day + 8) * DAY_MS;
    for (const platform of [d1.platform, "all"]) {
      const acc = cohortAcc(week, platform);
      acc.completers.add(deviceId);
      if (windowEndMs > nowMs) acc.windowComplete = false;
      if (challengeDay2Devices.has(deviceId)) acc.challengeDay2.add(deviceId);
      if (firstLater != null && firstLater < windowEndMs) {
        acc.within7.add(deviceId);
        const offset = dayIndex(firstLater) - d1Day;
        if (offset === 1) acc.d2.add(deviceId);
        else if (offset === 2) acc.d3.add(deviceId);
        else acc.d4to8.add(deviceId);
      }
    }
  }

  const cohortsByWeek: P8CohortRow[] = Array.from(cohorts.entries())
    .map(([key, acc]) => {
      const [cohortWeek, platform] = key.split("\n");
      const completers = acc.completers.size;
      return {
        cohortWeek,
        platform,
        day1Completers: completers,
        secondSessionWithin7d: acc.within7.size,
        secondSessionRate:
          completers > 0
            ? Math.round((acc.within7.size / completers) * 1000) / 1000
            : null,
        firstReturnDay2: acc.d2.size,
        firstReturnDay3: acc.d3.size,
        firstReturnDay4to8: acc.d4to8.size,
        challengeDay2Started: acc.challengeDay2.size,
        windowComplete: acc.windowComplete,
      };
    })
    .sort((a, b) => {
      if (a.cohortWeek !== b.cohortWeek)
        return a.cohortWeek.localeCompare(b.cohortWeek);
      if (a.platform === "all") return -1;
      if (b.platform === "all") return 1;
      return a.platform.localeCompare(b.platform);
    });

  // ── Nudge funnel ─────────────────────────────────────────────────────────
  const daily = new Map<
    string,
    { key: NudgeKey; date: string; sets: Record<NudgeMetric, Set<string>> }
  >();
  const totals = new Map<
    string,
    { key: NudgeKey; sets: Record<NudgeMetric, Set<string>> }
  >();
  const record = (
    key: NudgeKey,
    ms: number,
    metric: NudgeMetric,
    deviceId: string,
  ) => {
    if (!inRange(ms)) return;
    const date = utcDate(ms);
    const ks = keyString(key);
    const dk = `${date}\n${ks}`;
    let d = daily.get(dk);
    if (!d) {
      d = { key, date, sets: emptyCounts() };
      daily.set(dk, d);
    }
    d.sets[metric].add(deviceId);
    let t = totals.get(ks);
    if (!t) {
      t = { key, sets: emptyCounts() };
      totals.set(ks, t);
    }
    t.sets[metric].add(deviceId);
  };

  // Schedules per device + nudge (for "re-scheduled before fire_at").
  const schedules = new Map<string, number[]>();
  const scheduleKey = (deviceId: string, k: NudgeKey) =>
    `${deviceId}\n${k.nudge}\n${k.followupDay ?? ""}`;
  for (const { event, data, at } of rows) {
    if (event.eventType !== "challenge_day2_nudge_scheduled") continue;
    const sk = scheduleKey(event.deviceId, nudgeKeyOf(event, data));
    let list = schedules.get(sk);
    if (!list) {
      list = [];
      schedules.set(sk, list);
    }
    list.push(at);
  }

  for (const { event, data, at } of rows) {
    switch (event.eventType) {
      case "challenge_day2_nudge_scheduled": {
        const key = nudgeKeyOf(event, data);
        record(key, at, "scheduled", event.deviceId);
        if (key.channel !== "push") break;
        const fireMs =
          typeof data?.fire_at === "string"
            ? Date.parse(data.fire_at)
            : Number.NaN;
        if (!Number.isFinite(fireMs)) break;
        if (fireMs > nowMs) break;
        if (fireMs < at - 60_000 || fireMs > at + MAX_FIRE_AHEAD_MS) break;
        if (hasSessionBetween(event.deviceId, at, fireMs)) break;
        const resched = (
          schedules.get(scheduleKey(event.deviceId, key)) ?? []
        ).some((t) => t > at && t < fireMs);
        if (resched) break;
        record(key, fireMs, "estimatedDelivered", event.deviceId);
        break;
      }
      case "challenge_day2_nudge_shown":
        record(nudgeKeyOf(event, data), at, "shown", event.deviceId);
        break;
      case "challenge_day2_nudge_tapped": {
        const key = nudgeKeyOf(event, data);
        record(key, at, "tapped", event.deviceId);
        if (hasSessionBetween(event.deviceId, at, at + TAP_TO_SESSION_MS)) {
          record(key, at, "sessionStartedAfterTap", event.deviceId);
        }
        break;
      }
      case "challenge_nudge_received":
        record(
          nudgeKeyOf(event, data, "push"),
          at,
          "receivedForeground",
          event.deviceId,
        );
        break;
      case "challenge_nudge_fire_passed":
        record(
          nudgeKeyOf(event, data, "push"),
          at,
          "firePassedReported",
          event.deviceId,
        );
        break;
      default:
        break;
    }
  }

  const sortNudge = (a: P8NudgeRow, b: P8NudgeRow) =>
    a.platform.localeCompare(b.platform) ||
    a.channel.localeCompare(b.channel) ||
    a.nudge.localeCompare(b.nudge) ||
    (a.followupDay ?? 0) - (b.followupDay ?? 0);

  const nudgeTotals: P8NudgeRow[] = Array.from(totals.values())
    .map(({ key, sets }) => ({ ...key, ...countsOf(sets) }))
    .sort(sortNudge);
  const nudgeDaily: P8NudgeDailyRow[] = Array.from(daily.values())
    .map(({ key, date, sets }) => ({ date, ...key, ...countsOf(sets) }))
    .sort((a, b) => a.date.localeCompare(b.date) || sortNudge(a, b));

  // ── Pre-prompt funnel (P8.4) ─────────────────────────────────────────────
  type PreAcc = {
    shown: Set<string>;
    yes: Set<string>;
    notNow: Set<string>;
    dismissed: Set<string>;
    granted: Set<string>;
  };
  const pre = new Map<string, PreAcc>();
  const preAcc = (platform: string, attempt: number | null) => {
    const k = `${platform}\n${attempt ?? ""}`;
    let acc = pre.get(k);
    if (!acc) {
      acc = {
        shown: new Set(),
        yes: new Set(),
        notNow: new Set(),
        dismissed: new Set(),
        granted: new Set(),
      };
      pre.set(k, acc);
    }
    return acc;
  };
  const attemptOf = (data: Record<string, unknown> | null) =>
    data?.attempt === 1 || data?.attempt === 2 ? data.attempt : null;
  for (const { event, data, at } of rows) {
    if (!inRange(at)) continue;
    const platform = platformOf(event);
    if (event.eventType === "push_preprompt_shown") {
      preAcc(platform, attemptOf(data)).shown.add(event.deviceId);
    } else if (event.eventType === "push_preprompt_result") {
      const acc = preAcc(platform, attemptOf(data));
      if (data?.choice === "yes") acc.yes.add(event.deviceId);
      else if (data?.choice === "not_now") acc.notNow.add(event.deviceId);
      else if (data?.choice === "dismissed") acc.dismissed.add(event.deviceId);
    } else if (
      event.eventType === "permission_result" &&
      data?.type === "push" &&
      data?.status === "granted" &&
      (data?.pre_prompt === "day1_complete" ||
        data?.pre_prompt === "second_session")
    ) {
      const attempt = data.pre_prompt === "day1_complete" ? 1 : 2;
      preAcc(platform, attempt).granted.add(event.deviceId);
    }
  }
  const prePrompt: P8PrePromptRow[] = Array.from(pre.entries())
    .map(([k, acc]) => {
      const [platform, attemptRaw] = k.split("\n");
      return {
        platform,
        attempt: attemptRaw === "" ? null : Number(attemptRaw),
        shown: acc.shown.size,
        yes: acc.yes.size,
        notNow: acc.notNow.size,
        dismissed: acc.dismissed.size,
        osGranted: acc.granted.size,
      };
    })
    .sort(
      (a, b) =>
        a.platform.localeCompare(b.platform) ||
        (a.attempt ?? 0) - (b.attempt ?? 0),
    );

  // ── Comeback funnel (P8.5) ───────────────────────────────────────────────
  type CbAcc = {
    shown: Set<string>;
    start: Set<string>;
    notNow: Set<string>;
    completed: Set<string>;
    another: Set<string>;
  };
  const cb = new Map<string, CbAcc>();
  const cbAcc = (platform: string, source: string) => {
    const k = `${platform}\n${source}`;
    let acc = cb.get(k);
    if (!acc) {
      acc = {
        shown: new Set(),
        start: new Set(),
        notNow: new Set(),
        completed: new Set(),
        another: new Set(),
      };
      cb.set(k, acc);
    }
    return acc;
  };
  for (const { event, data, at } of rows) {
    if (!inRange(at)) continue;
    const platform = platformOf(event);
    const source =
      data?.source === "followup" || data?.source === "home"
        ? data.source
        : "home";
    if (event.eventType === "comeback_shown") {
      cbAcc(platform, source).shown.add(event.deviceId);
    } else if (event.eventType === "comeback_tapped") {
      const acc = cbAcc(platform, source);
      if (data?.action === "start") acc.start.add(event.deviceId);
      else if (data?.action === "not_now") acc.notNow.add(event.deviceId);
    } else if (event.eventType === "comeback_completed") {
      const acc = cbAcc(platform, source);
      acc.completed.add(event.deviceId);
      // Another session after this one: any later start beyond a short grace
      // (the comeback session's own session_started comes before completion).
      if (hasSessionBetween(event.deviceId, at + 60_000, at + 7 * DAY_MS)) {
        acc.another.add(event.deviceId);
      }
    }
  }
  const comeback: P8ComebackRow[] = Array.from(cb.entries())
    .map(([k, acc]) => {
      const [platform, source] = k.split("\n");
      return {
        platform,
        source,
        shown: acc.shown.size,
        tappedStart: acc.start.size,
        tappedNotNow: acc.notNow.size,
        completed: acc.completed.size,
        anotherSessionWithin7d: acc.another.size,
      };
    })
    .sort(
      (a, b) =>
        a.platform.localeCompare(b.platform) ||
        a.source.localeCompare(b.source),
    );

  return {
    range: { from: range.from, to: range.to, timezone: "UTC" },
    generatedAt: new Date(nowMs).toISOString(),
    definitions: P8_DEFINITIONS,
    secondSession: {
      cohortsByWeek,
      firstReturnByDate: datePlatformRows(firstReturnByDate),
    },
    day1CompletersByDate: datePlatformRows(day1ByDate),
    challengeDay2StartedByDate: datePlatformRows(challengeDay2ByDate),
    nudges: { totals: nudgeTotals, byDate: nudgeDaily },
    prePrompt,
    comeback,
  };
}
