
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  tier: text("tier", { enum: ["small", "mid", "large", "enterprise"] }).default("small").notNull(),
  maxEmployees: integer("max_employees").default(25).notNull(),
  storeUrl: text("store_url").default("https://dscpromostore.com/").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status", { enum: ["active", "inactive", "pending", "paused", "deleted"] }).default("pending").notNull(),
  adminRoleLabel: text("admin_role_label").default("Admin").notNull(),
  employeeRoleLabel: text("employee_role_label").default("Employee").notNull(),
  storeEnabled: boolean("store_enabled").default(true).notNull(),
  manualOrdersEnabled: boolean("manual_orders_enabled").default(true).notNull(),
  bucksPerDollar: integer("bucks_per_dollar").default(100).notNull(),
  monthlyBudgetBucks: integer("monthly_budget_bucks").default(0).notNull(),
  isDemo: boolean("is_demo").default(false).notNull(),
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
  termsAcceptedAt: timestamp("terms_accepted_at"),
  marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
  successfulLoginCount: integer("successful_login_count").default(0).notNull(),
  tutorialCompleted: boolean("tutorial_completed").default(false).notNull(),
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

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url").notNull(),
  imageAlt: text("image_alt"),
  imageSource: text("image_source"),
  authorName: text("author_name").notNull(),
  authorPhotoUrl: text("author_photo_url"),
  sources: text("sources"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  title: text("title").notNull(),
  type: text("type", { enum: ["time", "quantity"] }).notNull(),
  status: text("status", { enum: ["active", "completed", "failed", "pending_distribution"] }).default("active").notNull(),
  bucksReward: integer("bucks_reward").notNull(),
  targetQuantity: integer("target_quantity"),
  currentQuantity: integer("current_quantity").default(0).notNull(),
  targetDays: integer("target_days"),
  durationUnit: text("duration_unit").default("days"),
  targetHours: integer("target_hours"),
  targetMinutes: integer("target_minutes"),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  failedAt: timestamp("failed_at"),
  completedAt: timestamp("completed_at"),
  bucksDistributedAt: timestamp("bucks_distributed_at"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goalNotifications = pgTable("goal_notifications", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type", { enum: ["failed", "distributed"] }).notNull(),
  seenAt: timestamp("seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  extraMonths: integer("extra_months").default(1).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({ id: true, createdAt: true });
export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;

export const passkeys = pgTable("passkeys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  credentialId: text("credential_id").unique().notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type"),
  backedUp: boolean("backed_up").default(false),
  transports: text("transports").array(),
  name: text("name").default("Passkey").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Passkey = typeof passkeys.$inferSelect;
export type InsertPasskey = typeof passkeys.$inferInsert;

export const insertWishlistSchema = createInsertSchema(wishlists).omit({ id: true, createdAt: true });
export const insertStoreItemSchema = createInsertSchema(storeItems).omit({ id: true, createdAt: true });
export const insertInfoRequestSchema = createInsertSchema(infoRequests).omit({ id: true, createdAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true });

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
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, currentQuantity: true, failedAt: true, completedAt: true, bucksDistributedAt: true });
export const insertGoalNotificationSchema = createInsertSchema(goalNotifications).omit({ id: true, createdAt: true, seenAt: true });
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type GoalNotification = typeof goalNotifications.$inferSelect;

// ── Surveys ──────────────────────────────────────────────────────────────────
export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  createdBy: integer("created_by").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "active", "closed"] }).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const surveyQuestions = pgTable("survey_questions", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  questionType: text("question_type", { enum: ["multiple_choice", "written"] }).notNull(),
  questionText: text("question_text").notNull(),
  options: text("options").array(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull(),
  userId: integer("user_id").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const surveyAnswers = pgTable("survey_answers", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull(),
  questionId: integer("question_id").notNull(),
  answerText: text("answer_text"),
  selectedOption: integer("selected_option"),
});

export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, createdAt: true });
export const insertSurveyQuestionSchema = createInsertSchema(surveyQuestions).omit({ id: true });
export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).omit({ id: true, submittedAt: true });
export const insertSurveyAnswerSchema = createInsertSchema(surveyAnswers).omit({ id: true });

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type SurveyQuestion = typeof surveyQuestions.$inferSelect;
export type InsertSurveyQuestion = z.infer<typeof insertSurveyQuestionSchema>;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type SurveyAnswer = typeof surveyAnswers.$inferSelect;
