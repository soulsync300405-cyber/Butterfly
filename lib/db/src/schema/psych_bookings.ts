import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const psychBookingsTable = pgTable("ss_psych_bookings", {
  id:          serial("id").primaryKey(),
  clientId:    text("client_id").notNull(),
  psychId:     integer("psych_id").notNull(),
  slot:        text("slot").notNull(),
  sessionType: text("session_type").notNull().default("chat"),
  notes:       text("notes").notNull().default(""),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPsychBookingSchema = createInsertSchema(psychBookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPsychBooking = z.infer<typeof insertPsychBookingSchema>;
export type PsychBookingRow = typeof psychBookingsTable.$inferSelect;
