import { Platform } from "react-native";
import * as StoreReview from "expo-store-review";

import { storage } from "@/lib/storage";

interface ChallengeCompletion {
  completedCoreSessions: number;
  totalCoreSessions: number;
}

export function isChallengeCompleteForReview({
  completedCoreSessions,
  totalCoreSessions,
}: ChallengeCompletion): boolean {
  return totalCoreSessions > 0 && completedCoreSessions >= totalCoreSessions;
}

export async function requestAppReviewAfterChallenge(): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (await storage.hasRequestedAppReview()) return false;
  if (!(await StoreReview.isAvailableAsync())) return false;

  await storage.markAppReviewRequested();

  try {
    await StoreReview.requestReview();
    return true;
  } catch (error) {
    console.warn("[PulseKegel] Native app review request failed:", error);
    return false;
  }
}
