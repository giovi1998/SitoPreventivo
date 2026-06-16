import { pgTable, serial, varchar, text, integer, jsonb, timestamp, bigint } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).notNull(),
  gender: varchar({ length: 50 }),
  role: varchar({ length: 20 }).default("user"),
  tokensUsed: bigint("tokens_used", { mode: "number" }).default(0),
  tokenLimit: bigint("token_limit", { mode: "number" }).default(1000000),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar({ length: 50 }).primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  title: varchar({ length: 255 }),
  client: varchar({ length: 255 }),
  date: varchar({ length: 50 }),
  intro: text(),
  color: varchar({ length: 50 }),
  vat: integer().default(22),
  status: varchar({ length: 50 }).default("BOZZA"),
  owner: varchar({ length: 255 }),
  options: jsonb(),
  clauses: jsonb(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  key: varchar({ length: 100 }).primaryKey(),
  value: text(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
