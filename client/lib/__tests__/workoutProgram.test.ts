import { isRestDayForDate } from "@/data/workoutProgram";

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
