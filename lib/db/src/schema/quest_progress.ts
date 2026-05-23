import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questProgressTable = pgTable("ss_quest_progress", {
  id:          serial("id").primaryKey(),
  clientId:    text("client_id").notNull(),
  questId:     integer("quest_id").notNull(),
  xpEarned:    integer("xp_earned").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuestProgressSchema = createInsertSchema(questProgressTable).omit({ id: true, completedAt: true });
export type InsertQuestProgress = z.infer<typeof insertQuestProgressSchema>;
export type QuestProgressRow = typeof questProgressTable.$inferSelect;
