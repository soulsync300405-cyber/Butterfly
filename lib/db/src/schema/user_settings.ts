import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userSettingsTable = pgTable("ss_user_settings", {
  id:               serial("id").primaryKey(),
  clientId:         text("client_id").notNull().unique(),
  theme:            text("theme").notNull().default("light"),
  notifications:    boolean("notifications").notNull().default(true),
  dailyReminder:    text("daily_reminder").notNull().default("09:00"),
  weeklyReport:     boolean("weekly_report").notNull().default(true),
  dataSharing:      boolean("data_sharing").notNull().default(false),
  analytics:        boolean("analytics").notNull().default(true),
  sessionRecording: boolean("session_recording").notNull().default(false),
  fontSize:         text("font_size").notNull().default("medium"),
  language:         text("language").notNull().default("hinglish"),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({ id: true, updatedAt: true });
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettingsRow = typeof userSettingsTable.$inferSelect;
