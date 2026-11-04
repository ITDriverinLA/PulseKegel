import { summarizeP7Day1, type P7SummaryEvent } from "../p7AnalyticsSummary";

function event(
  partial: Partial<P7SummaryEvent> &
    Pick<P7SummaryEvent, "deviceId" | "eventType">,
): P7SummaryEvent {
  return {
    platform: "ios",
    eventData: {},
    createdAt: "2026-11-04T20:00:00.000Z",
    ...partial,
  };
}

describe("P7d summary per device", () => {
  it("returns zeros when there are no P7 events", () => {
    expect(summarizeP7Day1([])).toEqual({
      p7Cutoff: null,
      p7CutoffSource: null,
      cardByDevice: { shown: 0, continue: 0, skip: 0, back: 0 },
      abandonsByPhaseAndRep: [],
      day1CompletionByPlatform: [],
    });
  });

  it("counts card actions once per device and dedupes abandon phase/rep", () => {
    const summary = summarizeP7Day1([
      event({
        deviceId: "a",
        eventType: "howto_card_shown",
        createdAt: "2026-11-10T00:00:00.000Z",
      }),
      event({
        deviceId: "a",
        eventType: "howto_card_shown",
        createdAt: "2026-11-10T00:01:00.000Z",
      }),
      event({
        deviceId: "a",
        eventType: "howto_card_dismissed",
        eventData: { action: "continue", dwell_ms: 1200 },
      }),
      event({
        deviceId: "a",
        eventType: "howto_card_dismissed",
        eventData: { action: "continue", dwell_ms: 1200 },
      }),
      event({
        deviceId: "b",
        platform: "android",
        eventType: "howto_card_shown",
        createdAt: "2026-11-11T00:00:00.000Z",
      }),
      event({
        deviceId: "b",
        platform: "android",
        eventType: "howto_card_dismissed",
        eventData: { action: "skip" },
      }),
      event({
        deviceId: "c",
        eventType: "howto_card_shown",
        createdAt: "2026-11-12T00:00:00.000Z",
      }),
      event({
        deviceId: "c",
        eventType: "howto_card_dismissed",
        eventData: { action: "back" },
      }),
      event({
        deviceId: "a",
        eventType: "first_session_abandoned",
        eventData: { progress: 10, phase: "squeeze", rep_index: 1 },
      }),
      event({
        deviceId: "a",
        eventType: "first_session_abandoned",
        eventData: { progress: 10, phase: "squeeze", rep_index: 1 },
      }),
      event({
        deviceId: "b",
        platform: "android",
        eventType: "first_session_abandoned",
        eventData: { progress: 20, phase: "rest", rep_index: 3 },
      }),
      event({
        deviceId: "d",
        eventType: "first_session_abandoned",
        eventData: { progress: 5 },
      }),
    ]);

    expect(summary.p7Cutoff).toBe("2026-11-10T00:00:00.000Z");
    expect(summary.p7CutoffSource).toBe("first_howto_card_shown");
    expect(summary.cardByDevice).toEqual({
      shown: 3,
      continue: 1,
      skip: 1,
      back: 1,
    });
    expect(summary.abandonsByPhaseAndRep).toEqual([
      { phase: "rest", repIndex: 3, devices: 1 },
      { phase: "squeeze", repIndex: 1, devices: 1 },
      { phase: "unspecified", repIndex: null, devices: 1 },
    ]);
  });

  it("splits Day-1 completion by platform using the first card shown as the cutoff", () => {
    const summary = summarizeP7Day1([
      event({
        deviceId: "card",
        eventType: "howto_card_shown",
        createdAt: "2026-11-20T12:00:00.000Z",
      }),
      event({
        deviceId: "old-ios",
        platform: "ios",
        eventType: "first_session_completed",
        createdAt: "2026-11-01T00:00:00.000Z",
      }),
      event({
        deviceId: "old-ios",
        platform: "ios",
        eventType: "first_session_completed",
        createdAt: "2026-11-21T00:00:00.000Z",
      }),
      event({
        deviceId: "new-ios",
        platform: "ios",
        eventType: "first_session_completed",
        createdAt: "2026-11-20T12:00:00.000Z",
      }),
      event({
        deviceId: "new-android",
        platform: "android",
        eventType: "first_session_completed",
        createdAt: "2026-11-21T00:00:00.000Z",
      }),
      event({
        deviceId: "also-android",
        platform: "android",
        eventType: "first_session_completed",
        createdAt: "2026-10-01T00:00:00.000Z",
      }),
    ]);

    expect(summary.p7Cutoff).toBe("2026-11-20T12:00:00.000Z");
    expect(summary.p7CutoffSource).toBe("first_howto_card_shown");
    expect(summary.day1CompletionByPlatform).toEqual([
      { platform: "android", completed: 2, completedSinceP7: 1 },
      { platform: "ios", completed: 2, completedSinceP7: 1 },
    ]);
  });

  it("uses P7_CUTOFF_ISO instead of an early howto_card_shown", () => {
    const events = [
      event({
        deviceId: "testflight",
        eventType: "howto_card_shown",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      event({
        deviceId: "before",
        platform: "ios",
        eventType: "first_session_completed",
        createdAt: "2026-06-01T00:00:00.000Z",
      }),
      event({
        deviceId: "after",
        platform: "android",
        eventType: "first_session_completed",
        createdAt: "2026-11-20T12:00:00.000Z",
      }),
    ];

    const fromEnv = summarizeP7Day1(events, {
      cutoffIso: "2026-11-20T00:00:00.000Z",
    });
    expect(fromEnv.p7Cutoff).toBe("2026-11-20T00:00:00.000Z");
    expect(fromEnv.p7CutoffSource).toBe("env");
    expect(fromEnv.day1CompletionByPlatform).toEqual([
      { platform: "android", completed: 1, completedSinceP7: 1 },
      { platform: "ios", completed: 1, completedSinceP7: 0 },
    ]);

    const unset = summarizeP7Day1(events, { cutoffIso: "  " });
    expect(unset.p7Cutoff).toBe("2026-01-01T00:00:00.000Z");
    expect(unset.p7CutoffSource).toBe("first_howto_card_shown");
    expect(unset.day1CompletionByPlatform).toEqual([
      { platform: "android", completed: 1, completedSinceP7: 1 },
      { platform: "ios", completed: 1, completedSinceP7: 1 },
    ]);

    const invalid = summarizeP7Day1(events, { cutoffIso: "not-a-date" });
    expect(invalid.p7Cutoff).toBeNull();
    expect(invalid.p7CutoffSource).toBe("env");
    expect(invalid.day1CompletionByPlatform).toEqual([
      { platform: "android", completed: 1, completedSinceP7: 0 },
      { platform: "ios", completed: 1, completedSinceP7: 0 },
    ]);
  });
});
