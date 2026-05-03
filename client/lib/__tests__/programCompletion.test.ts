import {
  getCompletionTier,
  evaluateTwelveWeekCompletion,
  isTwelveWeekWindowComplete,
  addDaysISO,
  getTwelveWeekEndDate,
  CONTROL_MODE_WEEKLY_TARGET,
  getControlModeWeeklyCount,
  getISOWeekStartDate,
  PROGRAM_LENGTH_DAYS,
  STRONG_THRESHOLD,
  PARTIAL_THRESHOLD,
} from "../programCompletion";

describe("getCompletionTier", () => {
  test("low tier below partial threshold", () => {
    expect(getCompletionTier(0)).toBe("low");
    expect(getCompletionTier(34)).toBe("low");
  });

  test("partial tier at lower boundary", () => {
    expect(getCompletionTier(PARTIAL_THRESHOLD)).toBe("partial");
    expect(getCompletionTier(35)).toBe("partial");
  });

  test("partial tier at upper boundary", () => {
    expect(getCompletionTier(59)).toBe("partial");
  });

  test("strong tier at lower boundary", () => {
    expect(getCompletionTier(STRONG_THRESHOLD)).toBe("strong");
    expect(getCompletionTier(60)).toBe("strong");
  });

  test("strong tier above", () => {
    expect(getCompletionTier(84)).toBe("strong");
  });
});

describe("addDaysISO and getTwelveWeekEndDate", () => {
  test("adds days correctly across month boundary", () => {
    expect(addDaysISO("2026-01-30", 5)).toBe("2026-02-04");
  });

  test("twelve-week end is 84 days after start", () => {
    const end = getTwelveWeekEndDate("2026-01-01");
    expect(end).toBe(addDaysISO("2026-01-01", 84));
    expect(end).toBe("2026-03-26");
  });
});

describe("isTwelveWeekWindowComplete", () => {
  test("not complete on day before end", () => {
    const start = "2026-01-01";
    const dayBefore = addDaysISO(start, PROGRAM_LENGTH_DAYS - 1);
    expect(isTwelveWeekWindowComplete(start, dayBefore)).toBe(false);
  });

  test("complete on end day (day 84)", () => {
    const start = "2026-01-01";
    const endDay = addDaysISO(start, PROGRAM_LENGTH_DAYS);
    expect(isTwelveWeekWindowComplete(start, endDay)).toBe(true);
  });

  test("complete after end day", () => {
    const start = "2026-01-01";
    const after = addDaysISO(start, PROGRAM_LENGTH_DAYS + 5);
    expect(isTwelveWeekWindowComplete(start, after)).toBe(true);
  });

  test("not complete with null start", () => {
    expect(isTwelveWeekWindowComplete(null, "2026-05-01")).toBe(false);
  });
});

describe("evaluateTwelveWeekCompletion", () => {
  const start = "2026-01-01";

  test("counts unique non-rest days inside window", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(3);
    expect(result.tier).toBe("low");
  });

  test("excludes rest days from training count", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];
    const rest = ["2026-01-02"];
    const result = evaluateTwelveWeekCompletion(dates, rest, start);
    expect(result.uniqueTrainingDays).toBe(2);
  });

  test("dedupes duplicate dates", () => {
    const dates = ["2026-01-01", "2026-01-01", "2026-01-02"];
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(2);
  });

  test("excludes dates before start", () => {
    const dates = ["2025-12-31", "2026-01-01"];
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(1);
  });

  test("excludes dates on or after window end (exclusive)", () => {
    const endDay = addDaysISO(start, PROGRAM_LENGTH_DAYS);
    const dayBefore = addDaysISO(start, PROGRAM_LENGTH_DAYS - 1);
    const dates = [dayBefore, endDay];
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(1);
  });

  test("strong tier with 60 unique training days", () => {
    const dates: string[] = [];
    for (let i = 0; i < 60; i++) dates.push(addDaysISO(start, i));
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(60);
    expect(result.tier).toBe("strong");
  });

  test("partial tier with 35 unique training days (boundary)", () => {
    const dates: string[] = [];
    for (let i = 0; i < 35; i++) dates.push(addDaysISO(start, i));
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(35);
    expect(result.tier).toBe("partial");
  });

  test("low tier with 34 unique training days (just below)", () => {
    const dates: string[] = [];
    for (let i = 0; i < 34; i++) dates.push(addDaysISO(start, i));
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.uniqueTrainingDays).toBe(34);
    expect(result.tier).toBe("low");
  });

  test("partial tier at 59 (just below strong)", () => {
    const dates: string[] = [];
    for (let i = 0; i < 59; i++) dates.push(addDaysISO(start, i));
    const result = evaluateTwelveWeekCompletion(dates, [], start);
    expect(result.tier).toBe("partial");
  });
});

describe("CONTROL_MODE_WEEKLY_TARGET", () => {
  test("each path has expected weekly target", () => {
    expect(CONTROL_MODE_WEEKLY_TARGET.maintain).toBe(4);
    expect(CONTROL_MODE_WEEKLY_TARGET.build).toBe(6);
    expect(CONTROL_MODE_WEEKLY_TARGET.precision).toBe(5);
    expect(CONTROL_MODE_WEEKLY_TARGET.rebuild).toBe(3);
  });
});

describe("getISOWeekStartDate", () => {
  test("Monday returns same date", () => {
    expect(getISOWeekStartDate("2026-01-05")).toBe("2026-01-05");
  });

  test("Sunday returns previous Monday", () => {
    expect(getISOWeekStartDate("2026-01-04")).toBe("2025-12-29");
  });

  test("Wednesday returns Monday of same week", () => {
    expect(getISOWeekStartDate("2026-01-07")).toBe("2026-01-05");
  });
});

describe("getControlModeWeeklyCount", () => {
  test("counts non-rest sessions in current ISO week", () => {
    const today = "2026-01-08";
    const completed = [
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2025-12-31",
    ];
    expect(getControlModeWeeklyCount(completed, [], today)).toBe(4);
  });

  test("excludes rest days", () => {
    const today = "2026-01-08";
    const completed = ["2026-01-05", "2026-01-06", "2026-01-07"];
    const rest = ["2026-01-06"];
    expect(getControlModeWeeklyCount(completed, rest, today)).toBe(2);
  });

  test("excludes future dates relative to today", () => {
    const today = "2026-01-06";
    const completed = ["2026-01-05", "2026-01-06", "2026-01-07"];
    expect(getControlModeWeeklyCount(completed, [], today)).toBe(2);
  });
});
