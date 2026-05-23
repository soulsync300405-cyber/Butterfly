import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const psychMessagesTable = pgTable("ss_psych_messages", {
  id:        serial("id").primaryKey(),
  clientId:  text("client_id").notNull(),  // student's clientId
  psychId:   integer("psych_id").notNull(),
  role:      text("role").notNull(),        // "student" | "psych"
  content:   text("content").notNull(),
  msgTime:   text("msg_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPsychMessageSchema = createInsertSchema(psychMessagesTable).omit({ id: true, createdAt: true });
export type InsertPsychMessage = z.infer<typeof insertPsychMessageSchema>;
export type PsychMessageRow = typeof psychMessagesTable.$inferSelect;
