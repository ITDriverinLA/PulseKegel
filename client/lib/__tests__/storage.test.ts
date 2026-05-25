import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRestDayForDate } from "@/data/workoutProgram";
import { storage } from "../storage";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) =>
        Promise.resolve(store.has(k) ? (store.get(k) as string) : null),
      ),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((k) => store.delete(k));
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
      __store: store,
    },
  };
});

jest.mock("@/data/workoutProgram", () => ({
  isRestDayForDate: jest.fn(),
  getWorkoutCompletionsForWeek: jest.fn().mockReturnValue(0),
  getScheduledDaysForWeek: jest.fn().mockReturnValue(3),
}));

const mockIsRestDayForDate = isRestDayForDate as jest.MockedFunction<
  typeof isRestDayForDate
>;

const store = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;

const TODAY = "2026-05-21";
const YESTERDAY = "2026-05-20";
const TWO_DAYS_AGO = "2026-05-19";
const THREE_DAYS_AGO = "2026-05-18";
const FOUR_DAYS_AGO = "2026-05-17";

const PROGRAM_START_DATE = YESTERDAY;

const localDateStr = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const makeControlScoreState = (overrides: object = {}) => ({
  controlScore: 300,
  currentRank: "Capable",
  currentStreak: 3,
  idleDays: 0,
  lastSessionDate: THREE_DAYS_AGO,
  lastScoreUpdateDate: THREE_DAYS_AGO,
  highestRankAchieved: "Capable",
  highestScoreAchieved: 300,
  eliteAchieved: false,
  scoreHistory: [],
  backfilled: true,
  backfillVersion: 2,
  ...overrides,
});

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  jest.useRealTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe("backfillRestDays — rest-day streak regression", () => {
  it("adds today to completedDates and restDates when today is a scheduled program rest day", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    mockIsRestDayForDate.mockImplementation((date: Date) => {
      return localDateStr(date) === TODAY;
    });

    const changed = await storage.backfillRestDays(PROGRAM_START_DATE);

    const completedDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_completed_dates")) ?? "[]",
    );
    const restDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_rest_dates")) ?? "[]",
    );

    expect(changed).toBe(true);
    expect(completedDates).toContain(TODAY);
    expect(restDates).toContain(TODAY);
  });

  it("streak is not 0 after backfilling today as a rest day following a workout yesterday", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([YESTERDAY]),
    );

    mockIsRestDayForDate.mockImplementation((date: Date) => {
      return localDateStr(date) === TODAY;
    });

    await storage.backfillRestDays(PROGRAM_START_DATE);

    const progress = await storage.getProgress();
    expect(progress.currentStreak).toBeGreaterThan(0);
    expect(progress.currentStreak).toBe(2);
  });

  it("streak is not 0 when the only completed date is today's backfilled rest day", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    mockIsRestDayForDate.mockImplementation((date: Date) => {
      return localDateStr(date) === TODAY;
    });

    await storage.backfillRestDays(PROGRAM_START_DATE);

    const progress = await storage.getProgress();
    expect(progress.currentStreak).toBeGreaterThan(0);
  });
});

describe("markRestDay — breathwork rest-day streak regression", () => {
  it("streak is not 0 after marking today as a rest day with no prior activity", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    await storage.markRestDay(TODAY);

    const progress = await storage.getProgress();
    expect(progress.currentStreak).toBeGreaterThan(0);
  });

  it("streak is 2 after marking today as a rest day when a workout was completed yesterday", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([YESTERDAY]),
    );

    await storage.markRestDay(TODAY);

    const progress = await storage.getProgress();
    expect(progress.currentStreak).toBe(2);
  });
});

