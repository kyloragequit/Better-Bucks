
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations, sql } from "drizzle-orm";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  siteId: text("site_id").unique(),
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
  licenseAcceptedAt: timestamp("license_accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  customItemName: text("custom_item_name"),
  defaultPin: text("default_pin"),
  defaultPinPlain: text("default_pin_plain"),
  reportRecipientIds: text("report_recipient_ids"),
  allowEmployeePasswordCreation: boolean("allow_employee_password_creation").default(true).notNull(),
  ordersEnabled: boolean("orders_enabled").default(true).notNull(),
  marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
  budgetSetByName: text("budget_set_by_name"),
  signupPrice: integer("signup_price"),
  maxFailedAttempts: integer("max_failed_attempts").default(10).notNull(),
  lockoutDurationMinutes: integer("lockout_duration_minutes").default(15).notNull(),
  requireSocialSignupApproval: boolean("require_social_signup_approval").default(false).notNull(),
  securityAlertEmail: text("security_alert_email"),
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
  twoFaPromptDismissed: boolean("two_fa_prompt_dismissed").default(false).notNull(),
  customItemBalance: integer("custom_item_balance").default(0).notNull(),
  lastPlainPassword: text("last_plain_password"),
  managerId: integer("manager_id"),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  expoPushToken: text("expo_push_token"),
});

export const transactionCategories = pgTable("transaction_categories", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  color: text("color").default("#4E9F3D").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monthlyReports = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  reportData: jsonb("report_data").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // Positive for credit, negative for debit
  reason: text("reason").notNull(),
  performedBy: integer("performed_by"),
  categoryId: integer("category_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customItems = pgTable("custom_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customItemBalances = pgTable("custom_item_balances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  customItemId: integer("custom_item_id").notNull(),
  balance: integer("balance").default(0).notNull(),
});

export const customItemTransactions = pgTable("custom_item_transactions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  customItemId: integer("custom_item_id"),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  performedBy: integer("performed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customItemTransactionsRelations = relations(customItemTransactions, ({ one }) => ({
  user: one(users, { fields: [customItemTransactions.userId], references: [users.id] }),
  performer: one(users, { fields: [customItemTransactions.performedBy], references: [users.id] }),
}));

export const insertCustomItemSchema = createInsertSchema(customItems).omit({ id: true, createdAt: true });
export type CustomItem = typeof customItems.$inferSelect;
export type InsertCustomItem = z.infer<typeof insertCustomItemSchema>;

export type CustomItemBalance = typeof customItemBalances.$inferSelect;

export const insertCustomItemTransactionSchema = createInsertSchema(customItemTransactions).omit({ id: true, createdAt: true });
export type CustomItemTransaction = typeof customItemTransactions.$inferSelect;
export type InsertCustomItemTransaction = z.infer<typeof insertCustomItemTransactionSchema>;


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
  quantity: integer("quantity").default(1).notNull(),
  convertedValue: text("converted_value"),
  shopWebsiteId: integer("shop_website_id"),
  description: text("description").notNull(),
  photoUrls: text("photo_urls").array().notNull(),
  itemUrl: text("item_url"),
  status: text("status", { enum: ["pending", "approved", "rejected", "completed"] }).default("pending").notNull(),
  adminNotes: text("admin_notes"),
  selectedSize: text("selected_size"),
  selectedColor: text("selected_color"),
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
  requiresSize: boolean("requires_size").default(false).notNull(),
  requiresColor: boolean("requires_color").default(false).notNull(),
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
  inquiryType: text("inquiry_type").default("betterbucks").notNull(),
  emailSent: boolean("email_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const affiliateApplications = pgTable("affiliate_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  webpage: text("webpage").notNull(),
  additionalInfo: text("additional_info").default("").notNull(),
  emailSent: boolean("email_sent").default(false).notNull(),
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
  targetType: text("target_type", { enum: ["all", "department", "team", "individual"] }).default("all").notNull(),
  targetIds: jsonb("target_ids"),
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
  linkedGoalId: integer("linked_goal_id"),
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

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  organizationId: integer("organization_id").notNull(),
  invitedBy: integer("invited_by").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["employee", "admin", "prime_admin"] }).default("employee").notNull(),
  departmentId: integer("department_id"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true });
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

// ── Reusable invite LINKS (multi-use, role-scoped, expirable) ────────────────
// org_admin (prime_admin) can create links that grant admin OR employee roles.
// manager (admin) can create links that grant employee role only.
// Anyone with the link can sign up until the link expires or is deactivated.
export const inviteLinks = pgTable("invite_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  organizationId: integer("organization_id").notNull(),
  createdByUserId: integer("created_by_user_id").notNull(),
  roleToAssign: text("role_to_assign", { enum: ["employee", "admin"] }).default("employee").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  signupCount: integer("signup_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInviteLinkSchema = createInsertSchema(inviteLinks).omit({
  id: true,
  createdAt: true,
  signupCount: true,
  isActive: true,
});
export type InviteLink = typeof inviteLinks.$inferSelect;
export type InsertInviteLink = z.infer<typeof insertInviteLinkSchema>;

export const insertTransactionCategorySchema = createInsertSchema(transactionCategories).omit({ id: true, createdAt: true });
export type TransactionCategory = typeof transactionCategories.$inferSelect;
export type InsertTransactionCategory = z.infer<typeof insertTransactionCategorySchema>;

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({ id: true, generatedAt: true });
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;

