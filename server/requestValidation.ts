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
