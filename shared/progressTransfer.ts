/**
 * Epic G1 — Progress transfer & sync payload (schema_version 1).
 * Pure helpers: safe to import from client, server, and Jest.
 *
 * Privacy: this payload is local-only by default. Cloud/iCloud sync requires
 * explicit opt-in (OP1–OP4). Never include anonymous analytics keys, OS
 * permissions, ephemeral UI, secrets, or workout payload content in analytics.
 */

export const PROGRESS_TRANSFER_SCHEMA_VERSION = 1 as const;

/** In-progress session TTL aligned with F1 resume (48h midpoint of 24–72h). */
export const IN_PROGRESS_SESSION_TTL_MS = 48 * 60 * 60 * 1000;

export type TransferSettings = {
  hapticsEnabled: boolean;
  hapticIntensity: "light" | "medium" | "heavy";
  restCueStyle: "none" | "light" | "normal";
  highContrastMode: boolean;
  largeTextMode: boolean;
  recoveryMode: boolean;
  restDuration: number;
  blockRestDuration: number;
  cooldownEnabled: boolean;
  anatomyType: "male" | "female" | null;
  userName: string;
  darkMode: boolean;
  theme: "dark" | "light" | "power";
  reminderEnabled: boolean;
  reminderTime: string;
};

export type TransferInProgressSession = {
  step_index: number;
  session_id: string;
  updated_at: string;
};

export type TransferTipsSeen = {
  settings_tip_seen: boolean;
};

export type TransferPurchasesCache = {
  /** Last-known UX only — StoreKit / Play remain source of truth. */
  last_known_subscribed?: boolean;
  last_known_trial_active?: boolean;
};

export type TransferProgress = {
  completed_dates: string[];
  workout_dates: string[];
  rest_dates: string[];
  total_sessions: number;
  total_minutes: number;
  program_start_date: string | null;
  onboarding_complete: boolean;
  first_session_celebrated: boolean;
  program_progress: Record<string, unknown> | null;
  control_score_state: Record<string, unknown> | null;
  earned_badges: unknown[];
  review_history: unknown[];
  challenge_calibration: Record<string, unknown> | null;
  challenge_optional_dates: string[];
  challenge_days_started: unknown;
  challenge_days_completed: unknown;
  challenge_day_viewed: unknown;
  segment_type_history: unknown[];
  ranks_notified: unknown;
};

export type ProgressTransferPayload = {
  schema_version: typeof PROGRESS_TRANSFER_SCHEMA_VERSION;
  exported_at: string;
  progress: TransferProgress;
  settings: TransferSettings;
  audio_settings: Record<string, unknown>;
  in_progress_session: TransferInProgressSession | null;
  tips_seen: TransferTipsSeen;
  purchases_cache: TransferPurchasesCache;
};

export type MergeConflictKind =
  | "none"
  | "settings_lww"
  | "progress_union"
  | "empty_overwrite_blocked";

export type MergeResult = {
  merged: ProgressTransferPayload;
  conflicts: MergeConflictKind[];
  emptyOverwriteRequiresConfirm: boolean;
};

function uniqSorted(dates: string[]): string[] {
  return Array.from(new Set(dates.filter(Boolean))).sort();
}

function isPayloadEmpty(p: ProgressTransferPayload): boolean {
  return (
    (p.progress.completed_dates?.length ?? 0) === 0 &&
    (p.progress.workout_dates?.length ?? 0) === 0 &&
    (p.progress.total_sessions ?? 0) === 0 &&
    !p.progress.onboarding_complete &&
    !p.progress.program_start_date
  );
}

/** Drop in-progress session if past TTL. */
export function pruneInProgressSession(
  session: TransferInProgressSession | null,
  nowMs: number = Date.now(),
): TransferInProgressSession | null {
  if (!session) return null;
  const updated = Date.parse(session.updated_at);
  if (!Number.isFinite(updated)) return null;
  if (nowMs - updated > IN_PROGRESS_SESSION_TTL_MS) return null;
  if (
    typeof session.step_index !== "number" ||
    !session.session_id ||
    session.step_index < 0
  ) {
    return null;
  }
  return session;
}

/**
 * Conflict rules (Path A / dual import):
 * - completed/workout/rest days: union
 * - totals: max
 * - settings: last-write-wins by exported_at
 * - tips-seen: OR
 * - never replace non-empty local with empty remote without confirm (default No)
 */