export const enterpriseAccounts = pgTable("enterprise_accounts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"),
  companyName: text("company_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  customPrice: integer("custom_price").notNull(),
  billingCycle: text("billing_cycle", { enum: ["monthly", "quarterly", "annual"] }).default("monthly").notNull(),
  maxLogins: integer("max_logins").notNull(),
  contractUrl: text("contract_url"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status", { enum: ["active", "cancelled", "pending", "paused"] }).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
});

export const insertEnterpriseAccountSchema = createInsertSchema(enterpriseAccounts).omit({ id: true, createdAt: true, cancelledAt: true, stripeCustomerId: true, stripeSubscriptionId: true, organizationId: true, status: true });
export type EnterpriseAccount = typeof enterpriseAccounts.$inferSelect;
export type InsertEnterpriseAccount = z.infer<typeof insertEnterpriseAccountSchema>;

// ── Merchants (Apple Wallet tap-to-pay closed-loop) ──────────────────────────
export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status", { enum: ["active", "disabled"] }).default("active").notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const merchantTransactions = pgTable("merchant_transactions", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  bucksAmount: integer("bucks_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletPasses = pgTable("wallet_passes", {
  serialNumber: text("serial_number").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  authToken: text("auth_token").notNull(),
  active: boolean("active").default(true).notNull(),
  lastUpdatedTag: text("last_updated_tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletPassDevices = pgTable("wallet_pass_devices", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").notNull(),
  deviceLibraryIdentifier: text("device_library_identifier").notNull(),
  pushToken: text("push_token").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stripeOrphans = pgTable(
  "stripe_orphans",
  {
    id: serial("id").primaryKey(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status", { enum: ["pending", "processing", "resolved", "failed_permanently"] }).default("pending").notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    lastError: text("last_error"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stripe_orphans_pending_pair_idx")
      .on(
        sql`(COALESCE(${table.stripeCustomerId}, ''))`,
        sql`(COALESCE(${table.stripeSubscriptionId}, ''))`,
      )
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type StripeOrphan = typeof stripeOrphans.$inferSelect;
export type InsertStripeOrphan = typeof stripeOrphans.$inferInsert;

export const insertMerchantSchema = createInsertSchema(merchants).omit({ id: true, createdAt: true, passwordHash: true }).extend({
  password: z.string().min(6),
});
export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;

export const insertMerchantTransactionSchema = createInsertSchema(merchantTransactions).omit({ id: true, createdAt: true });
export type MerchantTransaction = typeof merchantTransactions.$inferSelect;
export type InsertMerchantTransaction = z.infer<typeof insertMerchantTransactionSchema>;

export type WalletPass = typeof walletPasses.$inferSelect;
export type InsertWalletPass = typeof walletPasses.$inferInsert;
export type WalletPassDevice = typeof walletPassDevices.$inferSelect;
export type InsertWalletPassDevice = typeof walletPassDevices.$inferInsert;

export const apnsPushRetries = pgTable("apns_push_retries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  status: text("status", { enum: ["pending", "processing", "resolved", "failed_permanently"] }).default("pending").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  lastError: text("last_error"),
  nextAttemptAt: timestamp("next_attempt_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => [
  uniqueIndex("apns_push_retries_pending_employee_idx")
    .on(table.employeeId)
    .where(sql`${table.status} = 'pending'`),
]);

export type ApnsPushRetry = typeof apnsPushRetries.$inferSelect;
export type InsertApnsPushRetry = typeof apnsPushRetries.$inferInsert;

export const userSocialLinks = pgTable("user_social_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  provider: text("provider", { enum: ["google", "apple"] }).notNull(),
  providerUserId: text("provider_user_id").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserSocialLink = typeof userSocialLinks.$inferSelect;
export type InsertUserSocialLink = typeof userSocialLinks.$inferInsert;

// ── Notification log ───────────────────────────────────────────────────────────
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({ id: true, sentAt: true });
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

// ── Peer-to-peer Bucks transfers ───────────────────────────────────────────────
export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  recipientId: integer("recipient_id"), // null until completion for nfc/qr
  amount: integer("amount").notNull(),
  method: text("method", { enum: ["nfc", "qr", "direct"] }).notNull(),
  status: text("status", { enum: ["pending", "completed", "declined", "expired", "reversed"] }).default("pending").notNull(),
  note: text("note"),
  tokenHash: text("token_hash").unique(), // SHA-256 of raw token — enforces single-use
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const transferLimits = pgTable("transfer_limits", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id"), // null = org-wide default
  dailyLimit: integer("daily_limit").default(10000).notNull(), // Bucks per day
  perTxnLimit: integer("per_txn_limit").default(2000).notNull(), // Bucks per transaction
});

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = typeof transfers.$inferInsert;
export type TransferLimit = typeof transferLimits.$inferSelect;
export type InsertTransferLimit = typeof transferLimits.$inferInsert;

// ── Merchant transaction disputes ─────────────────────────────────────────────
export const merchantTransactionDisputes = pgTable("merchant_transaction_disputes", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  orgId: integer("org_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "refunded", "dismissed"] }).default("pending").notNull(),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  resolvedByUserId: integer("resolved_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMerchantTransactionDisputeSchema = createInsertSchema(merchantTransactionDisputes).omit({
  id: true, createdAt: true, resolvedAt: true, resolvedByUserId: true, adminNotes: true, status: true,
});
export type MerchantTransactionDispute = typeof merchantTransactionDisputes.$inferSelect;
export type InsertMerchantTransactionDispute = z.infer<typeof insertMerchantTransactionDisputeSchema>;
