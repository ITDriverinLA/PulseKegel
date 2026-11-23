import { z } from "zod";

const anatomyTypeSchema = z.enum(["male", "female"]);
const challengeResultSchema = z.enum([
  "not_started",
  "first_step",
  "partial",
  "complete",
  "strong_finish",
]);
const paywallSourceSchema = z.enum([
  "challenge_complete",
  "workout_gate",
  "settings",
  "day1_soft",
  "unknown",
]);
const purchaseResultSchema = z.enum([
  "started",
  "completed",
  "cancelled",
  "failed",
  "unavailable",
  "entitlement_missing",
]);
const storeSchema = z.enum(["app_store", "play_store", "none"]);
const buildEnvSchema = z.enum([
  "simulator",
  "dev",
  "expo_go",
  "testflight",
  "xcode",
  "production",
  "unknown",
]);
const periodTypeSchema = z.enum(["TRIAL", "INTRO", "NORMAL", "PREPAID"]);
const rcCodeSchema = z.number().int().min(0).max(99);
const readableErrorCodeSchema = z.string().trim().min(1).max(64);
const errorMessageSchema = z.string().trim().min(1).max(100);
const offeringIdSchema = z.string().trim().min(1).max(100);
const purchaseContextFields = {
  store: storeSchema.optional(),
  buildEnv: buildEnvSchema.optional(),
  isSandbox: z.boolean().optional(),
  offeringId: offeringIdSchema.optional(),
  rcCode: rcCodeSchema.optional(),
  readableErrorCode: readableErrorCodeSchema.optional(),
  errorMessage: errorMessageSchema.optional(),
  userCancelled: z.boolean().optional(),
  periodType: periodTypeSchema.optional(),
  isTrial: z.boolean().optional(),
  recoveredAfterRefresh: z.boolean().optional(),
};
const purchaseDataSchema = z
  .object({
    result: purchaseResultSchema,
    packageIdentifier: z.string().trim().min(1).max(100).optional(),
    productIdentifier: z.string().trim().min(1).max(150).optional(),
    errorCode: z.string().trim().min(1).max(100).optional(),
    source: paywallSourceSchema.optional(),
    ...purchaseContextFields,
  })
  .strict();
const eventMetadata = {
  platform: z.enum(["ios", "android", "web", "windows", "macos"]).optional(),
  appVersion: z.string().trim().min(1).max(20).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  // P6: optional so events recorded before 2.2.5 still validate. New clients
  // send all three on every event. No device id and no user-assigned name.
  device_model: z.string().trim().min(1).max(64).optional(),
  displayClass: z.enum(["compact", "regular"]).optional(),
  windowWidthBucket: z.enum(["<500", "500-800", ">800"]).optional(),
};

// P8: optional nudge props. Old clients send only `channel`, which still passes.
const nudgeChannelSchema = z.enum(["push", "in_app"]);
const nudgeFollowupDaySchema = z.union([z.literal(3), z.literal(5)]);
const nudgeKindSchema = z.enum(["day2", "followup"]);
const nudgeFireAtSchema = z.string().max(40).datetime({ offset: true });
const pushPermissionStatusSchema = z.enum([
  "granted",
  "denied",
  "undetermined",
  "provisional",
  "ephemeral",
  "unknown",
]);
const prePromptSchema = z.enum(["day1_complete", "second_session", "none"]);
const prePromptAttemptSchema = z.union([z.literal(1), z.literal(2)]);
const comebackSourceSchema = z.enum(["followup", "home"]);
const idleDaysSchema = z.number().int().min(0).max(3650);

const analyticsEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("app_open"),
      data: z
        .object({
          programWeek: z.number().int().min(1).max(12).optional(),
          streak: z.number().int().min(0).max(10_000).optional(),
          totalSessions: z.number().int().min(0).max(100_000).optional(),
          anatomyType: anatomyTypeSchema.nullable().optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("session_complete"),
      data: z
        .object({
          durationMinutes: z.number().finite().min(0).max(240).optional(),
          workoutType: z
            .enum([
              "rest",
              "daily",
              "alternate",
              "strength",
              "speed",
              "coordination",
            ])
            .optional(),
          weekNumber: z.number().int().min(0).max(12).optional(),
          dayNumber: z.number().int().min(0).max(7).optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("session_started"),
      data: z
        .object({
          workoutType: z
            .enum([
              "rest",
              "daily",
              "alternate",
              "strength",
              "speed",
              "coordination",
            ])
            .optional(),
          weekNumber: z.number().int().min(0).max(12).optional(),
          dayNumber: z.number().int().min(0).max(7).optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("onboarding_complete"),
      data: z
        .object({ anatomyType: anatomyTypeSchema.nullable().optional() })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("week_complete"),
      data: z
        .object({
          weekNumber: z.number().int().min(1).max(12),
          daysWorkedOut: z.number().int().min(0).max(7),
          scheduledDays: z.number().int().min(1).max(7),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_result_viewed"),
      data: z
        .object({
          result: challengeResultSchema,
          completedCoreSessions: z.number().int().min(0).max(100),
          totalCoreSessions: z.number().int().min(0).max(100),
          completedOptionalSessions: z.number().int().min(0).max(100),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_cta_tapped"),
      data: z
        .object({
          result: challengeResultSchema,
          button: z.enum(["primary", "secondary"]),
          action: z.enum(["continue", "restart"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("paywall_viewed"),
      data: z
        .object({
          source: paywallSourceSchema,
          trialDaysRemaining: z.number().int().min(0).max(7),
          completedCoreSessions: z.number().int().min(0).max(100).optional(),
          totalCoreSessions: z.number().int().min(0).max(100).optional(),
          store: storeSchema.optional(),
          buildEnv: buildEnvSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("paywall_dismissed"),
      data: z
        .object({
          source: paywallSourceSchema,
          method: z.enum(["not_now", "close"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("day1_soft_paywall_deferred"),
      data: z.object({ reason: z.literal("open_settings") }).strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("subscribe_tapped"),
      data: z
        .object({
          source: paywallSourceSchema,
          packageIdentifier: z.string().trim().min(1).max(100).optional(),
          productIdentifier: z.string().trim().min(1).max(150).optional(),
          displayedPrice: z.string().trim().min(1).max(50).optional(),
          hasPackages: z.boolean().optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("purchase_started"),
      data: purchaseDataSchema,
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("purchase_completed"),
      data: purchaseDataSchema,
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("purchase_cancelled"),
      data: purchaseDataSchema,
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("purchase_failed"),
      data: purchaseDataSchema,
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("purchase_unavailable"),
      data: purchaseDataSchema,
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("onboarding_screen_viewed"),
      data: z
        .object({
          screen_key: z.string().trim().min(1).max(64),
          index: z.number().int().min(0).max(20),
          total: z.number().int().min(1).max(20),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("onboarding_anatomy_selected"),
      data: z
        .object({
          anatomy: anatomyTypeSchema,
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("onboarding_cta_tapped"),
      data: z
        .object({
          screen_key: z.string().trim().min(1).max(64),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("onboarding_abandoned"),
      data: z
        .object({
          last_screen_key: z.string().trim().min(1).max(64),
          index: z.number().int().min(0).max(20),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_gate_shown"),
      data: z
        .object({
          source: z.enum(["post_onboarding", "cold_open", "resume"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_cta_tapped"),
      data: z
        .object({
          source: z.enum(["post_onboarding", "cold_open", "resume"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_started"),
      data: z
        .object({
          session_id: z.string().trim().min(1).max(128),
          source: z
            .enum(["post_onboarding", "cold_open", "resume", "restart"])
            .optional(),
          auto_start: z.boolean().optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_completed"),
      data: z
        .object({
          session_id: z.string().trim().min(1).max(128),
          duration_sec: z.number().finite().min(0).max(7200),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_abandoned"),
      data: z
        .object({
          session_id: z.string().trim().min(1).max(128),
          progress: z.number().finite().min(0).max(100),
          // P7d: optional so progress-only clients still validate.
          phase: z
            .enum(["get_ready", "squeeze", "rest", "cool_down", "howto_card"])
            .optional(),
          rep_index: z.number().int().min(0).max(100).optional(),
          elapsed_sec: z.number().int().min(0).max(7200).optional(),
          exit_source: z.enum(["end", "x", "android_back", "other"]).optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("howto_card_shown"),
      data: z
        .object({
          session_id: z.string().trim().min(1).max(128),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("howto_card_dismissed"),
      data: z
        .object({
          session_id: z.string().trim().min(1).max(128),
          action: z.enum(["continue", "skip", "back"]),
          dwell_ms: z.number().int().min(0).max(86_400_000),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("day1_skip"),
      data: z
        .object({
          session_id: z.string().trim().min(1).max(128),
          step_index: z.number().int().min(0).max(100),
          progress: z.number().finite().min(0).max(100),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_skipped"),
      data: z
        .object({
          source: z.enum(["post_onboarding", "cold_open", "resume"]).optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_resume_shown"),
      data: z
        .object({
          source: z.enum([
            "post_onboarding",
            "cold_open",
            "resume",
            "cold",
            "warm",
          ]),
          step_index: z.number().int().min(0).max(100),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_resume_tapped"),
      data: z
        .object({
          step_index: z.number().int().min(0).max(100).optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_session_restart_tapped"),
      data: z
        .object({
          reason: z.string().trim().min(1).max(64),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("permission_prompt_shown"),
      data: z
        .object({
          type: z.enum(["push", "att", "other"]),
          surface: z.string().trim().min(1).max(64).optional(),
          status: z.string().trim().min(1).max(32).optional(),
          deferred: z.boolean().optional(),
          after_first_session: z.boolean().optional(),
          pre_prompt: prePromptSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("permission_result"),
      data: z
        .object({
          type: z.enum(["push", "att", "other"]),
          status: z.string().trim().min(1).max(32),
          surface: z.string().trim().min(1).max(64).optional(),
          deferred: z.boolean().optional(),
          already_granted: z.boolean().optional(),
          after_first_session: z.boolean().optional(),
          pre_prompt: prePromptSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("onboarding_resumed"),
      data: z
        .object({
          screen_key: z.string().trim().min(1).max(64),
          index: z.number().int().min(0).max(20),
          total: z.number().int().min(1).max(20),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("gate_back_blocked"),
      data: z
        .object({
          surface: z.enum(["onboarding", "gate", "first_session"]),
          action: z.enum([
            "previous_step",
            "blocked",
            "exit",
            "confirm_shown",
            "stay",
            "leave",
          ]),
          index: z.number().int().min(0).max(20).optional(),
          // P2.2c: optional so pre-P2.2 clients (no source) still ingest.
          source: z.enum(["hardware_back", "ui_x"]).optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("first_open_path"),
      data: z
        .object({
          landing_route: z.string().trim().min(1).max(64),
          onboarded_already: z.boolean(),
          launch_type: z.enum(["cold", "warm"]).optional(),
          app_state: z.string().trim().min(1).max(32).optional(),
          att_status: z.string().trim().min(1).max(32).optional(),
          build_channel: z.string().trim().min(1).max(64).optional(),
          platform: z
            .enum(["ios", "android", "web", "windows", "macos"])
            .optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_day_viewed"),
      data: z
        .object({
          week: z.number().int().min(1).max(12),
          day: z.number().int().min(1).max(7),
          state: z.enum(["locked", "available", "complete", "rest"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_day_started"),
      data: z
        .object({
          week: z.number().int().min(1).max(12),
          day: z.number().int().min(1).max(7),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_day_completed"),
      data: z
        .object({
          week: z.number().int().min(1).max(12),
          day: z.number().int().min(1).max(7),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_day2_nudge_scheduled"),
      data: z
        .object({
          channel: nudgeChannelSchema,
          followup_day: nudgeFollowupDaySchema.optional(),
          fire_at: nudgeFireAtSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_day2_nudge_shown"),
      data: z
        .object({
          channel: nudgeChannelSchema,
          followup_day: nudgeFollowupDaySchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_day2_nudge_tapped"),
      data: z
        .object({
          channel: nudgeChannelSchema,
          followup_day: nudgeFollowupDaySchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_nudge_received"),
      data: z
        .object({
          nudge: nudgeKindSchema,
          followup_day: nudgeFollowupDaySchema.optional(),
          method: z.literal("foreground"),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("challenge_nudge_fire_passed"),
      data: z
        .object({
          nudge: nudgeKindSchema,
          followup_day: nudgeFollowupDaySchema.optional(),
          permission_status: pushPermissionStatusSchema,
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("push_preprompt_shown"),
      data: z
        .object({
          surface: z.string().trim().min(1).max(64),
          attempt: prePromptAttemptSchema,
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("push_preprompt_result"),
      data: z
        .object({
          surface: z.string().trim().min(1).max(64),
          attempt: prePromptAttemptSchema,
          choice: z.enum(["yes", "not_now", "dismissed"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("comeback_shown"),
      data: z
        .object({
          idle_days: idleDaysSchema,
          has_access: z.boolean(),
          source: comebackSourceSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("comeback_tapped"),
      data: z
        .object({
          idle_days: idleDaysSchema,
          has_access: z.boolean(),
          action: z.enum(["start", "not_now"]),
          source: comebackSourceSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("comeback_completed"),
      data: z
        .object({
          idle_days: idleDaysSchema,
          source: comebackSourceSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("settings_tip_shown"),
      data: z.object({}).strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("settings_tip_dismissed"),
      data: z.object({}).strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("settings_tip_open_settings"),
      data: z.object({}).strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("transfer_flow_started"),
      data: z
        .object({
          path: z.string().trim().min(1).max(64),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("transfer_flow_completed"),
      data: z
        .object({
          path: z.string().trim().min(1).max(64),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("transfer_flow_fallback_backup"),
      data: z
        .object({
          reason: z.string().trim().min(1).max(64),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_enabled"),
      data: z
        .object({
          provider: z.string().trim().min(1).max(32).optional(),
          platform: z
            .enum(["ios", "android", "web", "windows", "macos"])
            .optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_optin_reset"),
      data: z
        .object({
          provider: z.enum(["apple", "google", "none"]),
          platform: z
            .enum(["ios", "android", "web", "windows", "macos"])
            .optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_pull_ok"),
      data: z.object({}).strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_push_ok"),
      data: z.object({}).strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_conflict"),
      data: z.record(z.unknown()),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_error"),
      data: z.record(z.unknown()),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.enum([
        "restore_started",
        "restore_completed",
        "restore_not_found",
        "restore_failed",
      ]),
      data: z
        .object({
          result: z.enum(["started", "completed", "not_found", "failed"]),
          errorCode: z.string().trim().min(1).max(100).optional(),
          reason: z.enum(["not_configured"]).optional(),
          ...purchaseContextFields,
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("offering_fallback_used"),
      data: z
        .object({
          offeringId: offeringIdSchema,
          reason: z.enum(["no_current", "current_empty"]),
          surface: z.enum(["launch", "paywall_retry"]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("offerings_failed"),
      data: z
        .object({
          surface: z.enum(["launch", "paywall_retry"]),
          configured: z.boolean().optional(),
          store: storeSchema.optional(),
          buildEnv: buildEnvSchema.optional(),
          rcCode: rcCodeSchema.optional(),
          readableErrorCode: readableErrorCodeSchema.optional(),
          errorMessage: errorMessageSchema.optional(),
          reason: z
            .enum([
              "not_configured",
              "no_offerings",
              "no_current_offering",
              "current_offering_empty",
              "fetch_error",
            ])
            .optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("purchase_entitlement_missing"),
      data: z
        .object({
          result: z.literal("entitlement_missing").optional(),
          packageIdentifier: z.string().trim().min(1).max(100).optional(),
          productIdentifier: z.string().trim().min(1).max(150).optional(),
          offeringId: offeringIdSchema.optional(),
          refreshed: z.boolean().optional(),
          store: storeSchema.optional(),
          buildEnv: buildEnvSchema.optional(),
          isSandbox: z.boolean().optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("entitlement_mismatch"),
      data: z
        .object({
          expected: z.string().trim().min(1).max(150),
          activeIds: z.array(z.string().trim().min(1).max(150)).max(5),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("subscription_status_changed"),
      data: z
        .object({
          from: z.enum(["none", "trial", "paid"]),
          to: z.enum(["none", "trial", "paid"]),
          periodType: periodTypeSchema.optional(),
          isSandbox: z.boolean().optional(),
          store: storeSchema.optional(),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("paywall_retry_tapped"),
      data: z
        .object({
          code: z.union([z.string().trim().min(1).max(100), rcCodeSchema]),
        })
        .strict(),
      ...eventMetadata,
    })
    .strict(),
]);

export const analyticsBatchSchema = z
  .object({
    deviceId: z.union([
      z.string().regex(/^[a-fA-F0-9]{64}$/),
      z.literal("unknown"),
    ]),
    events: z.array(analyticsEventSchema).min(1).max(20),
  })
  .strict();

export const weeklyReviewSchema = z
  .object({
    daysWorkedOut: z.number().int().min(0).max(7),
    weekNumber: z.number().int().min(1).max(12),
    totalMinutes: z.number().finite().min(0).max(100_000),
    anatomyType: anatomyTypeSchema.nullable().default(null),
    userName: z
      .string()
      .trim()
      .max(40)
      .regex(/^[\p{L}\p{M} .'-]*$/u)
      .default(""),
    currentStreak: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();
