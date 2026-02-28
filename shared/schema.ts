
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
  status: text("status", { enum: ["active", "inactive", "pending", "paused"] }).default("pending").notNull(),
  adminRoleLabel: text("admin_role_label").default("Admin").notNull(),
  employeeRoleLabel: text("employee_role_label").default("Employee").notNull(),
  storeEnabled: boolean("store_enabled").default(true).notNull(),
  manualOrdersEnabled: boolean("manual_orders_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: integer("organization_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "employee", "prime_admin", "developer"] }).default("employee").notNull(),
  status: text("status", { enum: ["pending", "approved"] }).default("approved").notNull(),
  balance: integer("balance").default(0).notNull(),
  barcode: text("barcode").notNull(),
  fullName: text("full_name").notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  passwordLastChanged: timestamp("password_last_changed"),
  email: text("email"),
  phone: text("phone"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationCode: text("email_verification_code"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  organizationId: integer("organization_id"),
  departmentId: integer("department_id"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // Positive for credit, negative for debit
  reason: text("reason").notNull(),
  performedBy: integer("performed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.organizationId],
    references: [organizations.id],
  }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const shopWebsites = pgTable("shop_websites", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  pointsPerDollar: integer("points_per_dollar").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  pointsCost: integer("points_cost").notNull(),
  convertedValue: text("converted_value"),
  shopWebsiteId: integer("shop_website_id"),
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

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  originalFilename: text("original_filename").notNull(),
  assignedToUserId: integer("assigned_to_user_id").notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  isDisciplinaryAction: boolean("is_disciplinary_action").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  assignedTo: one(users, {
    fields: [documents.assignedToUserId],
    references: [users.id],
    relationName: "assignedDocuments",
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedByUserId],
    references: [users.id],
    relationName: "uploadedDocuments",
  }),
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
}));

export const pageContent = pgTable("page_content", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  url: text("url").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  storeItemId: integer("store_item_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const infoRequests = pgTable("info_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  needs: text("needs").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWishlistSchema = createInsertSchema(wishlists).omit({ id: true, createdAt: true });
export const insertStoreItemSchema = createInsertSchema(storeItems).omit({ id: true, createdAt: true });
export const insertInfoRequestSchema = createInsertSchema(infoRequests).omit({ id: true, createdAt: true });

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, status: true, stripeCustomerId: true, stripeSubscriptionId: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, balance: true, status: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminNotes: true });
export const insertShopWebsiteSchema = createInsertSchema(shopWebsites).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type ShopWebsite = typeof shopWebsites.$inferSelect;
export type InsertShopWebsite = z.infer<typeof insertShopWebsiteSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InfoRequest = typeof infoRequests.$inferSelect;
export type InsertInfoRequest = z.infer<typeof insertInfoRequestSchema>;
export type PageContent = typeof pageContent.$inferSelect;
export type StoreItem = typeof storeItems.$inferSelect;
export type InsertStoreItem = z.infer<typeof insertStoreItemSchema>;
export type Wishlist = typeof wishlists.$inferSelect;
export type InsertWishlist = z.infer<typeof insertWishlistSchema>;
