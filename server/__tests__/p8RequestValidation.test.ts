import { analyticsBatchSchema } from "../requestValidation";

const deviceId = "a".repeat(64);
const parse = (type: string, data: unknown) =>
  analyticsBatchSchema.safeParse({
    deviceId,
    events: [{ type, data, platform: "ios", appVersion: "2.2.6" }],
  }).success;

describe("P8 analytics validation", () => {
  it("still accepts old Day-2 nudge events with channel only", () => {
    expect(parse("challenge_day2_nudge_scheduled", { channel: "push" })).toBe(
      true,
    );
    expect(parse("challenge_day2_nudge_shown", { channel: "in_app" })).toBe(
      true,
    );
    expect(parse("challenge_day2_nudge_tapped", { channel: "push" })).toBe(
      true,
    );
    expect(
      parse("permission_result", {
        type: "push",
        status: "granted",
        surface: "x",
      }),
    ).toBe(true);
  });

  it("accepts the new optional nudge props", () => {
    expect(
      parse("challenge_day2_nudge_scheduled", {
        channel: "push",
        followup_day: 3,
        fire_at: "2026-11-20T09:00:00.000-08:00",
      }),
    ).toBe(true);
    expect(
      parse("challenge_day2_nudge_shown", {
        channel: "in_app",
        followup_day: 5,
      }),
    ).toBe(true);
    expect(
      parse("challenge_day2_nudge_tapped", {
        channel: "push",
        followup_day: 5,
      }),
    ).toBe(true);
  });

  it("rejects bad follow-up days, fire_at and unknown props", () => {
    expect(
      parse("challenge_day2_nudge_scheduled", {
        channel: "push",
        followup_day: 4,
      }),
    ).toBe(false);
    expect(
      parse("challenge_day2_nudge_scheduled", {
        channel: "push",
        fire_at: "tomorrow",
      }),
    ).toBe(false);
    expect(
      parse("challenge_day2_nudge_scheduled", {
        channel: "push",
        fire_at: "2026-11-20T09:00:00.000000000000000000000Z",
      }),
    ).toBe(false);
    expect(
      parse("challenge_day2_nudge_tapped", { channel: "push", extra: 1 }),
    ).toBe(false);
  });

  it("accepts the new P8 events", () => {
    expect(
      parse("challenge_nudge_received", {
        nudge: "day2",
        method: "foreground",
      }),
    ).toBe(true);
    expect(
      parse("challenge_nudge_fire_passed", {
        nudge: "followup",
        followup_day: 3,
        permission_status: "denied",
      }),
    ).toBe(true);
    expect(parse("push_preprompt_shown", { surface: "home", attempt: 1 })).toBe(
      true,
    );
    expect(
      parse("push_preprompt_result", {
        surface: "home",
        attempt: 2,
        choice: "dismissed",
      }),
    ).toBe(true);
    expect(
      parse("permission_prompt_shown", {
        type: "push",
        pre_prompt: "day1_complete",
      }),
    ).toBe(true);
    expect(
      parse("permission_result", {
        type: "push",
        status: "granted",
        pre_prompt: "second_session",
      }),
    ).toBe(true);
    expect(parse("comeback_shown", { idle_days: 2, has_access: false })).toBe(
      true,
    );
    expect(
      parse("comeback_tapped", {
        idle_days: 2,
        has_access: true,
        action: "not_now",
        source: "home",
      }),
    ).toBe(true);
    expect(
      parse("comeback_completed", { idle_days: 4, source: "followup" }),
    ).toBe(true);
  });

  it("rejects bad enums on the new events", () => {
    expect(
      parse("challenge_nudge_received", {
        nudge: "day2",
        method: "background",
      }),
    ).toBe(false);
    expect(parse("push_preprompt_shown", { surface: "home", attempt: 3 })).toBe(
      false,
    );
    expect(
      parse("push_preprompt_result", {
        surface: "home",
        attempt: 1,
        choice: "maybe",
      }),
    ).toBe(false);
    expect(
      parse("permission_result", {
        type: "push",
        status: "granted",
        pre_prompt: "x",
      }),
    ).toBe(false);
    expect(
      parse("comeback_tapped", {
        idle_days: 2,
        has_access: true,
        action: "later",
      }),
    ).toBe(false);
    expect(parse("comeback_shown", { idle_days: -1, has_access: true })).toBe(
      false,
    );
  });
});