describe("applyDailyDecay — rest days suppress score decay", () => {
  it("does not apply decay when today is a backfilled rest day (app opened on rest day after session yesterday)", async () => {
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify(
        makeControlScoreState({
          currentStreak: 5,
          idleDays: 0,
          lastSessionDate: YESTERDAY,
          lastScoreUpdateDate: YESTERDAY,
        }),
      ),
    );

    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify([TODAY]),
    );
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([YESTERDAY, TODAY]),
    );

    const result = await storage.applyDailyDecay(TODAY);

    expect(result.controlScore).toBe(300);
    expect(result.idleDays).toBe(0);
  });

  it("does not apply decay when the app was closed overnight and all gap days are backfilled rest days", async () => {
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify(
        makeControlScoreState({
          currentStreak: 3,
          idleDays: 0,
          lastSessionDate: THREE_DAYS_AGO,
          lastScoreUpdateDate: THREE_DAYS_AGO,
        }),
      ),
    );

    const restDays = [TWO_DAYS_AGO, YESTERDAY, TODAY];
    await AsyncStorage.setItem(
      "pulsekegel_rest_dates",
      JSON.stringify(restDays),
    );
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(restDays),
    );

    const result = await storage.applyDailyDecay(TODAY);

    expect(result.controlScore).toBe(300);
    expect(result.idleDays).toBe(0);
  });

  it("applies decay normally when gap days are NOT rest days (3+ idle days trigger decay)", async () => {
    await AsyncStorage.setItem(
      "pulsekegel_control_score_state",
      JSON.stringify(
        makeControlScoreState({
          currentStreak: 3,
          idleDays: 0,
          lastSessionDate: FOUR_DAYS_AGO,
          lastScoreUpdateDate: FOUR_DAYS_AGO,
        }),
      ),
    );

    await AsyncStorage.setItem("pulsekegel_rest_dates", JSON.stringify([]));
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([]),
    );

    const result = await storage.applyDailyDecay(TODAY);

    expect(result.controlScore).toBeLessThan(300);
    expect(result.idleDays).toBeGreaterThan(0);
  });
});

describe("program wrap-around after 84 days — streak protection", () => {
  const actualIsRestDayForDate = jest.requireActual<
    typeof import("@/data/workoutProgram")
  >("@/data/workoutProgram").isRestDayForDate;

  // programStartDate 85 days before TODAY (2026-05-21) = 2026-02-25
  // day 83 (TWO_DAYS_AGO  2026-05-19): dayInProgram=83, week 12 day 7 → Rest
  // day 84 (YESTERDAY     2026-05-20): dayInProgram=0,  week 1  day 1 → Strength (NOT rest)
  // day 85 (TODAY         2026-05-21): dayInProgram=1,  week 1  day 2 → Rest
  const PROGRAM_START_85_DAYS_AGO = "2026-02-25";

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });
    mockIsRestDayForDate.mockImplementation(actualIsRestDayForDate);
  });

  it("isRestDayForDate wraps to week-1 rest pattern on day 85 of the program", () => {
    expect(
      actualIsRestDayForDate(new Date(TODAY), PROGRAM_START_85_DAYS_AGO),
    ).toBe(true);

    expect(
      actualIsRestDayForDate(new Date(YESTERDAY), PROGRAM_START_85_DAYS_AGO),
    ).toBe(false);

    expect(
      actualIsRestDayForDate(new Date(TWO_DAYS_AGO), PROGRAM_START_85_DAYS_AGO),
    ).toBe(true);
  });

  it("backfillRestDays includes rest days near the 84-day wrap point in completedDates and restDates", async () => {
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([YESTERDAY]),
    );

    const changed = await storage.backfillRestDays(PROGRAM_START_85_DAYS_AGO);

    const completedDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_completed_dates")) ?? "[]",
    );
    const restDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_rest_dates")) ?? "[]",
    );

    expect(changed).toBe(true);
    expect(completedDates).toContain(TODAY);
    expect(restDates).toContain(TODAY);
    expect(completedDates).toContain(TWO_DAYS_AGO);
    expect(restDates).toContain(TWO_DAYS_AGO);
    expect(restDates).not.toContain(YESTERDAY);
  });

  it("getProgress streak is not broken when rest days span the 84-day wrap boundary", async () => {
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify([YESTERDAY]),
    );

    await storage.backfillRestDays(PROGRAM_START_85_DAYS_AGO);

    const progress = await storage.getProgress();
    expect(progress.currentStreak).toBeGreaterThan(0);
    expect(progress.currentStreak).toBe(3);
  });
});

