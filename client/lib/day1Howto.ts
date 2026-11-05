import { DAY1_HOWTO_COPY, type Day1HowtoCopy } from "@/constants/day1HowtoCopy";
import type { AnatomyType } from "@/lib/storage";

/** Matches readableColumn in windowLayout.ts (P6). */
export const DAY1_HOWTO_MAX_WIDTH = 560;

/** Server rejects dwell_ms above this (24h). */
export const HOWTO_DWELL_MS_MAX = 86_400_000;

export const DAY1_ELAPSED_SEC_MAX = 7200;

export type Day1AbandonPhase =
  | "get_ready"
  | "squeeze"
  | "rest"
  | "cool_down"
  | "howto_card";

export type Day1ExitSource = "end" | "x" | "android_back" | "other";

export type HowtoCardAction = "continue" | "skip" | "back";

/**
 * Claims-cleared copy is gender-neutral, so every anatomy type gets the
 * same strings. anatomyType is accepted so a future signed-off variant can
 * branch here without hunting through the player.
 */
export function day1HowtoCopy(
  _anatomyType: AnatomyType | null | undefined,
): Day1HowtoCopy {
  return DAY1_HOWTO_COPY;
}

export function shouldShowDay1HowtoCard(input: {
  isFirstSession: boolean;
  day1Completed: boolean;
  howtoCardSeen: boolean;
  /** F1 resume index. Past the opening step means the first squeeze already started. */
  resumeStepIndex?: number | null;
}): boolean {
  if (!input.isFirstSession) return false;
  if (input.day1Completed) return false;
  if (input.howtoCardSeen) return false;
  const step = input.resumeStepIndex ?? 0;
  if (Number.isFinite(step) && step > 0) return false;
  return true;
}

/**
 * Default text on a phone does not scroll. Large text (app setting or OS
 * font scale) scrolls the body so the buttons stay on screen.
 */
export function day1HowtoLayout(input: {
  width: number;
  height: number;
  fontScale: number;
  largeText: boolean;
}): { scrollBody: boolean; maxWidth: number; compact: boolean } {
  const width = Number.isFinite(input.width) ? Math.max(0, input.width) : 0;
  const height = Number.isFinite(input.height) ? input.height : 0;
  const fontScale = Number.isFinite(input.fontScale) ? input.fontScale : 1;
  return {
    scrollBody: input.largeText || fontScale > 1.05,
    maxWidth: Math.min(width, DAY1_HOWTO_MAX_WIDTH),
    compact: height > 0 && height < 700,
  };
}

export function howtoDwellMs(shownAt: number | null, now: number): number {
  if (shownAt == null || !Number.isFinite(shownAt) || !Number.isFinite(now)) {
    return 0;
  }
  const dwell = Math.floor(now - shownAt);
  if (!Number.isFinite(dwell) || dwell < 0) return 0;
  return Math.min(HOWTO_DWELL_MS_MAX, dwell);
}

export function resolveDay1AbandonPhase(input: {
  cardVisible: boolean;
  segmentType?: string | null;
  segmentId?: string | null;
  phase?: "squeeze" | "rest" | null;
}): Day1AbandonPhase | undefined {
  if (input.cardVisible) return "howto_card";
  const type = input.segmentType;
  if (!type) return undefined;
  if (type === "getReady") return "get_ready";
  if (type === "breathing" || (input.segmentId ?? "").includes("cooldown")) {
    return "cool_down";
  }
  if (type === "blockRest" || input.phase === "rest") return "rest";
  return "squeeze";
}

/** 1-based rep while squeezing or resting. Omitted before the first rep. */
export function resolveDay1RepIndex(input: {
  phase: Day1AbandonPhase | undefined;
  /** Engine repIndex, 0-based. */
  repIndex?: number | null;
}): number | undefined {
  if (input.phase !== "squeeze" && input.phase !== "rest") return undefined;
  if (typeof input.repIndex !== "number" || !Number.isFinite(input.repIndex)) {
    return undefined;
  }
  const oneBased = Math.floor(input.repIndex) + 1;
  if (oneBased < 0 || oneBased > 100) return undefined;
  return oneBased;
}

export function buildFirstSessionAbandonedPayload(input: {
  sessionId: string;
  progress: number;
  cardVisible: boolean;
  segmentType?: string | null;
  segmentId?: string | null;
  phase?: "squeeze" | "rest" | null;
  repIndex?: number | null;
  elapsedSec: number;
  exitSource: Day1ExitSource;
}): {
  session_id: string;
  progress: number;
  phase?: Day1AbandonPhase;
  rep_index?: number;
  elapsed_sec: number;
  exit_source: Day1ExitSource;
} {
  const phase = resolveDay1AbandonPhase({
    cardVisible: input.cardVisible,
    segmentType: input.segmentType,
    segmentId: input.segmentId,
    phase: input.phase,
  });
  const repIndex = resolveDay1RepIndex({
    phase,
    repIndex: input.repIndex,
  });
  const elapsed = Number.isFinite(input.elapsedSec)
    ? Math.max(0, Math.min(DAY1_ELAPSED_SEC_MAX, Math.floor(input.elapsedSec)))
    : 0;
  const progress = Number.isFinite(input.progress)
    ? Math.max(0, Math.min(100, input.progress))
    : 0;
  return {
    session_id: input.sessionId,
    progress,
    ...(phase ? { phase } : {}),
    ...(repIndex !== undefined ? { rep_index: repIndex } : {}),
    elapsed_sec: elapsed,
    exit_source: input.exitSource,
  };
}