export function mergeTransferPayloads(
  local: ProgressTransferPayload,
  incoming: ProgressTransferPayload,
  opts: { confirmEmptyOverwrite?: boolean } = {},
): MergeResult {
  const conflicts: MergeConflictKind[] = [];
  const localEmpty = isPayloadEmpty(local);
  const incomingEmpty = isPayloadEmpty(incoming);

  if (!localEmpty && incomingEmpty && !opts.confirmEmptyOverwrite) {
    return {
      merged: local,
      conflicts: ["empty_overwrite_blocked"],
      emptyOverwriteRequiresConfirm: true,
    };
  }

  const localWinsSettings =
    Date.parse(local.exported_at) >= Date.parse(incoming.exported_at);

  if (
    JSON.stringify(local.settings) !== JSON.stringify(incoming.settings) &&
    !localEmpty &&
    !incomingEmpty
  ) {
    conflicts.push("settings_lww");
  }

  const completed = uniqSorted([
    ...local.progress.completed_dates,
    ...incoming.progress.completed_dates,
  ]);
  const workout = uniqSorted([
    ...local.progress.workout_dates,
    ...incoming.progress.workout_dates,
  ]);
  const rest = uniqSorted([
    ...local.progress.rest_dates,
    ...incoming.progress.rest_dates,
  ]);

  if (
    completed.length !== local.progress.completed_dates.length ||
    completed.length !== incoming.progress.completed_dates.length
  ) {
    conflicts.push("progress_union");
  }

  const newer = localWinsSettings ? local : incoming;
  const older = localWinsSettings ? incoming : local;

  const merged: ProgressTransferPayload = {
    schema_version: PROGRESS_TRANSFER_SCHEMA_VERSION,
    exported_at:
      Date.parse(local.exported_at) >= Date.parse(incoming.exported_at)
        ? local.exported_at
        : incoming.exported_at,
    progress: {
      completed_dates: completed,
      workout_dates: workout,
      rest_dates: rest,
      total_sessions: Math.max(
        local.progress.total_sessions,
        incoming.progress.total_sessions,
      ),
      total_minutes: Math.max(
        local.progress.total_minutes,
        incoming.progress.total_minutes,
      ),
      program_start_date:
        newer.progress.program_start_date ?? older.progress.program_start_date,
      onboarding_complete:
        local.progress.onboarding_complete ||
        incoming.progress.onboarding_complete,
      first_session_celebrated:
        local.progress.first_session_celebrated ||
        incoming.progress.first_session_celebrated,
      program_progress:
        newer.progress.program_progress ?? older.progress.program_progress,
      control_score_state: pickRicherControlScore(
        local.progress.control_score_state,
        incoming.progress.control_score_state,
      ),
      earned_badges: mergeArraysByJson(
        local.progress.earned_badges,
        incoming.progress.earned_badges,
      ),
      review_history: mergeArraysByJson(
        local.progress.review_history,
        incoming.progress.review_history,
      ),
      challenge_calibration:
        newer.progress.challenge_calibration ??
        older.progress.challenge_calibration,
      challenge_optional_dates: uniqSorted([
        ...local.progress.challenge_optional_dates,
        ...incoming.progress.challenge_optional_dates,
      ]),
      challenge_days_started:
        newer.progress.challenge_days_started ??
        older.progress.challenge_days_started,
      challenge_days_completed:
        newer.progress.challenge_days_completed ??
        older.progress.challenge_days_completed,
      challenge_day_viewed:
        newer.progress.challenge_day_viewed ??
        older.progress.challenge_day_viewed,
      segment_type_history: mergeArraysByJson(
        local.progress.segment_type_history,
        incoming.progress.segment_type_history,
      ),
      ranks_notified:
        newer.progress.ranks_notified ?? older.progress.ranks_notified,
    },
    settings: newer.settings,
    audio_settings: {
      ...older.audio_settings,
      ...newer.audio_settings,
    },
    in_progress_session: pickFresherInProgress(
      local.in_progress_session,
      incoming.in_progress_session,
    ),
    tips_seen: {
      settings_tip_seen:
        local.tips_seen.settings_tip_seen ||
        incoming.tips_seen.settings_tip_seen,
    },
    purchases_cache: {
      ...older.purchases_cache,
      ...newer.purchases_cache,
    },
  };

  if (conflicts.length === 0) conflicts.push("none");

  return {
    merged,
    conflicts,
    emptyOverwriteRequiresConfirm: false,
  };
}

function pickRicherControlScore(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!a) return b;
  if (!b) return a;
  const scoreA = typeof a.controlScore === "number" ? a.controlScore : 0;
  const scoreB = typeof b.controlScore === "number" ? b.controlScore : 0;
  return scoreA >= scoreB ? a : b;
}

function pickFresherInProgress(
  a: TransferInProgressSession | null,
  b: TransferInProgressSession | null,
): TransferInProgressSession | null {
  const pa = pruneInProgressSession(a);
  const pb = pruneInProgressSession(b);
  if (!pa) return pb;
  if (!pb) return pa;
  return Date.parse(pa.updated_at) >= Date.parse(pb.updated_at) ? pa : pb;
}

function mergeArraysByJson(a: unknown[], b: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of [...a, ...b]) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function validateTransferPayload(
  raw: unknown,
):
  | { ok: true; payload: ProgressTransferPayload }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Backup is not a valid object" };
  }
  const p = raw as Partial<ProgressTransferPayload>;
  if (p.schema_version !== PROGRESS_TRANSFER_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schema_version (got ${String(p.schema_version)}, need ${PROGRESS_TRANSFER_SCHEMA_VERSION})`,
    };
  }
  if (typeof p.exported_at !== "string" || !p.progress || !p.settings) {
    return { ok: false, error: "Backup missing required fields" };
  }
  if (!Array.isArray(p.progress.completed_dates)) {
    return { ok: false, error: "Backup progress.completed_dates invalid" };
  }
  return { ok: true, payload: p as ProgressTransferPayload };
}
