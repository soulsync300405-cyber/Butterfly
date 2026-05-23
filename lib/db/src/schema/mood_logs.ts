import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moodLogsTable = pgTable("ss_mood_logs", {
  id:        serial("id").primaryKey(),
  clientId:  text("client_id").notNull(),
  mood:      text("mood").notNull(),      // "great" | "good" | "okay" | "low" | "bad"
  emotion:   text("emotion").notNull().default(""),
  intensity: integer("intensity").notNull().default(5), // 1-10
  note:      text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMoodLogSchema = createInsertSchema(moodLogsTable).omit({ id: true, createdAt: true });
export type InsertMoodLog = z.infer<typeof insertMoodLogSchema>;
export type MoodLogRow = typeof moodLogsTable.$inferSelect;
