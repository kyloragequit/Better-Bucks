
import { db } from "./db";
import { users, transactions, orders, organizations, shopWebsites, documents, departments, type User, type InsertUser, type Transaction, type InsertTransaction, type Order, type InsertOrder, type Organization, type InsertOrganization, type ShopWebsite, type InsertShopWebsite, type Document, type InsertDocument, type Department, type InsertDepartment } from "@shared/schema";
import { eq, desc, and, ne, ilike, or, gte, lte } from "drizzle-orm";

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
  updateOrganizationStatus(id: number, status: "active" | "inactive" | "pending" | "paused"): Promise<Organization>;
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
    const updateData: any = { ...data };
    if (data.password) {
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
    return await db.select().from(users).where(eq(users.organizationId, organizationId)).orderBy(users.fullName);
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

  async updateOrganizationStatus(id: number, status: "active" | "inactive" | "pending" | "paused"): Promise<Organization> {
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
    const [updated] = await db.update(users).set({ 
      password, 
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

  async updateOrganizationRoleLabels(id: number, adminLabel: string, employeeLabel: string): Promise<Organization> {
    const [updated] = await db.update(organizations).set({ adminRoleLabel: adminLabel, employeeRoleLabel: employeeLabel }).where(eq(organizations.id, id)).returning();
    return updated;
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
    await db.delete(organizations).where(eq(organizations.id, id));
  }
}

export const storage = new DatabaseStorage();
