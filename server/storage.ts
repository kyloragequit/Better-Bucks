
import { db } from "./db";
import { users, transactions, orders, organizations, shopWebsites, documents, departments, pageContent, storeItems, wishlists, blogPosts, goals, goalNotifications, referralCodes, passkeys, surveys, surveyQuestions, surveyResponses, surveyAnswers, customItems, customItemBalances, customItemTransactions, invitations, transactionCategories, monthlyReports, enterpriseAccounts, type User, type InsertUser, type Transaction, type InsertTransaction, type Order, type InsertOrder, type Organization, type InsertOrganization, type ShopWebsite, type InsertShopWebsite, type Document, type InsertDocument, type Department, type InsertDepartment, type StoreItem, type InsertStoreItem, type Wishlist, type BlogPost, type InsertBlogPost, type Goal, type InsertGoal, type GoalNotification, type ReferralCode, type InsertReferralCode, type Passkey, type InsertPasskey, type Survey, type InsertSurvey, type SurveyQuestion, type InsertSurveyQuestion, type SurveyResponse, type SurveyAnswer, type CustomItem, type InsertCustomItem, type CustomItemBalance, type CustomItemTransaction, type InsertCustomItemTransaction, type Invitation, type InsertInvitation, type TransactionCategory, type InsertTransactionCategory, type MonthlyReport, type InsertMonthlyReport, type EnterpriseAccount } from "@shared/schema";
import { eq, desc, and, ne, ilike, or, gte, lte, isNull, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, amount: number): Promise<User>;
  updateUserRole(userId: number, role: "admin" | "employee" | "prime_admin"): Promise<User>;
  approveAdminUser(userId: number): Promise<User>;
  getPendingAdmins(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUsersByOrganization(organizationId: number): Promise<User[]>;
  getPendingAdminsByOrganization(organizationId: number): Promise<User[]>;
  getUserByUsernameAndOrg(username: string, organizationId: number): Promise<User | undefined>;
  getUserByEmailAndOrg(email: string, organizationId: number): Promise<User | undefined>;
  getUserByPhoneAndOrg(phone: string, organizationId: number): Promise<User | undefined>;
  getUserByEmailGlobal(email: string): Promise<User | undefined>;
  getUserByPhoneGlobal(phone: string): Promise<User | undefined>;
  updateUserEmailVerification(userId: number, code: string | null, verified: boolean): Promise<User>;
  setPasswordResetToken(userId: number, token: string | null, expiry: Date | null): Promise<User>;
  setTutorialCompleted(userId: number, completed: boolean): Promise<User>;
  
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<(Transaction & { user: User })[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  getAllOrders(): Promise<(Order & { user: User })[]>;
  getOrdersByOrganization(organizationId: number): Promise<(Order & { user: User })[]>;
  updateOrderStatus(id: number, status: string, adminNotes?: string): Promise<Order>;
  updateOrderPointsCost(id: number, pointsCost: number): Promise<Order>;

  updateOrgCustomItemName(orgId: number, name: string | null): Promise<Organization>;
  updateUserCustomItemBalance(userId: number, delta: number): Promise<User>;
  createCustomItemTransaction(tx: InsertCustomItemTransaction): Promise<CustomItemTransaction>;
  getCustomItemTransactionsByOrg(orgId: number, since?: Date): Promise<(CustomItemTransaction & { user: User })[]>;

  getCustomItemsByOrg(orgId: number): Promise<CustomItem[]>;
  getCustomItem(id: number): Promise<CustomItem | undefined>;
  createCustomItem(item: InsertCustomItem): Promise<CustomItem>;
  updateCustomItem(id: number, name: string): Promise<CustomItem>;
  deleteCustomItem(id: number): Promise<void>;
  getCustomItemBalance(userId: number, customItemId: number): Promise<number>;
  getCustomItemBalancesForItem(customItemId: number): Promise<CustomItemBalance[]>;
  updateCustomItemBalanceFor(userId: number, customItemId: number, delta: number): Promise<number>;
  getCustomItemTransactionsForItem(orgId: number, customItemId: number): Promise<(CustomItemTransaction & { user: User })[]>;

  getAllOrganizations(): Promise<Organization[]>;
  getAllOrganizationsIncludingDeleted(): Promise<Organization[]>;
  
  createShopWebsite(website: InsertShopWebsite): Promise<ShopWebsite>;
  getShopWebsitesByOrganization(organizationId: number): Promise<ShopWebsite[]>;
  getShopWebsite(id: number): Promise<ShopWebsite | undefined>;
  updateShopWebsite(id: number, data: Partial<InsertShopWebsite>): Promise<ShopWebsite>;
  deleteShopWebsite(id: number): Promise<void>;

  updateUserPassword(userId: number, password: string): Promise<User>;

  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByCode(code: string): Promise<Organization | undefined>;
  getOrganizationBySiteId(siteId: string): Promise<Organization | undefined>;
  setOrganizationSiteId(id: number, siteId: string | null): Promise<Organization>;
  getOrganizationByStripeCustomerId(customerId: string): Promise<Organization | undefined>;
  updateOrganizationStripe(id: number, stripeCustomerId: string, stripeSubscriptionId: string): Promise<Organization>;
  updateOrganizationStatus(id: number, status: "active" | "inactive" | "pending" | "paused" | "deleted"): Promise<Organization>;
  updateOrganizationStoreUrl(id: number, storeUrl: string): Promise<Organization>;
  updateOrganizationTier(id: number, tier: "small" | "mid" | "large" | "enterprise", maxEmployees: number): Promise<Organization>;
  updateOrganizationSignupPrice(id: number, signupPrice: number): Promise<Organization>;
  deleteOrganization(id: number): Promise<void>;

  createDocument(doc: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: number): Promise<(Document & { uploadedBy: User })[]>;
  getDocumentsByOrganization(organizationId: number, filters?: { search?: string; assignedToUserId?: number; isDisciplinaryAction?: boolean; dateFrom?: Date; dateTo?: Date }): Promise<(Document & { assignedTo: User; uploadedBy: User })[]>;
  getDocument(id: number): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;

  createDepartment(dept: InsertDepartment): Promise<Department>;
  getDepartmentsByOrganization(organizationId: number): Promise<Department[]>;
  getDepartment(id: number): Promise<Department | undefined>;
  updateDepartment(id: number, name: string): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;
  updateUserDepartment(userId: number, departmentId: number | null): Promise<User>;
  updateUserManager(userId: number, managerId: number | null): Promise<User>;
  updateOrganizationRoleLabels(id: number, adminLabel: string, employeeLabel: string): Promise<Organization>;

  getPageContent(): Promise<Record<string, string>>;
  setPageContent(entries: Record<string, string>): Promise<void>;

  updateOrganizationFeatureFlags(id: number, storeEnabled: boolean, manualOrdersEnabled: boolean, allowEmployeePasswordCreation: boolean, ordersEnabled: boolean): Promise<Organization>;
  updateOrganizationBudgetSettings(id: number, bucksPerDollar: number, monthlyBudgetBucks: number, budgetSetByName?: string): Promise<Organization>;
  setOrganizationDefaultPin(orgId: number, hashedPin: string | null, plainPin?: string | null): Promise<Organization>;
  setOrganizationReportRecipients(orgId: number, userIds: number[] | null): Promise<Organization>;

  createStoreItem(item: InsertStoreItem): Promise<StoreItem>;
  getStoreItemsByOrganization(organizationId: number): Promise<StoreItem[]>;
  getStoreItem(id: number): Promise<StoreItem | undefined>;
  updateStoreItem(id: number, data: Partial<InsertStoreItem>): Promise<StoreItem>;
  deleteStoreItem(id: number): Promise<void>;

  addToWishlist(userId: number, storeItemId: number): Promise<Wishlist>;
  removeFromWishlist(userId: number, storeItemId: number): Promise<void>;
  getWishlistByUser(userId: number): Promise<(Wishlist & { storeItem: StoreItem })[]>;
  getWishlistsByOrganization(organizationId: number): Promise<(Wishlist & { storeItem: StoreItem; user: User })[]>;

  acceptTerms(userId: number, marketingOptIn: boolean): Promise<User>;
  incrementSuccessfulLoginCount(userId: number): Promise<User>;
  dismissTwoFaPrompt(userId: number): Promise<User>;
  updateUserContactInfo(userId: number, email: string | null, phone: string | null): Promise<User>;

  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;

  getAllReferralCodes(): Promise<ReferralCode[]>;
  getReferralCode(code: string): Promise<ReferralCode | undefined>;
  createReferralCode(data: InsertReferralCode): Promise<ReferralCode>;
  updateReferralCode(id: number, data: Partial<InsertReferralCode>): Promise<ReferralCode>;
  deleteReferralCode(id: number): Promise<void>;

  createGoal(goal: InsertGoal): Promise<Goal>;
  getGoal(id: number): Promise<Goal | undefined>;
  getGoalsByOrganization(organizationId: number): Promise<Goal[]>;
  updateGoal(id: number, data: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;
  incrementGoalQuantity(id: number, amount: number): Promise<Goal>;
  failGoal(id: number): Promise<Goal>;
  completeGoal(id: number): Promise<Goal>;
  distributeGoalBucks(goalId: number, organizationId: number, performedBy: number): Promise<Goal>;
  createGoalNotificationsForOrg(goalId: number, organizationId: number, type: "failed" | "distributed"): Promise<void>;
  getUnseenGoalNotifications(userId: number): Promise<(GoalNotification & { goal: Goal })[]>;
  markGoalNotificationsSeen(userId: number): Promise<void>;

  getPasskeysByUser(userId: number): Promise<Passkey[]>;
  getPasskeyByCredentialId(credentialId: string): Promise<Passkey | undefined>;
  createPasskey(data: InsertPasskey): Promise<Passkey>;
  updatePasskeyCounter(id: number, counter: number): Promise<void>;
  renamePasskey(id: number, name: string): Promise<void>;
  deletePasskey(id: number): Promise<void>;

  createSurvey(data: InsertSurvey, questions: Omit<InsertSurveyQuestion, "surveyId">[]): Promise<Survey & { questions: SurveyQuestion[] }>;
  getSurveysByOrganization(organizationId: number): Promise<(Survey & { questions: SurveyQuestion[]; responseCount: number })[]>;
  getSurvey(id: number): Promise<(Survey & { questions: SurveyQuestion[] }) | undefined>;
  updateSurveyStatus(id: number, status: "draft" | "active" | "closed"): Promise<Survey>;
  deleteSurvey(id: number): Promise<void>;
  hasUserRespondedToSurvey(surveyId: number, userId: number): Promise<boolean>;
  submitSurveyResponse(surveyId: number, userId: number, answers: { questionId: number; answerText?: string; selectedOption?: number }[]): Promise<void>;
  getSurveyResults(surveyId: number): Promise<{ question: SurveyQuestion; answers: SurveyAnswer[]; respondents: number }[]>;
  getSurveyRespondents(surveyId: number): Promise<{ user: Pick<User, "id" | "fullName">; submittedAt: Date }[]>;

  createInvitation(data: InsertInvitation): Promise<Invitation>;
  getInvitationsByOrganization(orgId: number): Promise<Invitation[]>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  acceptInvitation(id: number): Promise<Invitation>;
  revokeInvitation(id: number): Promise<void>;

  getCategoriesByOrg(orgId: number): Promise<TransactionCategory[]>;
  createCategory(data: InsertTransactionCategory): Promise<TransactionCategory>;
  deleteCategory(id: number, orgId: number): Promise<void>;
  updateCategory(id: number, orgId: number, data: { name?: string; color?: string }): Promise<TransactionCategory>;

  getCategoryStats(orgId: number, from: Date, to: Date, performedBy?: number): Promise<{ categoryId: number | null; categoryName: string | null; categoryColor: string | null; totalBucks: number }[]>;
  getMonthlyBudgetUsed(orgId: number, year: number, month: number): Promise<number>;

  createMonthlyReport(data: InsertMonthlyReport): Promise<MonthlyReport>;
  getMonthlyReportsByOrg(orgId: number): Promise<MonthlyReport[]>;
  getMonthlyReport(orgId: number, year: number, month: number): Promise<MonthlyReport | undefined>;

  createEnterpriseAccount(data: any): Promise<EnterpriseAccount>;
  getAllEnterpriseAccounts(): Promise<EnterpriseAccount[]>;
  getEnterpriseAccount(id: number): Promise<EnterpriseAccount | undefined>;
  updateEnterpriseAccount(id: number, data: Partial<EnterpriseAccount>): Promise<EnterpriseAccount>;
  deleteEnterpriseAccount(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`);
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserBalance(userId: number, amount: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ balance: sql`${users.balance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    if (!updatedUser) throw new Error("User not found");
    return updatedUser;
  }

  async updateUserRole(userId: number, role: "admin" | "employee" | "prime_admin"): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser;
  }

  async updateUserProfile(userId: number, data: { fullName?: string; username?: string; password?: string; email?: string | null; departmentId?: number | null }): Promise<User> {
    const { hashPassword } = await import("./auth");
    const updateData: Record<string, any> = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.password && data.password.length > 0) {
      updateData.password = await hashPassword(data.password);
      updateData.lastPlainPassword = data.password;
      updateData.mustChangePassword = false;
      updateData.passwordLastChanged = new Date();
    }
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async deleteUser(userId: number): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async approveAdminUser(userId: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ status: "approved" })
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser;
  }

  async getPendingAdmins(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.status, "pending")).orderBy(users.fullName);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.fullName);
  }

  async getUsersByOrganization(organizationId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(eq(users.organizationId, organizationId), ne(users.role, "developer"))
    ).orderBy(users.fullName);
  }

  async getPendingAdminsByOrganization(organizationId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(eq(users.status, "pending"), eq(users.organizationId, organizationId))
    ).orderBy(users.fullName);
  }

  async getUserByUsernameAndOrg(username: string, organizationId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(
        sql`lower(${users.username}) = lower(${username})`,
        eq(users.organizationId, organizationId),
      )
    );
    return user;
  }

  async getUserByEmailAndOrg(email: string, organizationId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.email, email), eq(users.organizationId, organizationId))
    );
    return user;
  }

  async getUserByPhoneAndOrg(phone: string, organizationId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.phone, phone), eq(users.organizationId, organizationId))
    );
    return user;
  }

  async getUserByEmailGlobal(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${normalized}`);
    return user;
  }

  async getUserByPhoneGlobal(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async updateUserEmailVerification(userId: number, code: string | null, verified: boolean): Promise<User> {
    const [updated] = await db.update(users).set({
      emailVerificationCode: code,
      emailVerified: verified,
    }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async setPasswordResetToken(userId: number, token: string | null, expiry: Date | null): Promise<User> {
    const [updated] = await db.update(users).set({
      passwordResetToken: token,
      passwordResetExpiry: expiry,
    }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactionsByUser(userId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<(Transaction & { user: User })[]> {
    // Join not strictly needed for simple list, but helpful if we want to show who
    // For now simple select is fine, or manual join
    const result = await db
      .select({
        transaction: transactions,
        user: users,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .orderBy(desc(transactions.createdAt));
      
    return result.map(row => ({
      ...row.transaction,
      user: row.user!
    }));
  }
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByUser(userId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<(Order & { user: User })[]> {
    const result = await db
      .select({ order: orders, user: users })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt));
    return result.map(row => ({ ...row.order, user: row.user! }));
  }

  async getOrdersByOrganization(organizationId: number): Promise<(Order & { user: User })[]> {
    const result = await db
      .select({ order: orders, user: users })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(users.organizationId, organizationId))
      .orderBy(desc(orders.createdAt));
    return result.map(row => ({ ...row.order, user: row.user! }));
  }

  async updateOrderStatus(id: number, status: string, adminNotes?: string): Promise<Order> {
    const updateData: any = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    const [updated] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return updated;
  }

  async updateOrderPointsCost(id: number, pointsCost: number): Promise<Order> {
    const [updated] = await db.update(orders).set({ pointsCost, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return updated;
  }

  async updateOrgCustomItemName(orgId: number, name: string | null): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ customItemName: name }).where(eq(organizations.id, orgId)).returning();
    return updated;
  }

  async updateUserCustomItemBalance(userId: number, delta: number): Promise<User> {
    const [updated] = await db.update(users).set({ customItemBalance: sql`custom_item_balance + ${delta}` }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async createCustomItemTransaction(tx: InsertCustomItemTransaction): Promise<CustomItemTransaction> {
    const [created] = await db.insert(customItemTransactions).values(tx).returning();
    return created;
  }

  async getCustomItemsByOrg(orgId: number): Promise<CustomItem[]> {
    return await db.select().from(customItems).where(eq(customItems.orgId, orgId)).orderBy(customItems.id);
  }

  async getCustomItem(id: number): Promise<CustomItem | undefined> {
    const [r] = await db.select().from(customItems).where(eq(customItems.id, id));
    return r;
  }

  async createCustomItem(item: InsertCustomItem): Promise<CustomItem> {
    const [r] = await db.insert(customItems).values(item).returning();
    return r;
  }

  async updateCustomItem(id: number, name: string): Promise<CustomItem> {
    const [r] = await db.update(customItems).set({ name }).where(eq(customItems.id, id)).returning();
    return r;
  }

  async deleteCustomItem(id: number): Promise<void> {
    await db.delete(customItemBalances).where(eq(customItemBalances.customItemId, id));
    await db.delete(customItemTransactions).where(eq(customItemTransactions.customItemId, id));
    await db.delete(customItems).where(eq(customItems.id, id));
  }

  async getCustomItemBalance(userId: number, customItemId: number): Promise<number> {
    const [r] = await db.select().from(customItemBalances)
      .where(and(eq(customItemBalances.userId, userId), eq(customItemBalances.customItemId, customItemId)));
    return r?.balance ?? 0;
  }

  async getCustomItemBalancesForItem(customItemId: number): Promise<CustomItemBalance[]> {
    return await db.select().from(customItemBalances).where(eq(customItemBalances.customItemId, customItemId));
  }

  async updateCustomItemBalanceFor(userId: number, customItemId: number, delta: number): Promise<number> {
    const existing = await db.select().from(customItemBalances)
      .where(and(eq(customItemBalances.userId, userId), eq(customItemBalances.customItemId, customItemId)));
    if (existing.length === 0) {
      const [r] = await db.insert(customItemBalances).values({ userId, customItemId, balance: delta }).returning();
      return r.balance;
    }
    const [r] = await db.update(customItemBalances)
      .set({ balance: sql`balance + ${delta}` })
      .where(and(eq(customItemBalances.userId, userId), eq(customItemBalances.customItemId, customItemId)))
      .returning();
    return r.balance;
  }

  async getCustomItemTransactionsForItem(orgId: number, customItemId: number): Promise<(CustomItemTransaction & { user: User })[]> {
    const rows = await db
      .select({ tx: customItemTransactions, user: users })
      .from(customItemTransactions)
      .innerJoin(users, eq(customItemTransactions.userId, users.id))
      .where(and(eq(customItemTransactions.orgId, orgId), eq(customItemTransactions.customItemId, customItemId)))
      .orderBy(desc(customItemTransactions.createdAt));
    return rows.map(r => ({ ...r.tx, user: r.user }));
  }

  async getCustomItemTransactionsByOrg(orgId: number, since?: Date): Promise<(CustomItemTransaction & { user: User })[]> {
    const rows = await db
      .select({ tx: customItemTransactions, user: users })
      .from(customItemTransactions)
      .innerJoin(users, eq(customItemTransactions.userId, users.id))
      .where(
        since
          ? and(eq(customItemTransactions.orgId, orgId), gte(customItemTransactions.createdAt, since))
          : eq(customItemTransactions.orgId, orgId)
      )
      .orderBy(desc(customItemTransactions.createdAt));
    return rows.map(r => ({ ...r.tx, user: r.user }));
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationByCode(code: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.code, code));
    return org;
  }

  async getOrganizationBySiteId(siteId: string): Promise<Organization | undefined> {
    const lower = siteId.toLowerCase();
    // First try the dedicated site_id field, then fall back to the org code
    const [byId] = await db.select().from(organizations).where(eq(organizations.siteId, lower));
    if (byId) return byId;
    const [byCode] = await db.select().from(organizations).where(eq(sql`lower(${organizations.code})`, lower));
    return byCode;
  }

  async setOrganizationSiteId(id: number, siteId: string | null): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ siteId: siteId ? siteId.toLowerCase() : null }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async getOrganizationByStripeCustomerId(customerId: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.stripeCustomerId, customerId));
    return org;
  }

  async updateOrganizationStripe(id: number, stripeCustomerId: string, stripeSubscriptionId: string): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ stripeCustomerId, stripeSubscriptionId, status: "active" }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async updateOrganizationStatus(id: number, status: "active" | "inactive" | "pending" | "paused" | "deleted"): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ status }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async updateOrganizationStoreUrl(id: number, storeUrl: string): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ storeUrl }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async updateOrganizationTier(id: number, tier: "small" | "mid" | "large" | "enterprise", maxEmployees: number): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ tier, maxEmployees }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async updateOrganizationSignupPrice(id: number, signupPrice: number): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ signupPrice }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations).where(ne(organizations.status, "deleted")).orderBy(organizations.name);
  }

  async getAllOrganizationsIncludingDeleted(): Promise<Organization[]> {
    return await db.select().from(organizations).orderBy(organizations.name);
  }

  async createShopWebsite(website: InsertShopWebsite): Promise<ShopWebsite> {
    const [newWebsite] = await db.insert(shopWebsites).values(website).returning();
    return newWebsite;
  }

  async getShopWebsitesByOrganization(organizationId: number): Promise<ShopWebsite[]> {
    return await db.select().from(shopWebsites).where(eq(shopWebsites.organizationId, organizationId)).orderBy(shopWebsites.name);
  }

  async getShopWebsite(id: number): Promise<ShopWebsite | undefined> {
    const [website] = await db.select().from(shopWebsites).where(eq(shopWebsites.id, id));
    return website;
  }

  async updateShopWebsite(id: number, data: Partial<InsertShopWebsite>): Promise<ShopWebsite> {
    const [updated] = await db.update(shopWebsites).set(data).where(eq(shopWebsites.id, id)).returning();
    return updated;
  }

  async deleteShopWebsite(id: number): Promise<void> {
    await db.delete(shopWebsites).where(eq(shopWebsites.id, id));
  }

  async updateUserPassword(userId: number, password: string): Promise<User> {
    const { hashPassword } = await import("./auth");
    const isAlreadyHashed = password.startsWith("$2b$") || password.startsWith("$2a$");
    const stored = isAlreadyHashed ? password : await hashPassword(password);
    const updateData: Record<string, any> = {
      password: stored,
      mustChangePassword: false,
      passwordLastChanged: new Date(),
    };
    if (!isAlreadyHashed) {
      updateData.lastPlainPassword = password;
    }
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [newDoc] = await db.insert(documents).values(doc).returning();
    return newDoc;
  }

  async getDocumentsByUser(userId: number): Promise<(Document & { uploadedBy: User })[]> {
    const uploadedByUsers = db.$with("uploaded_by_users").as(db.select().from(users));
    const result = await db
      .select({ document: documents, uploadedBy: users })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedByUserId, users.id))
      .where(eq(documents.assignedToUserId, userId))
      .orderBy(desc(documents.createdAt));
    return result.map(row => ({ ...row.document, uploadedBy: row.uploadedBy! }));
  }

  async getDocumentsByOrganization(organizationId: number, filters?: { search?: string; assignedToUserId?: number; isDisciplinaryAction?: boolean; dateFrom?: Date; dateTo?: Date }): Promise<(Document & { assignedTo: User; uploadedBy: User })[]> {
    const assignedToAlias = db.select().from(users).as("assigned_to_users");
    const conditions: any[] = [eq(documents.organizationId, organizationId)];

    if (filters?.assignedToUserId) {
      conditions.push(eq(documents.assignedToUserId, filters.assignedToUserId));
    }
    if (filters?.isDisciplinaryAction !== undefined) {
      conditions.push(eq(documents.isDisciplinaryAction, filters.isDisciplinaryAction));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(documents.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(documents.createdAt, filters.dateTo));
    }
    if (filters?.search) {
      conditions.push(ilike(documents.name, `%${filters.search}%`));
    }

    const uploadedByAlias = db.select().from(users).as("uploaded_by_alias");

    const result = await db
      .select({
        document: documents,
        assignedTo: { id: users.id, username: users.username, fullName: users.fullName, role: users.role, status: users.status, balance: users.balance, barcode: users.barcode, password: users.password, mustChangePassword: users.mustChangePassword, passwordLastChanged: users.passwordLastChanged, email: users.email, phone: users.phone, emailVerified: users.emailVerified, emailVerificationCode: users.emailVerificationCode, organizationId: users.organizationId },
      })
      .from(documents)
      .leftJoin(users, eq(documents.assignedToUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));

    const uploaderIds = Array.from(new Set(result.map(r => r.document.uploadedByUserId)));
    const uploaders = uploaderIds.length > 0
      ? await db.select().from(users).where(or(...uploaderIds.map(uid => eq(users.id, uid))))
      : [];
    const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

    return result.map(row => ({
      ...row.document,
      assignedTo: row.assignedTo as User,
      uploadedBy: uploaderMap.get(row.document.uploadedByUserId) as User,
    }));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [newDept] = await db.insert(departments).values(dept).returning();
    return newDept;
  }

  async getDepartmentsByOrganization(organizationId: number): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.organizationId, organizationId)).orderBy(departments.name);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async updateDepartment(id: number, name: string): Promise<Department> {
    const [updated] = await db.update(departments).set({ name }).where(eq(departments.id, id)).returning();
    return updated;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.update(users).set({ departmentId: null }).where(eq(users.departmentId, id));
    await db.delete(departments).where(eq(departments.id, id));
  }

  async updateUserDepartment(userId: number, departmentId: number | null): Promise<User> {
    const [updated] = await db.update(users).set({ departmentId }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async updateUserManager(userId: number, managerId: number | null): Promise<User> {
    const [updated] = await db.update(users).set({ managerId }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async setTutorialCompleted(userId: number, completed: boolean): Promise<User> {
    const [updated] = await db.update(users).set({ tutorialCompleted: completed }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async updateOrganizationRoleLabels(id: number, adminLabel: string, employeeLabel: string): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ adminRoleLabel: adminLabel, employeeRoleLabel: employeeLabel }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async getPageContent(): Promise<Record<string, string>> {
    const rows = await db.select().from(pageContent);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async setPageContent(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await db.insert(pageContent)
        .values({ key, value })
        .onConflictDoUpdate({ target: pageContent.key, set: { value, updatedAt: new Date() } });
    }
  }

  async deleteOrganization(id: number): Promise<void> {
    const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, id));
    const userIds = orgUsers.map(u => u.id);
    if (userIds.length > 0) {
      await db.delete(transactions).where(inArray(transactions.userId, userIds));
      await db.delete(orders).where(inArray(orders.userId, userIds));
      await db.delete(users).where(eq(users.organizationId, id));
    }
    await db.delete(storeItems).where(eq(storeItems.organizationId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async createStoreItem(item: InsertStoreItem): Promise<StoreItem> {
    const [newItem] = await db.insert(storeItems).values(item).returning();
    return newItem;
  }

  async getStoreItemsByOrganization(organizationId: number): Promise<StoreItem[]> {
    return await db.select().from(storeItems).where(eq(storeItems.organizationId, organizationId)).orderBy(desc(storeItems.createdAt));
  }

  async getStoreItem(id: number): Promise<StoreItem | undefined> {
    const [item] = await db.select().from(storeItems).where(eq(storeItems.id, id));
    return item;
  }

  async updateStoreItem(id: number, data: Partial<InsertStoreItem>): Promise<StoreItem> {
    const [updated] = await db.update(storeItems).set(data).where(eq(storeItems.id, id)).returning();
    return updated;
  }

  async deleteStoreItem(id: number): Promise<void> {
    await db.delete(storeItems).where(eq(storeItems.id, id));
  }

  async updateOrganizationFeatureFlags(id: number, storeEnabled: boolean, manualOrdersEnabled: boolean, allowEmployeePasswordCreation: boolean, ordersEnabled: boolean): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ storeEnabled, manualOrdersEnabled, allowEmployeePasswordCreation, ordersEnabled }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async updateOrganizationBudgetSettings(id: number, bucksPerDollar: number, monthlyBudgetBucks: number, budgetSetByName?: string): Promise<Organization> {
    const setFields: any = { bucksPerDollar, monthlyBudgetBucks };
    if (budgetSetByName !== undefined) setFields.budgetSetByName = budgetSetByName;
    const [updated] = await db.update(organizations).set(setFields).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async setOrganizationReportRecipients(orgId: number, userIds: number[] | null): Promise<Organization> {
    const val = userIds === null ? null : JSON.stringify(userIds);
    const [updated] = await db.update(organizations).set({ reportRecipientIds: val }).where(eq(organizations.id, orgId)).returning();
    return updated;
  }

  async setOrganizationDefaultPin(orgId: number, hashedPin: string | null, plainPin?: string | null): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ defaultPin: hashedPin, defaultPinPlain: plainPin ?? null }).where(eq(organizations.id, orgId)).returning();
    return updated;
  }

  async addToWishlist(userId: number, storeItemId: number): Promise<Wishlist> {
    const [existing] = await db.select().from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.storeItemId, storeItemId))).limit(1);
    if (existing) return existing;
    const [entry] = await db.insert(wishlists).values({ userId, storeItemId }).returning();
    return entry;
  }

  async removeFromWishlist(userId: number, storeItemId: number): Promise<void> {
    await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.storeItemId, storeItemId)));
  }

  async getWishlistByUser(userId: number): Promise<(Wishlist & { storeItem: StoreItem })[]> {
    const rows = await db
      .select({ wishlist: wishlists, storeItem: storeItems })
      .from(wishlists)
      .innerJoin(storeItems, eq(wishlists.storeItemId, storeItems.id))
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.createdAt));
    return rows.map(r => ({ ...r.wishlist, storeItem: r.storeItem }));
  }

  async getWishlistsByOrganization(organizationId: number): Promise<(Wishlist & { storeItem: StoreItem; user: User })[]> {
    const rows = await db
      .select({ wishlist: wishlists, storeItem: storeItems, user: users })
      .from(wishlists)
      .innerJoin(storeItems, eq(wishlists.storeItemId, storeItems.id))
      .innerJoin(users, eq(wishlists.userId, users.id))
      .where(eq(users.organizationId, organizationId))
      .orderBy(desc(wishlists.createdAt));
    return rows.map(r => ({ ...r.wishlist, storeItem: r.storeItem, user: r.user }));
  }

  async acceptTerms(userId: number, marketingOptIn: boolean): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ termsAcceptedAt: new Date(), marketingOptIn })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async incrementSuccessfulLoginCount(userId: number): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ successfulLoginCount: sql`COALESCE(${users.successfulLoginCount}, 0) + 1` })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error("User not found");
    return updated;
  }

  async dismissTwoFaPrompt(userId: number): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ twoFaPromptDismissed: true })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserContactInfo(userId: number, email: string | null, phone: string | null): Promise<User> {
    const setFields: Partial<{ email: string | null; phone: string | null; twoFaPromptDismissed: boolean }> = {
      twoFaPromptDismissed: true,
    };
    if (email !== undefined) setFields.email = email;
    if (phone !== undefined) setFields.phone = phone;
    const [updated] = await db
      .update(users)
      .set(setFields)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [created] = await db.insert(blogPosts).values(post).returning();
    return created;
  }

  async updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [updated] = await db.update(blogPosts).set(data).where(eq(blogPosts.id, id)).returning();
    if (!updated) throw new Error("Blog post not found");
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getAllReferralCodes(): Promise<ReferralCode[]> {
    return db.select().from(referralCodes).orderBy(desc(referralCodes.createdAt));
  }

  async getReferralCode(code: string): Promise<ReferralCode | undefined> {
    const [row] = await db.select().from(referralCodes).where(eq(referralCodes.code, code.toUpperCase()));
    return row;
  }

  async createReferralCode(data: InsertReferralCode): Promise<ReferralCode> {
    const [created] = await db.insert(referralCodes).values({ ...data, code: data.code.toUpperCase() }).returning();
    return created;
  }

  async updateReferralCode(id: number, data: Partial<InsertReferralCode>): Promise<ReferralCode> {
    const [updated] = await db.update(referralCodes).set(data).where(eq(referralCodes.id, id)).returning();
    if (!updated) throw new Error("Referral code not found");
    return updated;
  }

  async deleteReferralCode(id: number): Promise<void> {
    await db.delete(referralCodes).where(eq(referralCodes.id, id));
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [created] = await db.insert(goals).values(goal).returning();
    return created;
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal;
  }

  async getGoalsByOrganization(organizationId: number): Promise<Goal[]> {
    return db.select().from(goals).where(eq(goals.organizationId, organizationId)).orderBy(desc(goals.createdAt));
  }

  async updateGoal(id: number, data: Partial<InsertGoal>): Promise<Goal> {
    const [updated] = await db.update(goals).set(data).where(eq(goals.id, id)).returning();
    if (!updated) throw new Error("Goal not found");
    return updated;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goalNotifications).where(eq(goalNotifications.goalId, id));
    await db.delete(goals).where(eq(goals.id, id));
  }

  async incrementGoalQuantity(id: number, amount: number): Promise<Goal> {
    const goal = await this.getGoal(id);
    if (!goal) throw new Error("Goal not found");
    const newQty = goal.currentQuantity + amount;
    const isComplete = goal.targetQuantity !== null && newQty >= goal.targetQuantity;
    const [updated] = await db.update(goals).set({
      currentQuantity: newQty,
      ...(isComplete ? { status: "pending_distribution", completedAt: new Date() } : {}),
    }).where(eq(goals.id, id)).returning();
    return updated;
  }

  async failGoal(id: number): Promise<Goal> {
    const [updated] = await db.update(goals).set({
      status: "failed",
      failedAt: new Date(),
    }).where(eq(goals.id, id)).returning();
    if (!updated) throw new Error("Goal not found");
    return updated;
  }

  async completeGoal(id: number): Promise<Goal> {
    const [updated] = await db.update(goals).set({
      status: "pending_distribution",
      completedAt: new Date(),
    }).where(eq(goals.id, id)).returning();
    if (!updated) throw new Error("Goal not found");
    return updated;
  }

  async distributeGoalBucks(goalId: number, organizationId: number, performedBy: number): Promise<Goal> {
    const goal = await this.getGoal(goalId);
    if (!goal) throw new Error("Goal not found");
    const employees = await db.select({ id: users.id }).from(users).where(
      and(eq(users.organizationId, organizationId), eq(users.role, "employee"), eq(users.status, "approved"))
    );
    if (employees.length > 0) {
      const empIds = employees.map(e => e.id);
      await db.update(users)
        .set({ balance: sql`${users.balance} + ${goal.bucksReward}` })
        .where(inArray(users.id, empIds));
      await db.insert(transactions).values(
        empIds.map(uid => ({
          userId: uid,
          amount: goal.bucksReward,
          reason: `Goal achieved: ${goal.title}`,
          performedBy,
        }))
      );
    }
    const [updated] = await db.update(goals).set({
      status: "completed",
      bucksDistributedAt: new Date(),
    }).where(eq(goals.id, goalId)).returning();
    return updated;
  }

  async createGoalNotificationsForOrg(goalId: number, organizationId: number, type: "failed" | "distributed"): Promise<void> {
    const orgUsers = await db.select().from(users).where(eq(users.organizationId, organizationId));
    if (orgUsers.length === 0) return;
    await db.insert(goalNotifications).values(
      orgUsers.map(u => ({ goalId, organizationId, userId: u.id, type }))
    );
  }

  async getUnseenGoalNotifications(userId: number): Promise<(GoalNotification & { goal: Goal })[]> {
    const rows = await db.select().from(goalNotifications)
      .innerJoin(goals, eq(goalNotifications.goalId, goals.id))
      .where(and(eq(goalNotifications.userId, userId), isNull(goalNotifications.seenAt)))
      .orderBy(desc(goalNotifications.createdAt));
    return rows.map(r => ({ ...r.goal_notifications, goal: r.goals }));
  }

  async markGoalNotificationsSeen(userId: number): Promise<void> {
    await db.update(goalNotifications).set({ seenAt: new Date() })
      .where(and(eq(goalNotifications.userId, userId), isNull(goalNotifications.seenAt)));
  }

  async getPasskeysByUser(userId: number): Promise<Passkey[]> {
    return db.select().from(passkeys).where(eq(passkeys.userId, userId)).orderBy(desc(passkeys.createdAt));
  }

  async getPasskeyByCredentialId(credentialId: string): Promise<Passkey | undefined> {
    const [row] = await db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId));
    return row;
  }

  async createPasskey(data: InsertPasskey): Promise<Passkey> {
    const [row] = await db.insert(passkeys).values(data).returning();
    return row;
  }

  async updatePasskeyCounter(id: number, counter: number): Promise<void> {
    await db.update(passkeys).set({ counter }).where(eq(passkeys.id, id));
  }

  async renamePasskey(id: number, name: string): Promise<void> {
    await db.update(passkeys).set({ name }).where(eq(passkeys.id, id));
  }

  async deletePasskey(id: number): Promise<void> {
    await db.delete(passkeys).where(eq(passkeys.id, id));
  }

  async createSurvey(data: InsertSurvey, questions: Omit<InsertSurveyQuestion, "surveyId">[]): Promise<Survey & { questions: SurveyQuestion[] }> {
    const [survey] = await db.insert(surveys).values(data).returning();
    const qs = questions.length > 0
      ? await db.insert(surveyQuestions).values(questions.map((q, i) => ({ ...q, surveyId: survey.id, orderIndex: i }))).returning()
      : [];
    return { ...survey, questions: qs };
  }

  async getSurveysByOrganization(organizationId: number): Promise<(Survey & { questions: SurveyQuestion[]; responseCount: number })[]> {
    const rows = await db.select().from(surveys).where(eq(surveys.organizationId, organizationId)).orderBy(desc(surveys.createdAt));
    if (rows.length === 0) return [];
    const ids = rows.map(s => s.id);
    const qs = await db.select().from(surveyQuestions).where(sql`${surveyQuestions.surveyId} = ANY(${ids})`).orderBy(surveyQuestions.orderIndex);
    const counts = await db.select({ surveyId: surveyResponses.surveyId, count: sql<number>`COUNT(*)` }).from(surveyResponses).where(sql`${surveyResponses.surveyId} = ANY(${ids})`).groupBy(surveyResponses.surveyId);
    const qMap: Record<number, SurveyQuestion[]> = {};
    for (const q of qs) { (qMap[q.surveyId] = qMap[q.surveyId] || []).push(q); }
    const cMap: Record<number, number> = {};
    for (const c of counts) cMap[c.surveyId] = Number(c.count);
    return rows.map(s => ({ ...s, questions: qMap[s.id] || [], responseCount: cMap[s.id] || 0 }));
  }

  async getSurvey(id: number): Promise<(Survey & { questions: SurveyQuestion[] }) | undefined> {
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, id));
    if (!survey) return undefined;
    const qs = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, id)).orderBy(surveyQuestions.orderIndex);
    return { ...survey, questions: qs };
  }

  async updateSurveyStatus(id: number, status: "draft" | "active" | "closed"): Promise<Survey> {
    const [row] = await db.update(surveys).set({ status }).where(eq(surveys.id, id)).returning();
    return row;
  }

  async deleteSurvey(id: number): Promise<void> {
    await db.delete(surveys).where(eq(surveys.id, id));
  }

  async hasUserRespondedToSurvey(surveyId: number, userId: number): Promise<boolean> {
    const [row] = await db.select({ id: surveyResponses.id }).from(surveyResponses).where(and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.userId, userId)));
    return !!row;
  }

  async submitSurveyResponse(surveyId: number, userId: number, answers: { questionId: number; answerText?: string; selectedOption?: number }[]): Promise<void> {
    const [response] = await db.insert(surveyResponses).values({ surveyId, userId }).returning();
    if (answers.length > 0) {
      await db.insert(surveyAnswers).values(answers.map(a => ({ responseId: response.id, questionId: a.questionId, answerText: a.answerText ?? null, selectedOption: a.selectedOption ?? null })));
    }
  }

  async getSurveyResults(surveyId: number): Promise<{ question: SurveyQuestion; answers: SurveyAnswer[]; respondents: number }[]> {
    const qs = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, surveyId)).orderBy(surveyQuestions.orderIndex);
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId));
    const responseIds = (await db.select({ id: surveyResponses.id }).from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId))).map(r => r.id);
    const answers = responseIds.length > 0
      ? await db.select().from(surveyAnswers).where(sql`${surveyAnswers.responseId} = ANY(${responseIds})`)
      : [];
    const aByQ: Record<number, SurveyAnswer[]> = {};
    for (const a of answers) { (aByQ[a.questionId] = aByQ[a.questionId] || []).push(a); }
    return qs.map(q => ({ question: q, answers: aByQ[q.id] || [], respondents: Number(count) }));
  }

  async getSurveyRespondents(surveyId: number): Promise<{ user: Pick<User, "id" | "fullName">; submittedAt: Date }[]> {
    const rows = await db.select({ userId: surveyResponses.userId, submittedAt: surveyResponses.submittedAt }).from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId)).orderBy(desc(surveyResponses.submittedAt));
    const userIds = rows.map(r => r.userId);
    if (userIds.length === 0) return [];
    const us = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(sql`${users.id} = ANY(${userIds})`);
    const uMap: Record<number, string> = {};
    for (const u of us) uMap[u.id] = u.fullName;
    return rows.map(r => ({ user: { id: r.userId, fullName: uMap[r.userId] ?? "Unknown" }, submittedAt: r.submittedAt }));
  }

  async createInvitation(data: InsertInvitation): Promise<Invitation> {
    const [inv] = await db.insert(invitations).values(data).returning();
    return inv;
  }

  async getInvitationsByOrganization(orgId: number): Promise<Invitation[]> {
    return db.select().from(invitations)
      .where(and(eq(invitations.organizationId, orgId), isNull(invitations.acceptedAt)))
      .orderBy(desc(invitations.createdAt));
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
    return inv;
  }

  async acceptInvitation(id: number): Promise<Invitation> {
    const [inv] = await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, id)).returning();
    return inv;
  }

  async revokeInvitation(id: number): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, id));
  }

  async getCategoriesByOrg(orgId: number): Promise<TransactionCategory[]> {
    return db.select().from(transactionCategories).where(eq(transactionCategories.orgId, orgId)).orderBy(transactionCategories.name);
  }

  async createCategory(data: InsertTransactionCategory): Promise<TransactionCategory> {
    const [cat] = await db.insert(transactionCategories).values(data).returning();
    return cat;
  }

  async deleteCategory(id: number, orgId: number): Promise<void> {
    await db.delete(transactionCategories).where(and(eq(transactionCategories.id, id), eq(transactionCategories.orgId, orgId)));
  }

  async updateCategory(id: number, orgId: number, data: { name?: string; color?: string }): Promise<TransactionCategory> {
    const [cat] = await db.update(transactionCategories).set(data).where(and(eq(transactionCategories.id, id), eq(transactionCategories.orgId, orgId))).returning();
    return cat;
  }

  async getCategoryStats(orgId: number, from: Date, to: Date, performedBy?: number): Promise<{ categoryId: number | null; categoryName: string | null; categoryColor: string | null; totalBucks: number }[]> {
    const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.organizationId, orgId));

    const conditions = [
      inArray(transactions.userId, orgUserIds),
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to),
      sql`${transactions.amount} > 0`,
    ];
    if (performedBy !== undefined) {
      conditions.push(eq(transactions.performedBy, performedBy));
    }

    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: transactionCategories.name,
        categoryColor: transactionCategories.color,
        totalBucks: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END), 0)::int`,
      })
      .from(transactions)
      .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
      .where(and(...conditions))
      .groupBy(transactions.categoryId, transactionCategories.name, transactionCategories.color);

    return rows.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
      totalBucks: Number(r.totalBucks),
    }));
  }

  async getMonthlyBudgetUsed(orgId: number, year: number, month: number): Promise<number> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.organizationId, orgId));

    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int` })
      .from(transactions)
      .where(and(
        inArray(transactions.userId, orgUserIds),
        gte(transactions.createdAt, from),
        lte(transactions.createdAt, to),
        sql`${transactions.amount} > 0`,
        sql`${transactions.performedBy} IS NOT NULL`
      ));
    return Number(row?.total ?? 0);
  }

  async createMonthlyReport(data: InsertMonthlyReport): Promise<MonthlyReport> {
    const existing = await this.getMonthlyReport(data.orgId, data.year, data.month);
    if (existing) {
      const [updated] = await db.update(monthlyReports).set({ reportData: data.reportData, generatedAt: new Date() }).where(eq(monthlyReports.id, existing.id)).returning();
      return updated;
    }
    const [report] = await db.insert(monthlyReports).values(data).returning();
    return report;
  }

  async getMonthlyReportsByOrg(orgId: number): Promise<MonthlyReport[]> {
    return db.select().from(monthlyReports).where(eq(monthlyReports.orgId, orgId)).orderBy(desc(monthlyReports.year), desc(monthlyReports.month));
  }

  async getMonthlyReport(orgId: number, year: number, month: number): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports).where(and(eq(monthlyReports.orgId, orgId), eq(monthlyReports.year, year), eq(monthlyReports.month, month)));
    return report;
  }

  async createEnterpriseAccount(data: any): Promise<EnterpriseAccount> {
    const [account] = await db.insert(enterpriseAccounts).values(data).returning();
    return account;
  }

  async getAllEnterpriseAccounts(): Promise<EnterpriseAccount[]> {
    return db.select().from(enterpriseAccounts).orderBy(desc(enterpriseAccounts.createdAt));
  }

  async getEnterpriseAccount(id: number): Promise<EnterpriseAccount | undefined> {
    const [account] = await db.select().from(enterpriseAccounts).where(eq(enterpriseAccounts.id, id));
    return account;
  }

  async updateEnterpriseAccount(id: number, data: Partial<EnterpriseAccount>): Promise<EnterpriseAccount> {
    const [updated] = await db.update(enterpriseAccounts).set(data).where(eq(enterpriseAccounts.id, id)).returning();
    return updated;
  }

  async deleteEnterpriseAccount(id: number): Promise<void> {
    await db.delete(enterpriseAccounts).where(eq(enterpriseAccounts.id, id));
  }
}

export const storage = new DatabaseStorage();
