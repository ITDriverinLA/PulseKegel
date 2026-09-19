import {
  mergeTransferPayloads,
  pruneInProgressSession,
  validateTransferPayload,
  PROGRESS_TRANSFER_SCHEMA_VERSION,
  IN_PROGRESS_SESSION_TTL_MS,
  type ProgressTransferPayload,
  type TransferSettings,
} from "@shared/progressTransfer";

const baseSettings = (): TransferSettings => ({
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
  userName: "A",
  darkMode: true,
  theme: "dark",
  reminderEnabled: false,
  reminderTime: "08:00",
});

const emptyPayload = (
  overrides: Partial<ProgressTransferPayload> = {},
): ProgressTransferPayload => ({
  schema_version: PROGRESS_TRANSFER_SCHEMA_VERSION,
  exported_at: "2026-09-01T00:00:00.000Z",
  progress: {
    completed_dates: [],
    workout_dates: [],
    rest_dates: [],
    total_sessions: 0,
    total_minutes: 0,
    program_start_date: null,
    onboarding_complete: false,
    first_session_celebrated: false,
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
  settings: baseSettings(),
  audio_settings: {},
  in_progress_session: null,
  tips_seen: { settings_tip_seen: false },
  purchases_cache: {},
  ...overrides,
});

describe("mergeTransferPayloads", () => {
  it("unions completed days and takes max totals", () => {
    const local = emptyPayload({
      exported_at: "2026-09-10T00:00:00.000Z",
      progress: {
        ...emptyPayload().progress,
        completed_dates: ["2026-09-01", "2026-09-02"],
        workout_dates: ["2026-09-01"],
        total_sessions: 2,
        total_minutes: 20,
        onboarding_complete: true,
        program_start_date: "2026-09-01",
      },
    });
    const incoming = emptyPayload({
      exported_at: "2026-09-11T00:00:00.000Z",
      progress: {
        ...emptyPayload().progress,
        completed_dates: ["2026-09-02", "2026-09-03"],
        workout_dates: ["2026-09-03"],
        total_sessions: 5,
        total_minutes: 10,
        onboarding_complete: true,
        program_start_date: "2026-09-01",
      },
      settings: { ...baseSettings(), restDuration: 8 },
    });

    const result = mergeTransferPayloads(local, incoming);
    expect(result.merged.progress.completed_dates).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
    expect(result.merged.progress.total_sessions).toBe(5);
    expect(result.merged.progress.total_minutes).toBe(20);
    expect(result.merged.settings.restDuration).toBe(8); // LWW newer
  });

  it("ORs tips-seen flags", () => {
    const local = emptyPayload({
      progress: {
        ...emptyPayload().progress,
        onboarding_complete: true,
        total_sessions: 1,
        program_start_date: "2026-09-01",
      },
      tips_seen: { settings_tip_seen: true },
    });
    const incoming = emptyPayload({
      exported_at: "2026-09-12T00:00:00.000Z",
      progress: {
        ...emptyPayload().progress,
        onboarding_complete: true,
        total_sessions: 1,
        program_start_date: "2026-09-01",
      },
      tips_seen: { settings_tip_seen: false },
    });
    const result = mergeTransferPayloads(local, incoming);
    expect(result.merged.tips_seen.settings_tip_seen).toBe(true);
  });

  it("blocks empty remote overwrite of non-empty local by default", () => {
    const local = emptyPayload({
      progress: {
        ...emptyPayload().progress,
        completed_dates: ["2026-09-01"],
        total_sessions: 3,
        onboarding_complete: true,
        program_start_date: "2026-09-01",
      },
    });
    const incoming = emptyPayload({
      exported_at: "2026-09-20T00:00:00.000Z",
    });
    const blocked = mergeTransferPayloads(local, incoming);
    expect(blocked.emptyOverwriteRequiresConfirm).toBe(true);
    expect(blocked.merged.progress.total_sessions).toBe(3);

    const confirmed = mergeTransferPayloads(local, incoming, {
      confirmEmptyOverwrite: true,
    });
    expect(confirmed.emptyOverwriteRequiresConfirm).toBe(false);
  });
});

describe("pruneInProgressSession", () => {
  it("drops sessions past TTL", () => {
    const now = Date.parse("2026-09-19T12:00:00.000Z");
    const fresh = pruneInProgressSession(
      {
        step_index: 2,
        session_id: "abc",
        updated_at: new Date(now - 60_000).toISOString(),
      },
      now,
    );
    expect(fresh?.step_index).toBe(2);

    const stale = pruneInProgressSession(
      {
        step_index: 2,
        session_id: "abc",
        updated_at: new Date(now - IN_PROGRESS_SESSION_TTL_MS - 1).toISOString(),
      },
      now,
    );
    expect(stale).toBeNull();
  });
});

describe("validateTransferPayload", () => {
  it("rejects wrong schema_version", () => {
    const result = validateTransferPayload({
      ...emptyPayload(),
      schema_version: 99,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts schema_version 1", () => {
    const result = validateTransferPayload(emptyPayload());
    expect(result.ok).toBe(true);
  });
});
