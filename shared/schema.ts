
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  tier: text("tier", { enum: ["small", "mid", "large", "enterprise"] }).default("small").notNull(),
  maxEmployees: integer("max_employees").default(100).notNull(),
  storeUrl: text("store_url").default("https://dscpromostore.com/").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status", { enum: ["active", "inactive", "pending"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "employee", "prime_admin"] }).default("employee").notNull(),
  status: text("status", { enum: ["pending", "approved"] }).default("approved").notNull(),
  balance: integer("balance").default(0).notNull(),
  barcode: text("barcode").notNull(),
  fullName: text("full_name").notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  email: text("email"),
  organizationId: integer("organization_id"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // Positive for credit, negative for debit
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  pointsCost: integer("points_cost").notNull(),
  description: text("description").notNull(),
  photoUrls: text("photo_urls").array().notNull(),
  itemUrl: text("item_url"),
  status: text("status", { enum: ["pending", "approved", "rejected", "completed"] }).default("pending").notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, status: true, stripeCustomerId: true, stripeSubscriptionId: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, balance: true, status: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminNotes: true });

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
