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
  "unknown",
]);
const purchaseResultSchema = z.enum([
  "started",
  "completed",
  "cancelled",
  "failed",
  "unavailable",
]);
const purchaseDataSchema = z
  .object({
    result: purchaseResultSchema,
    packageIdentifier: z.string().trim().min(1).max(100).optional(),
    productIdentifier: z.string().trim().min(1).max(150).optional(),
    errorCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
const eventMetadata = {
  platform: z.enum(["ios", "android", "web", "windows", "macos"]).optional(),
  appVersion: z.string().trim().min(1).max(20).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
};

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
        })
        .strict(),
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
      type: z.literal("permission_prompt_shown"),
      data: z
        .object({
          type: z.enum(["push", "att", "other"]),
          surface: z.string().trim().min(1).max(64).optional(),
          status: z.string().trim().min(1).max(32).optional(),
          deferred: z.boolean().optional(),
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
          channel: z.enum(["push", "in_app"]),
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
          channel: z.enum(["push", "in_app"]),
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
          channel: z.enum(["push", "in_app"]),
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
      type: z.enum([
        "restore_started",
        "restore_completed",
        "restore_not_found",
        "restore_failed",
      ]),
      data: z
        .object({
          result: z.enum(["started", "completed", "not_found", "failed"]),
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