describe("isRestDayForDate — UTC-negative timezone regression", () => {
  // new Date("YYYY-MM-DD") parses as UTC midnight, which lands on the *previous*
  // calendar day for users in UTC-negative timezones (US, Canada, etc.).
  // The fix uses new Date(y, m-1, d) — local midnight — so daysSinceStart is
  // always computed correctly regardless of the device's UTC offset.
  //
  // These tests simulate the scenario by using Date objects built with the local
  // constructor (matching what backfillRestDays now passes to isRestDayForDate)
  // and verifying that the day-index arithmetic is correct.

  const actualIsRestDayForDate = jest.requireActual<
    typeof import("@/data/workoutProgram")
  >("@/data/workoutProgram").isRestDayForDate;

  // Week 1 pattern (0-indexed days):
  //   0 → Strength Training (workout)
  //   1 → Rest  ← day 1 MUST be a rest day
  //   2 → Strength Training (workout)
  //   3 → Rest
  //   4 → Speed Training (workout)
  //   5 → Rest
  //   6 → Rest
  const START = "2026-05-01";

  it("day 0 (program start) is NOT a rest day", () => {
    const [y, m, d] = START.split("-").map(Number);
    const date = new Date(y, m - 1, d); // local midnight — same as fixed backfillRestDays
    expect(actualIsRestDayForDate(date, START)).toBe(false);
  });

  it("day 1 (second day of program) IS a rest day", () => {
    const [y, m, d] = START.split("-").map(Number);
    const date = new Date(y, m - 1, d + 1); // May 2
    expect(actualIsRestDayForDate(date, START)).toBe(true);
  });

  it("day 2 (third day) is NOT a rest day", () => {
    const [y, m, d] = START.split("-").map(Number);
    const date = new Date(y, m - 1, d + 2); // May 3
    expect(actualIsRestDayForDate(date, START)).toBe(false);
  });

  it("backfillRestDays marks day-1 date (not day-0 date) as rest in completedDates", async () => {
    jest.useFakeTimers({ now: new Date("2026-05-02T12:00:00.000Z") });
    mockIsRestDayForDate.mockImplementation(actualIsRestDayForDate);

    // Program started May 1; today is May 2 (day 1 = rest day)
    const changed = await storage.backfillRestDays(START);

    const completedDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_completed_dates")) ?? "[]",
    );
    const restDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_rest_dates")) ?? "[]",
    );

    expect(changed).toBe(true);
    expect(restDates).toContain("2026-05-02"); // day 1 = rest
    expect(completedDates).toContain("2026-05-02");
    expect(restDates).not.toContain("2026-05-01"); // day 0 = workout, must NOT be marked rest
  });
});

