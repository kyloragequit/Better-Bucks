
import { db } from "./db";
import { users, transactions, orders, type User, type InsertUser, type Transaction, type InsertTransaction, type Order, type InsertOrder } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, amount: number): Promise<User>;
  updateUserRole(userId: number, role: "admin" | "employee"): Promise<User>;
  approveAdminUser(userId: number): Promise<User>;
  getPendingAdmins(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<(Transaction & { user: User })[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  getAllOrders(): Promise<(Order & { user: User })[]>;
  updateOrderStatus(id: number, status: string, adminNotes?: string): Promise<Order>;
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

  async updateUserProfile(userId: number, data: { username?: string; password?: string }): Promise<User> {
    const updateData: any = { ...data };
    if (data.password) {
      updateData.mustChangePassword = false;
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

  async updateOrderStatus(id: number, status: string, adminNotes?: string): Promise<Order> {
    const updateData: any = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    const [updated] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
