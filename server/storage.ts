
import { db } from "./db";
import { users, transactions, orders, organizations, shopWebsites, documents, departments, pageContent, storeItems, wishlists, blogPosts, goals, goalNotifications, referralCodes, passkeys, type User, type InsertUser, type Transaction, type InsertTransaction, type Order, type InsertOrder, type Organization, type InsertOrganization, type ShopWebsite, type InsertShopWebsite, type Document, type InsertDocument, type Department, type InsertDepartment, type StoreItem, type InsertStoreItem, type Wishlist, type BlogPost, type InsertBlogPost, type Goal, type InsertGoal, type GoalNotification, type ReferralCode, type InsertReferralCode, type Passkey, type InsertPasskey } from "@shared/schema";
import { eq, desc, and, ne, ilike, or, gte, lte, isNull, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, amount: number): Promise<User>;
  updateUserRole(userId: number, role: "admin" | "employee"): Promise<User>;
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
  getOrganizationByStripeCustomerId(customerId: string): Promise<Organization | undefined>;
  updateOrganizationStripe(id: number, stripeCustomerId: string, stripeSubscriptionId: string): Promise<Organization>;
  updateOrganizationStatus(id: number, status: "active" | "inactive" | "pending" | "paused" | "deleted"): Promise<Organization>;
  updateOrganizationStoreUrl(id: number, storeUrl: string): Promise<Organization>;
  updateOrganizationTier(id: number, tier: "small" | "mid" | "large" | "enterprise", maxEmployees: number): Promise<Organization>;
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
  updateOrganizationRoleLabels(id: number, adminLabel: string, employeeLabel: string): Promise<Organization>;

  getPageContent(): Promise<Record<string, string>>;
  setPageContent(entries: Record<string, string>): Promise<void>;

  updateOrganizationFeatureFlags(id: number, storeEnabled: boolean, manualOrdersEnabled: boolean): Promise<Organization>;
  updateOrganizationBudgetSettings(id: number, bucksPerDollar: number, monthlyBudgetBucks: number): Promise<Organization>;

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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserBalance(userId: number, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    const [updatedUser] = await db
      .update(users)
      .set({ balance: user.balance + amount })
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser;
  }

  async updateUserRole(userId: number, role: "admin" | "employee"): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser;
  }

  async updateUserProfile(userId: number, data: { username?: string; password?: string; email?: string | null; departmentId?: number | null }): Promise<User> {
    const { hashPassword } = await import("./auth");
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await hashPassword(data.password);
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
      and(eq(users.username, username), eq(users.organizationId, organizationId))
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
    const [user] = await db.select().from(users).where(eq(users.email, email));
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
    const stored = password.startsWith("$2b$") || password.startsWith("$2a$")
      ? password
      : await hashPassword(password);
    const [updated] = await db.update(users).set({
      password: stored,
      mustChangePassword: false,
      passwordLastChanged: new Date()
    }).where(eq(users.id, userId)).returning();
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
    const orgUsers = await this.getUsersByOrganization(id);
    const userIds = orgUsers.map(u => u.id);
    if (userIds.length > 0) {
      await db.delete(transactions).where(
        eq(transactions.userId, userIds[0])
      );
      for (const uid of userIds) {
        await db.delete(transactions).where(eq(transactions.userId, uid));
        await db.delete(orders).where(eq(orders.userId, uid));
      }
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

  async updateOrganizationFeatureFlags(id: number, storeEnabled: boolean, manualOrdersEnabled: boolean): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ storeEnabled, manualOrdersEnabled }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async updateOrganizationBudgetSettings(id: number, bucksPerDollar: number, monthlyBudgetBucks: number): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ bucksPerDollar, monthlyBudgetBucks }).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async addToWishlist(userId: number, storeItemId: number): Promise<Wishlist> {
    const existing = await db.select().from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.storeItemId, storeItemId)));
    if (existing.length > 0) return existing[0];
    const [entry] = await db.insert(wishlists).values({ userId, storeItemId }).returning();
    return entry;
  }

  async removeFromWishlist(userId: number, storeItemId: number): Promise<void> {
    await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.storeItemId, storeItemId)));
  }

  async getWishlistByUser(userId: number): Promise<(Wishlist & { storeItem: StoreItem })[]> {
    const rows = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).orderBy(desc(wishlists.createdAt));
    const result: (Wishlist & { storeItem: StoreItem })[] = [];
    for (const row of rows) {
      const [item] = await db.select().from(storeItems).where(eq(storeItems.id, row.storeItemId));
      if (item) result.push({ ...row, storeItem: item });
    }
    return result;
  }

  async getWishlistsByOrganization(organizationId: number): Promise<(Wishlist & { storeItem: StoreItem; user: User })[]> {
    const orgUsers = await db.select().from(users).where(eq(users.organizationId, organizationId));
    const userIds = orgUsers.map(u => u.id);
    if (userIds.length === 0) return [];
    const allWishlists = await db.select().from(wishlists).orderBy(desc(wishlists.createdAt));
    const orgWishlists = allWishlists.filter(w => userIds.includes(w.userId));
    const result: (Wishlist & { storeItem: StoreItem; user: User })[] = [];
    for (const row of orgWishlists) {
      const [item] = await db.select().from(storeItems).where(eq(storeItems.id, row.storeItemId));
      const user = orgUsers.find(u => u.id === row.userId);
      if (item && user) result.push({ ...row, storeItem: item, user });
    }
    return result;
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
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    const [updated] = await db
      .update(users)
      .set({ successfulLoginCount: (user.successfulLoginCount ?? 0) + 1 })
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
    const employees = await db.select().from(users).where(
      and(eq(users.organizationId, organizationId), eq(users.role, "employee"), eq(users.status, "approved"))
    );
    for (const emp of employees) {
      await db.update(users).set({ balance: emp.balance + goal.bucksReward }).where(eq(users.id, emp.id));
      await db.insert(transactions).values({
        userId: emp.id,
        amount: goal.bucksReward,
        reason: `Goal achieved: ${goal.title}`,
        performedBy,
      });
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
}

export const storage = new DatabaseStorage();
