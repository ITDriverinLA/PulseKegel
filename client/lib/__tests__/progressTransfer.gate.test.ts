jest.mock("react-native", () => ({ Platform: { OS: "android" }, Share: {} }));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-document-picker", () => ({}));
jest.mock("../backupCrypto", () => ({}));
jest.mock("../analytics", () => ({ trackEvent: jest.fn() }));

const kv: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => kv[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      kv[k] = v;
    }),
  },
}));

const storageMock = {
  setProgramStartDate: jest.fn(),
  setOnboardingComplete: jest.fn(),
  markFirstSessionCelebrated: jest.fn(),
  saveProgramProgress: jest.fn(),
  saveSettings: jest.fn(),
  saveAudioSettings: jest.fn(),
  markSettingsTipSeen: jest.fn(),
  setFirstSessionInProgress: jest.fn(),
  setFirstSessionId: jest.fn(),
};
jest.mock("../storage", () => ({
  storage: storageMock,
  defaultSettings: {},
}));

import {
  PROGRESS_TRANSFER_SCHEMA_VERSION,
  type ProgressTransferPayload,
} from "@shared/progressTransfer";
import { applyTransferPayload } from "../progressTransfer";

const payload = (
  totalSessions: number,
  celebrated: boolean,
): ProgressTransferPayload => ({
  schema_version: PROGRESS_TRANSFER_SCHEMA_VERSION,
  exported_at: new Date().toISOString(),
  progress: {
    completed_dates: totalSessions ? ["2026-09-01"] : [],
    workout_dates: totalSessions ? ["2026-09-01"] : [],
    rest_dates: [],
    total_sessions: totalSessions,
    total_minutes: totalSessions * 6,
    program_start_date: null,
    onboarding_complete: true,
    first_session_celebrated: celebrated,
    program_progress: null,
    control_score_state: null,
    earned_badges: [],
    review_history: [],
    challenge_calibration: null,
    challenge_optional_dates: [],
    challenge_days_started: null,
    challenge_days_completed: null,
    challenge_day_viewed: null,
    segment_type_history: [],
    ranks_notified: null,
  },
  settings: {
    hapticsEnabled: true,
    hapticIntensity: "medium",
    restCueStyle: "light",
    highContrastMode: false,
    largeTextMode: false,
    recoveryMode: false,
    restDuration: 5,
    blockRestDuration: 25,
    cooldownEnabled: true,
    anatomyType: "male",
    userName: "",
    darkMode: true,
    theme: "dark",
    reminderEnabled: false,
    reminderTime: "08:00",
  },
  audio_settings: {},
  in_progress_session: {
    step_index: 2,
    session_id: "sess-1",
    updated_at: new Date().toISOString(),
  },
  tips_seen: { settings_tip_seen: false },
  purchases_cache: {},
});

describe("P2.4 restore respects the first-session gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(kv)) delete kv[k];
  });

  it("restored session history unlocks home without replaying Day 1", async () => {
    await applyTransferPayload(payload(4, false));
    expect(kv["pulsekegel_total_sessions"]).toBe("4");
    expect(storageMock.markFirstSessionCelebrated).toHaveBeenCalled();
    expect(storageMock.setFirstSessionInProgress).toHaveBeenCalledWith(false);
    expect(storageMock.setFirstSessionId).not.toHaveBeenCalled();
  });

  it("no session history keeps the gate (and a fresh Day-1 resume)", async () => {
    await applyTransferPayload(payload(0, false));
    expect(kv["pulsekegel_total_sessions"]).toBe("0");
    expect(storageMock.markFirstSessionCelebrated).not.toHaveBeenCalled();
    expect(storageMock.setFirstSessionId).toHaveBeenCalledWith("sess-1");
    expect(storageMock.setFirstSessionInProgress).toHaveBeenCalledWith(
      true,
      0,
      2,
    );
  });
});
