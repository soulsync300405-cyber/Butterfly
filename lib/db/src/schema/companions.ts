import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companionsTable = pgTable("ss_companions", {
  id:          serial("id").primaryKey(),
  clientId:    text("client_id").notNull().unique(),
  name:        text("name").notNull().default("Asha"),
  gender:      text("gender").notNull().default("female"),
  description: text("description").notNull().default(""),
  appearance:  text("appearance").notNull().default("soft-pastel"),
  voiceStyle:  text("voice_style").notNull().default("calm"),
  language:    text("language").notNull().default("hinglish"),
  tone:        integer("tone").notNull().default(50),
  creativity:  integer("creativity").notNull().default(70),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanionSchema = createInsertSchema(companionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type CompanionRow = typeof companionsTable.$inferSelect;
