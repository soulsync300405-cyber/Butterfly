import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const psychologistsTable = pgTable("ss_psychologists", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  licenseId:    text("license_id").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPsychologistSchema = createInsertSchema(psychologistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPsychologist = z.infer<typeof insertPsychologistSchema>;
export type Psychologist = typeof psychologistsTable.$inferSelect;
