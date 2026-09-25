import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const content = pgTable("content", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  data: jsonb("data")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
});

export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
