/**
 * Ashley-approved addition (Nov 17 2026): a weekly check-in answer also sets
 * the Week-1 calibration when no calibration record exists yet.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
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
      __store: store,
    },
  };
});

jest.mock("@/data/workoutProgram", () => ({
  isRestDayForDate: jest.fn(),
  getWorkoutCompletionsForWeek: jest.fn().mockReturnValue(0),
  getScheduledDaysForWeek: jest.fn().mockReturnValue(3),
}));

const store = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;

beforeEach(() => store.clear());

describe("saveWeeklyCalibrationAnswer", () => {
  it.each([
    ["easy", "accelerated"],
    ["okay", "standard"],
    ["tooHard", "gentle"],
  ] as const)(
    "with no calibration record, %s sets the path like Day 1 (%s)",
    async (level, path) => {
      await storage.saveWeeklyCalibrationAnswer(1, level);
      expect(await storage.getWeeklyCalibrationLevels()).toEqual({ 1: level });
      expect(await storage.getCalibrationState()).toEqual({
        calibrationLevel: level,
        difficultyPath: path,
        calibrationCompleted: true,
      });
    },
  );

  it("leaves an existing calibration record unchanged", async () => {
    await storage.setCalibrationState("okay");
    await storage.saveWeeklyCalibrationAnswer(2, "tooHard");
    expect(await storage.getWeeklyCalibrationLevels()).toEqual({
      2: "tooHard",
    });
    expect(await storage.getCalibrationState()).toEqual({
      calibrationLevel: "okay",
      difficultyPath: "standard",
      calibrationCompleted: true,
    });
  });
});
