import {
  resolveP8Range,
  summarizeP8Retention,
  utcWeekStart,
  type P8SummaryEvent,
} from "../p8RetentionSummary";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const D = "d".repeat(64);

function ev(
  deviceId: string,
  platform: string | null,
  eventType: string,
  createdAt: string,
  eventData: unknown = {},
): P8SummaryEvent {
  return { deviceId, platform, eventType, eventData, createdAt };
}

// Range: Mon Nov 9 – Sun Nov 15, 2026 (UTC). "now" is well after, so windows are closed.
const NOW = new Date("2026-11-30T12:00:00.000Z");
const range = (() => {
  const r = resolveP8Range("2026-11-09", "2026-11-15", NOW);
  if (!r.ok) throw new Error(r.error);
  return r.range;
})();

describe("resolveP8Range", () => {
  const now = new Date("2026-11-17T20:00:00.000Z");
  it("defaults to the last 7 UTC days", () => {
    const r = resolveP8Range(undefined, "", now);
    expect(r).toMatchObject({
      ok: true,
      range: { from: "2026-11-11", to: "2026-11-17" },
    });
  });
  it("rejects bad dates, inverted and oversized ranges", () => {
    expect(resolveP8Range("2026-02-31", "2026-03-01", now).ok).toBe(false);
    expect(resolveP8Range("11/01/2026", undefined, now).ok).toBe(false);
    expect(resolveP8Range("2026-11-10", "2026-11-01", now).ok).toBe(false);
    expect(resolveP8Range("2026-01-01", "2026-11-01", now).ok).toBe(false);
    expect(resolveP8Range(["2026-11-01"], undefined, now).ok).toBe(false);
  });
  it("treats to as inclusive", () => {
    const r = resolveP8Range("2026-11-09", "2026-11-09", now);
    if (!r.ok) throw new Error(r.error);
    expect(r.range.toEndMs - r.range.fromMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("utcWeekStart", () => {
  it("returns the Monday", () => {
    expect(utcWeekStart(Date.parse("2026-11-15T23:59:00Z"))).toBe("2026-11-09");
    expect(utcWeekStart(Date.parse("2026-11-16T00:00:00Z"))).toBe("2026-11-16");
  });
});

describe("summarizeP8Retention — second-session start rate", () => {
  const events: P8SummaryEvent[] = [
    // A (ios): Day 1 Nov 9, comes back Nov 10 (Day 2) — twice, counted once.
    ev(A, "ios", "session_started", "2026-11-09T15:00:00Z", { dayNumber: 1 }),
    ev(A, "ios", "first_session_completed", "2026-11-09T15:05:00Z"),
    ev(A, "ios", "challenge_day_completed", "2026-11-09T15:05:01Z", {
      week: 1,
      day: 1,
    }),
    ev(A, "ios", "session_started", "2026-11-10T09:00:00Z", { dayNumber: 2 }),
    ev(A, "ios", "challenge_day_started", "2026-11-10T09:00:01Z", {
      week: 1,
      day: 2,
    }),
    ev(A, "ios", "session_started", "2026-11-10T18:00:00Z"),
    // B (android): Day 1 Nov 10, another session same day (not a return), back Nov 12 (Day 3).
    ev(B, "android", "first_session_completed", "2026-11-10T10:00:00Z"),
    ev(B, "android", "session_started", "2026-11-10T20:00:00Z"),
    ev(B, "android", "session_started", "2026-11-12T09:30:00Z"),
    // C (android): Day 1 Nov 11, never returns.
    ev(C, "android", "first_session_completed", "2026-11-11T10:00:00Z"),
    // D (android): Day 1 Nov 12, returns Nov 25 (outside 7 days).
    ev(D, "android", "challenge_day_completed", "2026-11-12T10:00:00Z", {
      week: 1,
      day: 1,
    }),
    ev(D, "android", "session_started", "2026-11-25T10:00:00Z"),
  ];
  const s = summarizeP8Retention(events, range, { now: NOW });

  it("computes the weekly cohort rate per platform and overall", () => {
    const all = s.secondSession.cohortsByWeek.find((r) => r.platform === "all");
    expect(all).toEqual({
      cohortWeek: "2026-11-09",
      platform: "all",
      day1Completers: 4,
      secondSessionWithin7d: 2,
      secondSessionRate: 0.5,
      firstReturnDay2: 1,
      firstReturnDay3: 1,
      firstReturnDay4to8: 0,
      challengeDay2Started: 1,
      windowComplete: true,
    });
    const ios = s.secondSession.cohortsByWeek.find((r) => r.platform === "ios");
    expect(ios).toMatchObject({
      day1Completers: 1,
      secondSessionWithin7d: 1,
      secondSessionRate: 1,
    });
    const android = s.secondSession.cohortsByWeek.find(
      (r) => r.platform === "android",
    );
    expect(android).toMatchObject({
      day1Completers: 3,
      secondSessionWithin7d: 1,
      secondSessionRate: 0.333,
      firstReturnDay3: 1,
    });
  });

  it("counts Day-1 completers by date as distinct devices", () => {
    expect(s.day1CompletersByDate).toEqual([
      { date: "2026-11-09", platform: "ios", devices: 1 },
      { date: "2026-11-10", platform: "android", devices: 1 },
      { date: "2026-11-11", platform: "android", devices: 1 },
      { date: "2026-11-12", platform: "android", devices: 1 },
    ]);
    expect(s.secondSession.firstReturnByDate).toEqual([
      { date: "2026-11-10", platform: "ios", devices: 1 },
      { date: "2026-11-12", platform: "android", devices: 1 },
    ]);
    expect(s.challengeDay2StartedByDate).toEqual([
      { date: "2026-11-10", platform: "ios", devices: 1 },
    ]);
  });

  it("marks a cohort open while the 7-day window is still running", () => {
    const early = summarizeP8Retention(events, range, {
      now: new Date("2026-11-16T00:00:00Z"),
    });
    expect(early.secondSession.cohortsByWeek[0].windowComplete).toBe(false);
  });

  it("ignores Day-1 completions outside the range", () => {
    const r = resolveP8Range("2026-11-16", "2026-11-22", NOW);
    if (!r.ok) throw new Error(r.error);
    const later = summarizeP8Retention(events, r.range, { now: NOW });
    expect(later.secondSession.cohortsByWeek).toEqual([]);
  });
});

describe("summarizeP8Retention — nudge funnel", () => {
  const events: P8SummaryEvent[] = [
    // A: push scheduled Nov 9 for Nov 10 09:00, delivered (no session before), tapped, session.
    ev(A, "ios", "challenge_day2_nudge_scheduled", "2026-11-09T15:06:00Z", {
      channel: "push",
      fire_at: "2026-11-10T09:00:00.000Z",
    }),
    ev(A, "ios", "challenge_nudge_received", "2026-11-10T09:00:01Z", {
      nudge: "day2",
      method: "foreground",
    }),
    ev(A, "ios", "challenge_day2_nudge_tapped", "2026-11-10T09:01:00Z", {
      channel: "push",
    }),
    ev(A, "ios", "challenge_day2_nudge_tapped", "2026-11-10T09:02:00Z", {
      channel: "push",
    }),
    ev(A, "ios", "session_started", "2026-11-10T09:03:00Z"),
    // B: push scheduled, but B starts a session before fire_at -> not delivered.
    ev(B, "ios", "challenge_day2_nudge_scheduled", "2026-11-09T15:00:00Z", {
      channel: "push",
      fire_at: "2026-11-10T09:00:00Z",
    }),
    ev(B, "ios", "session_started", "2026-11-10T07:00:00Z"),
    // C: follow-up day 3 push; fire passed reported on a later open.
    ev(C, "android", "challenge_day2_nudge_scheduled", "2026-11-09T12:00:00Z", {
      channel: "push",
      followup_day: 3,
      fire_at: "2026-11-11T09:00:00Z",
    }),
    ev(C, "android", "challenge_nudge_fire_passed", "2026-11-12T10:00:00Z", {
      nudge: "followup",
      followup_day: 3,
      permission_status: "granted",
    }),
    // C: re-scheduled day-5 follow-up replaces the first before it fires.
    ev(C, "android", "challenge_day2_nudge_scheduled", "2026-11-09T12:00:00Z", {
      channel: "push",
      followup_day: 5,
      fire_at: "2026-11-13T09:00:00Z",
    }),
    ev(C, "android", "challenge_day2_nudge_scheduled", "2026-11-12T12:00:00Z", {
      channel: "push",
      followup_day: 5,
      fire_at: "2026-11-14T09:00:00Z",
    }),
    // D: old client, in-app channel only, no fire_at; shown twice.
    ev(D, "web", "challenge_day2_nudge_scheduled", "2026-11-09T10:00:00Z", {
      channel: "in_app",
    }),
    ev(D, "web", "challenge_day2_nudge_shown", "2026-11-10T10:00:00Z", {
      channel: "in_app",
    }),
    ev(D, "web", "challenge_day2_nudge_shown", "2026-11-10T11:00:00Z", {
      channel: "in_app",
    }),
    // Not yet fired relative to now -> not delivered.
    ev(D, "web", "challenge_day2_nudge_scheduled", "2026-11-15T10:00:00Z", {
      channel: "push",
      fire_at: "2026-12-01T09:00:00Z",
    }),
  ];
  const s = summarizeP8Retention(events, range, { now: NOW });
  const total = (
    platform: string,
    channel: string,
    nudge: string,
    followupDay: number | null,
  ) =>
    s.nudges.totals.find(
      (r) =>
        r.platform === platform &&
        r.channel === channel &&
        r.nudge === nudge &&
        r.followupDay === followupDay,
    );

  it("separates estimated delivery, foreground receipt and taps (distinct devices)", () => {
    expect(total("ios", "push", "day2", null)).toEqual({
      platform: "ios",
      channel: "push",
      nudge: "day2",
      followupDay: null,
      scheduled: 2,
      estimatedDelivered: 1,
      receivedForeground: 1,
      firePassedReported: 0,
      shown: 0,
      tapped: 1,
      sessionStartedAfterTap: 1,
    });
  });

  it("groups follow-ups by followup_day and drops re-scheduled pushes", () => {
    expect(total("android", "push", "followup", 3)).toMatchObject({
      scheduled: 1,
      estimatedDelivered: 1,
      firePassedReported: 1,
    });
    // First day-5 schedule was replaced; the second fires Nov 14 and counts once.
    expect(total("android", "push", "followup", 5)).toMatchObject({
      scheduled: 1,
      estimatedDelivered: 1,
    });
    const d5 = s.nudges.byDate.filter(
      (r) => r.followupDay === 5 && r.estimatedDelivered > 0,
    );
    expect(d5.map((r) => r.date)).toEqual(["2026-11-14"]);
  });

  it("keeps old-client in-app events and does not count future fire times", () => {
    expect(total("web", "in_app", "day2", null)).toMatchObject({
      scheduled: 1,
      shown: 1,
    });
    expect(total("web", "push", "day2", null)).toMatchObject({
      scheduled: 1,
      estimatedDelivered: 0,
    });
  });
});

describe("summarizeP8Retention — pre-prompt and comeback funnels", () => {
  const events: P8SummaryEvent[] = [
    ev(A, "ios", "push_preprompt_shown", "2026-11-09T16:00:00Z", {
      surface: "home",
      attempt: 1,
    }),
    ev(A, "ios", "push_preprompt_result", "2026-11-09T16:00:05Z", {
      surface: "home",
      attempt: 1,
      choice: "yes",
    }),
    ev(A, "ios", "permission_result", "2026-11-09T16:00:09Z", {
      type: "push",
      status: "granted",
      pre_prompt: "day1_complete",
    }),
    ev(B, "android", "push_preprompt_shown", "2026-11-09T16:00:00Z", {
      surface: "home",
      attempt: 1,
    }),
    ev(B, "android", "push_preprompt_result", "2026-11-09T16:00:05Z", {
      surface: "home",
      attempt: 1,
      choice: "not_now",
    }),
    ev(C, "ios", "comeback_shown", "2026-11-11T08:00:00Z", {
      idle_days: 3,
      has_access: true,
    }),
    ev(C, "ios", "comeback_tapped", "2026-11-11T08:00:10Z", {
      idle_days: 3,
      has_access: true,
      action: "start",
    }),
    ev(C, "ios", "session_started", "2026-11-11T08:00:11Z"),
    ev(C, "ios", "comeback_completed", "2026-11-11T08:02:30Z", {
      idle_days: 3,
    }),
    ev(C, "ios", "session_started", "2026-11-13T08:00:00Z"),
  ];
  const s = summarizeP8Retention(events, range, { now: NOW });

  it("counts the pre-prompt funnel by platform and attempt", () => {
    expect(s.prePrompt).toEqual([
      {
        platform: "android",
        attempt: 1,
        shown: 1,
        yes: 0,
        notNow: 1,
        dismissed: 0,
        osGranted: 0,
      },
      {
        platform: "ios",
        attempt: 1,
        shown: 1,
        yes: 1,
        notNow: 0,
        dismissed: 0,
        osGranted: 1,
      },
    ]);
  });

  it("counts the comeback funnel and the next session after it", () => {
    expect(s.comeback).toEqual([
      {
        platform: "ios",
        source: "home",
        shown: 1,
        tappedStart: 1,
        tappedNotNow: 0,
        completed: 1,
        anotherSessionWithin7d: 1,
      },
    ]);
  });
});
