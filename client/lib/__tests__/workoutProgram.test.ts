import { isRestDayForDate } from "@/data/workoutProgram";
import {
  describeFirstSessionLengthChange,
  FIRST_SESSION_VARIANT_SHORT_DAY1,
  getFirstSessionPlannedSteps,
  getFirstSessionWorkout,
  getLegacyFirstSessionWorkout,
} from "@/data/workoutProgram";

describe("isRestDayForDate — personalized Week 1 schedule", () => {
  const startDate = "2026-07-15";
  const dayTwo = new Date(2026, 6, 16);

  it("treats accelerated Day 2 as a training day", () => {
    expect(isRestDayForDate(dayTwo, startDate, "accelerated")).toBe(false);
  });

  it("keeps Day 2 as a rest day for standard and gentle paths", () => {
    expect(isRestDayForDate(dayTwo, startDate, "standard")).toBe(true);
    expect(isRestDayForDate(dayTwo, startDate, "gentle")).toBe(true);
  });
});

describe("F2 short first-win session", () => {
  it("is ~40–60% shorter than the legacy calibration gate workout", () => {
    const change = describeFirstSessionLengthChange();
    expect(change.beforeSegments).toBe(7);
    expect(change.afterSegments).toBe(3);
    expect(change.segmentReductionPct).toBeGreaterThanOrEqual(40);
    expect(change.segmentReductionPct).toBeLessThanOrEqual(60);
    expect(change.minuteReductionPct).toBeGreaterThanOrEqual(40);
    expect(change.minuteReductionPct).toBeLessThanOrEqual(60);
    expect(change.afterMinutes).toBe(2);
    expect(change.beforeMinutes).toBe(4);
    expect(change.afterMinutes).toBeLessThan(change.beforeMinutes);
  });

  it("follows intro → one clear win → cool-down", () => {
    const workout = getFirstSessionWorkout(FIRST_SESSION_VARIANT_SHORT_DAY1);
    expect(workout.id).toBe("fs-short-day1");
    expect(workout.segments).toHaveLength(3);
    expect(workout.segments[0].type).toBe("getReady");
    expect(workout.segments[1].type).toBe("slowHolds");
    expect(workout.segments[2].type).toBe("breathing");
    expect(getFirstSessionPlannedSteps(workout)).toBe(3);
    const legacy = getLegacyFirstSessionWorkout();
    expect(legacy.segments.length).toBeGreaterThan(workout.segments.length);
  });

  it("uses claim-safe coach-not-doctor copy", () => {
    const workout = getFirstSessionWorkout();
    const blob = [
      workout.name,
      ...workout.segments.map((s) => `${s.name} ${s.instructions}`),
    ]
      .join(" ")
      .toLowerCase();
    expect(blob).not.toMatch(
      /\btreat(?:s|ment|ing)?\b|\bcure[sd]?\b|\bdiagnos/,
    );
    expect(blob).toMatch(/coach/);
    expect(blob).toMatch(/not medical advice/);
  });
});
