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
});
