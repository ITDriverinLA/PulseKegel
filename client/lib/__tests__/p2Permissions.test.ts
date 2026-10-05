jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

const getPermissionsAsync = jest.fn(async () => ({ status: "undetermined" }));
const requestPermissionsAsync = jest.fn(async () => ({ status: "granted" }));

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DAILY: "daily",
  },
  getPermissionsAsync: () => getPermissionsAsync(),
  requestPermissionsAsync: () => requestPermissionsAsync(),
  setNotificationHandler: jest.fn(),
}));

const trackPermissionPromptShown = jest.fn();
const trackPermissionResult = jest.fn();
jest.mock("../analytics", () => ({
  trackPermissionPromptShown: (d: unknown) => trackPermissionPromptShown(d),
  trackPermissionResult: (d: unknown) => trackPermissionResult(d),
}));

const hasCompletedFirstSession = jest.fn(async () => false);
jest.mock("../storage", () => ({
  storage: { hasCompletedFirstSession: () => hasCompletedFirstSession() },
}));

jest.mock("@/data/workoutProgram", () => ({ isRestDayForDate: () => false }));

import { requestNotificationPermissionInstrumented } from "../notifications";

describe("P2c push permission timing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("never shows the OS prompt before the first session is complete", async () => {
    hasCompletedFirstSession.mockResolvedValueOnce(false);
    const granted = await requestNotificationPermissionInstrumented("test");
    expect(granted).toBe(false);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(trackPermissionPromptShown).not.toHaveBeenCalled();
    expect(trackPermissionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "deferred_pre_first_session",
        after_first_session: false,
      }),
    );
  });

  it("prompts after the first session and tags the timing", async () => {
    hasCompletedFirstSession.mockResolvedValueOnce(true);
    const granted = await requestNotificationPermissionInstrumented(
      "post_day1_challenge_nudge",
    );
    expect(granted).toBe(true);
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(trackPermissionPromptShown).toHaveBeenCalledWith(
      expect.objectContaining({ after_first_session: true }),
    );
  });
});
