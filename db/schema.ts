// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  customerName: text("customer_name").notNull(),
  itemsJson: text("items_json").notNull(),
  totalCents: integer("total_cents").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  pixStatus: text("pix_status").notNull().default("not_configured"),
  receiptText: text("receipt_text"),
  receiptLink: text("receipt_link"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
