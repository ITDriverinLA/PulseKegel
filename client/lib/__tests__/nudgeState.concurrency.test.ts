/**
 * Rev M1: concurrent writers to the P8 nudge state, run against the REAL
 * storage module (AsyncStorage mocked with async, interleaving get/set).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "../storage";
import {
  claimNotificationResponse,
  markInAppDay2NudgeRendered,
  onHomeLeftAfterDay2Nudge,
  reportDay2NudgeFirePassed,
  reportDay2NudgeReceived,
} from "../challengeNudge";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => {
        await tick();
        return store.has(k) ? (store.get(k) as string) : null;
      }),
      setItem: jest.fn(async (k: string, v: string) => {
        await tick();
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        await tick();
        store.delete(k);
      }),
      multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach((k) => store.delete(k));
      }),
      __store: store,
    },
  };
});

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const mockTrack = { shown: jest.fn(), received: jest.fn(), fire: jest.fn() };
jest.mock("../analytics", () => ({
  trackChallengeDay2NudgeScheduled: jest.fn(),
  trackChallengeDay2NudgeShown: (d: unknown) => mockTrack.shown(d),
  trackChallengeNudgeReceived: (d: unknown) => mockTrack.received(d),
  trackChallengeNudgeFirePassed: (d: unknown) => mockTrack.fire(d),
}));

jest.mock("../notifications", () => ({
  CHALLENGE_DAY3_PUSH_ID: "challenge-followup-d3",
  localDateString: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  getNotificationPermissionStatus: jest.fn(async () => "granted"),
  requestNotificationPermissionInstrumented: jest.fn(async () => true),
}));

const store = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;
const PAST = "2026-11-18T17:00:00.000Z";
const NOW = new Date("2026-11-19T18:00:00.000Z");

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe("nudge state is serialized (real storage)", () => {
  it("two concurrent claims of one response key: exactly one wins", async () => {
    for (let i = 0; i < 20; i++) {
      const key = `challenge-day2-nudge|${i}`;
      const results = await Promise.all([
        claimNotificationResponse(key),
        claimNotificationResponse(key),
        claimNotificationResponse(key),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
    }
  });

  it("fire-passed alongside a claim keeps both firePassedLogged and the key", async () => {
    for (let i = 0; i < 20; i++) {
      store.clear();
      jest.clearAllMocks();
      await storage.updateChallengeDay2NudgeState({
        push: { fireAt: PAST },
        followupD3: { fireAt: PAST },
      });
      await Promise.all([
        reportDay2NudgeFirePassed(NOW),
        claimNotificationResponse(`k|${i}`),
        reportDay2NudgeFirePassed(NOW),
        reportDay2NudgeReceived({ nudge: "followup", followup_day: 3 }),
      ]);
      const state = await storage.getChallengeDay2NudgeState();
      expect(state.push?.firePassedLogged).toBe(true);
      expect(state.followupD3?.firePassedLogged).toBe(true);
      expect(state.followupD3?.receivedLogged).toBe(true);
      expect(state.lastHandledResponseKey).toBe(`k|${i}`);
      // One fire-passed per push, despite two concurrent reporters.
      expect(mockTrack.fire).toHaveBeenCalledTimes(2);
      expect(mockTrack.received).toHaveBeenCalledTimes(1);
    }
  });

  it("render + blur race: a seen banner is never left half-cleared", async () => {
    await storage.setChallengeDay2InAppNudgePending(true);
    await markInAppDay2NudgeRendered(NOW);
    await Promise.all([
      onHomeLeftAfterDay2Nudge(),
      onHomeLeftAfterDay2Nudge(),
      markInAppDay2NudgeRendered(NOW),
    ]);
    expect(mockTrack.shown).toHaveBeenCalledTimes(1);
    const state = await storage.getChallengeDay2NudgeState();
    expect(state.lastShownLocalDate).toBe("2026-11-19");
  });

  it("reset runs on the chain: an in-flight mutate can't write old state back", async () => {
    for (let i = 0; i < 20; i++) {
      store.clear();
      await storage.updateChallengeDay2NudgeState({
        push: { fireAt: PAST },
        lastHandledResponseKey: "old",
      });
      const inFlight = claimNotificationResponse(`k|${i}`);
      const reset = storage.resetChallengeProgress();
      await Promise.all([inFlight, reset]);
      const state = await storage.getChallengeDay2NudgeState();
      expect(state.push ?? null).toBeNull();
      expect(state.lastHandledResponseKey ?? null).toBeNull();
    }
  });
});
