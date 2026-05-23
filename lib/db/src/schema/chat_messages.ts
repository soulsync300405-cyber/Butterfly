import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatMessagesTable = pgTable("ss_chat_messages", {
  id:        serial("id").primaryKey(),
  clientId:  text("client_id").notNull(),
  role:      text("role").notNull(),        // "user" | "ai" | "override"
  content:   text("content").notNull(),
  msgTime:   text("msg_time").notNull(),    // display time string e.g. "10:03"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessageRow = typeof chatMessagesTable.$inferSelect;
