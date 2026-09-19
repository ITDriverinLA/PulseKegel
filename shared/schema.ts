import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  serial,
  jsonb,
  timestamp,
  index,
  boolean,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    deviceId: varchar("device_id", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventData: jsonb("event_data"),
    platform: varchar("platform", { length: 10 }),
    appVersion: varchar("app_version", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_device_id_idx").on(table.deviceId),
    index("analytics_event_type_idx").on(table.eventType),
    index("analytics_created_at_idx").on(table.createdAt),
  ],
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * Epic G1 Path A — cloud sync accounts (created only after client opt-in + auth).
 * Progress payloads are never written without a valid sync session token.
 */
export const syncAccounts = pgTable(
  "sync_accounts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: varchar("provider", { length: 16 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    accessTokenHash: varchar("access_token_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    revoked: boolean("revoked").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("sync_accounts_provider_subject_uidx").on(
      table.provider,
      table.providerSubject,
    ),
    index("sync_accounts_token_hash_idx").on(table.accessTokenHash),
  ],
);

export type SyncAccount = typeof syncAccounts.$inferSelect;

/** Versioned progress snapshot — only upserted when Authorization is valid. */
export const syncSnapshots = pgTable(
  "sync_snapshots",
  {
    id: serial("id").primaryKey(),
    accountId: varchar("account_id", { length: 64 })
      .notNull()
      .references(() => syncAccounts.id, { onDelete: "cascade" }),
    schemaVersion: integer("schema_version").notNull(),
    payload: jsonb("payload").notNull(),
    exportedAt: timestamp("exported_at").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sync_snapshots_account_uidx").on(table.accountId),
    index("sync_snapshots_updated_at_idx").on(table.updatedAt),
  ],
);

export type SyncSnapshot = typeof syncSnapshots.$inferSelect;