describe("DST off-by-one — two consecutive rest days do not break streak", () => {
  // Root cause: isRestDayForDate computed daysSinceStart by dividing the ms
  // difference between two *local* midnight Date objects. When DST springs
  // forward, one calendar day is only 23 h long, so Math.floor rounds down by
  // 1. That makes the first consecutive rest day look like the preceding
  // workout day (not a rest day) — it is never backfilled — leaving a gap in
  // completedDates. The second rest day IS backfilled (its off-by-one index
  // still lands on a rest-day slot), so completedDates shows:
  //   [..., workoutDay, <gap>, restDay2]  → diff = 2 → streak = 0.
  //
  // Fix: dstSafeDaysBetween() uses Date.UTC with local date components so DST
  // transitions never affect the calendar-day count.
  //
  // This suite tests the full backfill → getProgress streak pipeline for
  // consecutive rest days (week 1 days 5 & 6 of the 12-week program).

  const actualIsRestDayForDate = jest.requireActual<
    typeof import("@/data/workoutProgram")
  >("@/data/workoutProgram").isRestDayForDate;

  // Program starts 2026-05-01.
  // Week 1 day 6 (index 6) is a strength finale workout — NOT a rest day.
  // The two CONSECUTIVE rest days first appear in Week 2 (program days 12 & 13):
  //
  //   Week 2 (days 7-13 since start):
  //   Day 7   May 8   Strength Training  (workout)
  //   Day 8   May 9   Rest
  //   Day 9   May 10  Strength Training  (workout)
  //   Day 10  May 11  Rest
  //   Day 11  May 12  Speed Training     (workout)
  //   Day 12  May 13  Rest               ← first  consecutive rest
  //   Day 13  May 14  Rest               ← second consecutive rest
  const START = "2026-05-01";

  beforeEach(() => {
    mockIsRestDayForDate.mockImplementation(actualIsRestDayForDate);
  });

  it("identifies both consecutive rest days correctly (week 2 days 12 and 13)", () => {
    const day12 = new Date(2026, 4, 13); // May 13 — local midnight (program day 12)
    const day13 = new Date(2026, 4, 14); // May 14 — local midnight (program day 13)
    expect(actualIsRestDayForDate(day12, START)).toBe(true);
    expect(actualIsRestDayForDate(day13, START)).toBe(true);
  });

  it("streak is preserved through two consecutive rest days using backfill", async () => {
    // User completed a workout on May 12 (program day 11 = Speed Training).
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(["2026-05-12"]),
    );

    // May 14 — second consecutive rest day.  Backfill must add BOTH May 13
    // and May 14 so completedDates = [May 12, May 13, May 14] (no gap).
    jest.useFakeTimers({ now: new Date("2026-05-14T12:00:00.000Z") });
    await storage.backfillRestDays(START);

    const completedDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_completed_dates")) ?? "[]",
    );

    expect(completedDates).toContain("2026-05-13"); // first rest day backfilled
    expect(completedDates).toContain("2026-05-14"); // second rest day backfilled

    const progress = await storage.getProgress();
    // May 12 (workout) + May 13 (rest) + May 14 (rest, today) = streak ≥ 3
    expect(progress.currentStreak).toBeGreaterThanOrEqual(3);
  });

  it("streak breaks when first rest day is missing from completedDates (simulates old DST bug)", async () => {
    // Reproduce the DST off-by-one bug state: May 12 workout + May 14 rest,
    // with May 13 absent because the old code miscounted it as a workout day.
    await AsyncStorage.setItem(
      "pulsekegel_completed_dates",
      JSON.stringify(["2026-05-12", "2026-05-14"]),
    );

    jest.useFakeTimers({ now: new Date("2026-05-14T12:00:00.000Z") });
    const progress = await storage.getProgress();
    // Gap of 2 days between May 12 and May 14 → streak resets to 1 (only today).
    expect(progress.currentStreak).toBe(1);
  });
});

describe("markRestDay — breathwork streak deduplication", () => {
  it("does not double-count a day when a workout and breathwork session both occur on the same date", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    await storage.addCompletedDate(TODAY, 5);
    await storage.markRestDay(TODAY);

    const completedDates: string[] = JSON.parse(
      (await AsyncStorage.getItem("pulsekegel_completed_dates")) ?? "[]",
    );

    const todayCount = completedDates.filter((d) => d === TODAY).length;
    expect(todayCount).toBe(1);

    const progress = await storage.getProgress();
    expect(progress.currentStreak).toBe(1);
  });

  it("does not inflate totalSessions when a breathwork session follows a workout on the same day", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    await storage.addCompletedDate(TODAY, 5);
    await storage.markRestDay(TODAY);

    const totalSessions = await storage.getTotalSessions();
    expect(totalSessions).toBe(1);
  });

  it("does not inflate totalSessions when a workout follows a breathwork session on the same day", async () => {
    jest.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`) });

    await storage.markRestDay(TODAY);
    await storage.addCompletedDate(TODAY, 5);

    const totalSessions = await storage.getTotalSessions();
    expect(totalSessions).toBe(1);
  });
});
