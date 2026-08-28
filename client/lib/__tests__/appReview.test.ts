import { Platform } from "react-native";
import * as StoreReview from "expo-store-review";

import {
  isChallengeCompleteForReview,
  requestAppReviewAfterChallenge,
} from "../appReview";
import { storage } from "../storage";

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

jest.mock("../storage", () => ({
  storage: {
    hasRequestedAppReview: jest.fn(),
    markAppReviewRequested: jest.fn(),
  },
}));

const hasRequested = storage.hasRequestedAppReview as jest.MockedFunction<
  typeof storage.hasRequestedAppReview
>;
const markRequested = storage.markAppReviewRequested as jest.MockedFunction<
  typeof storage.markAppReviewRequested
>;
const isAvailable = StoreReview.isAvailableAsync as jest.MockedFunction<
  typeof StoreReview.isAvailableAsync
>;
const requestReview = StoreReview.requestReview as jest.MockedFunction<
  typeof StoreReview.requestReview
>;

describe("requestAppReviewAfterChallenge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = "ios";
    hasRequested.mockResolvedValue(false);
    isAvailable.mockResolvedValue(true);
    markRequested.mockResolvedValue();
    requestReview.mockResolvedValue();
  });

  it("requests the native review prompt and records the one-time attempt", async () => {
    await expect(requestAppReviewAfterChallenge()).resolves.toBe(true);
    expect(markRequested).toHaveBeenCalledTimes(1);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it("does not request another review after the prompt was already attempted", async () => {
    hasRequested.mockResolvedValue(true);

    await expect(requestAppReviewAfterChallenge()).resolves.toBe(false);
    expect(isAvailable).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("does nothing outside iOS and Android", async () => {
    Platform.OS = "web";

    await expect(requestAppReviewAfterChallenge()).resolves.toBe(false);
    expect(hasRequested).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("waits for a platform where the native prompt is available", async () => {
    isAvailable.mockResolvedValue(false);

    await expect(requestAppReviewAfterChallenge()).resolves.toBe(false);
    expect(markRequested).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });
});

describe("isChallengeCompleteForReview", () => {
  it("requires every core session in the 7-day challenge", () => {
    expect(
      isChallengeCompleteForReview({
        completedCoreSessions: 3,
        totalCoreSessions: 3,
      }),
    ).toBe(true);
    expect(
      isChallengeCompleteForReview({
        completedCoreSessions: 2,
        totalCoreSessions: 3,
      }),
    ).toBe(false);
  });
});
