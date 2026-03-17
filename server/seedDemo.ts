import { db } from "./db";
import { organizations, departments, users, goals, storeItems, orders, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

const DEMO_CODE = "VIEWDEMO";
const DEMO_PASSWORD = "Demo2024!";

const INV_NAMES = [
  "Jordan Brooks", "Casey Nguyen", "Riley Torres", "Quinn Park",
  "Avery Williams", "Blake Johnson", "Cameron Davis", "Dakota Martinez",
  "Emery Anderson", "Finley Thompson", "Harper Wilson", "Indigo Garcia",
  "Jamie Lee", "Kennedy Hall", "Logan Evans", "Morgan Scott",
  "Noel Green", "Oakley Adams", "Parker Baker", "Quinn Hughes",
];

const OPS_NAMES = [
  "Alex Rivera", "Bailey Cooper", "Charlie Reed", "Drew Price",
  "Elliot Ward", "Frankie Powell", "Gray Long", "Harper Ross",
  "Ivory Bell", "Jules Watson", "Kieran Cole", "Lane Bennett",
  "Marlowe Cox", "Nash Bryant", "Ocean Fisher", "Piper Sullivan",
  "Quincy Murphy", "Reeve Barnes", "Sloane Henderson", "Tatum Simmons",
];

export async function seedDemoOrg() {
  // Check if already seeded
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.code, DEMO_CODE))
    .limit(1);
  if (existing.length > 0) return;

  console.log("[seedDemo] VIEWDEMO org not found — seeding demo data...");

  const hashedPw = await hashPassword(DEMO_PASSWORD);

  // 1. Organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Better Bucks Demo",
      code: DEMO_CODE,
      tier: "large",
      maxEmployees: 100,
      status: "active",
      isDemo: true,
      storeEnabled: true,
      manualOrdersEnabled: true,
      bucksPerDollar: 2,
      monthlyBudgetBucks: 0,
      adminRoleLabel: "Manager",
      employeeRoleLabel: "Team Member",
      storeUrl: "https://www.amazon.com/",
    })
    .returning();

  // 2. Departments
  const [invDept] = await db
    .insert(departments)
    .values({ name: "Inventory", organizationId: org.id })
    .returning();
  const [opsDept] = await db
    .insert(departments)
    .values({ name: "Operations", organizationId: org.id })
    .returning();

  // 3. Prime admin
  const [primeAdmin] = await db
    .insert(users)
    .values({
      username: "demo_prime",
      password: hashedPw,
      role: "prime_admin",
      fullName: "Demo Prime Admin",
      barcode: "DEMOPRIME",
      organizationId: org.id,
      emailVerified: true,
      tutorialCompleted: false,
      status: "approved",
      balance: 0,
    })
    .returning();

  // 4. Admin users
  await db.insert(users).values([
    {
      username: "demo_inv_mgr",
      password: hashedPw,
      role: "admin",
      fullName: "Inventory Manager",
      barcode: "DEMOINVMGR",
      organizationId: org.id,
      departmentId: invDept.id,
      emailVerified: true,
      status: "approved",
      balance: 0,
    },
    {
      username: "demo_ops_mgr",
      password: hashedPw,
      role: "admin",
      fullName: "Operations Manager",
      barcode: "DEMOOPSMGR",
      organizationId: org.id,
      departmentId: opsDept.id,
      emailVerified: true,
      status: "approved",
      balance: 0,
    },
  ]);

  // 5. Employees — 20 Inventory, 20 Operations
  const empValues = [
    ...INV_NAMES.map((fullName, i) => ({
      username: `demo_inv_${String(i + 1).padStart(2, "0")}`,
      password: hashedPw,
      role: "employee" as const,
      fullName,
      barcode: `INV${String(i + 1).padStart(3, "0")}`,
      organizationId: org.id,
      departmentId: invDept.id,
      emailVerified: true,
      status: "approved" as const,
      balance: [450, 150, 600, 350, 750, 450, 750, 450, 300, 550,
                200, 400, 650, 100, 500, 350, 800, 250, 425, 575][i],
    })),
    ...OPS_NAMES.map((fullName, i) => ({
      username: `demo_ops_${String(i + 1).padStart(2, "0")}`,
      password: hashedPw,
      role: "employee" as const,
      fullName,
      barcode: `OPS${String(i + 1).padStart(3, "0")}`,
      organizationId: org.id,
      departmentId: opsDept.id,
      emailVerified: true,
      status: "approved" as const,
      balance: [300, 500, 200, 650, 425, 775, 125, 350, 600, 275,
                450, 325, 575, 100, 700, 250, 425, 550, 375, 625][i],
    })),
  ];
  const createdEmps = await db.insert(users).values(empValues).returning();

  // 6. Goals
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  await db.insert(goals).values([
    {
      organizationId: org.id,
      title: "Complete Safety Checks",
      type: "time",
      status: "active",
      bucksReward: 50,
      targetHours: 2,
      targetMinutes: 0,
      startDate: now,
      endDate: twoHoursLater,
    },
    {
      organizationId: org.id,
      title: "Restock 100 Items",
      type: "quantity",
      status: "active",
      bucksReward: 75,
      targetQuantity: 100,
      currentQuantity: 42,
      startDate: now,
    },
  ]);

  // 7. Store items
  await db.insert(storeItems).values([
    {
      organizationId: org.id,
      name: "Amazon Gift Card – $25",
      price: 50,
      url: "https://www.amazon.com/dp/B004LLIKVU",
      imageUrl: "https://images-na.ssl-images-amazon.com/images/I/51XBGrJlBtL.jpg",
    },
    {
      organizationId: org.id,
      name: "Wireless Earbuds",
      price: 150,
      url: "https://www.amazon.com/dp/B08HVZLBFN",
      imageUrl: "https://images-na.ssl-images-amazon.com/images/I/61CGHv6kmWL.jpg",
    },
    {
      organizationId: org.id,
      name: "Starbucks Gift Card – $20",
      price: 40,
      url: "https://www.starbucks.com/gift-cards",
      imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/200px-Starbucks_Corporation_Logo_2011.svg.png",
    },
  ]);

  // 8. Orders + transactions using the first several employees
  const emp = createdEmps;
  type OrderStatus = "pending" | "approved" | "completed";
  const orderData: Array<{
    userId: number; pointsCost: number; description: string;
    status: OrderStatus; convertedValue: string; adminNotes: string | null;
    daysAgo: number;
  }> = [
    { userId: emp[0].id, pointsCost: 150, description: "Wireless Bluetooth Headphones – Sony WH-1000XM5", status: "pending", convertedValue: "$75.00 on Amazon", adminNotes: null, daysAgo: 2 },
    { userId: emp[2].id, pointsCost: 100, description: "Amazon Gift Card $50", status: "pending", convertedValue: "$50.00 on Amazon", adminNotes: null, daysAgo: 1 },
    { userId: emp[4].id, pointsCost: 200, description: "Nike Running Shoes – Size 10", status: "pending", convertedValue: "$100.00 on Amazon", adminNotes: null, daysAgo: 0 },
    { userId: emp[6].id, pointsCost: 100, description: "Starbucks Gift Card $50", status: "pending", convertedValue: "$50.00 in store", adminNotes: null, daysAgo: 0 },
    { userId: emp[1].id, pointsCost: 100, description: "Apple AirPods Gen 3", status: "approved", convertedValue: "$50.00 on Amazon", adminNotes: "Approved – ordering this week", daysAgo: 6 },
    { userId: emp[7].id, pointsCost: 250, description: "Yeti Rambler 30 oz Tumbler", status: "approved", convertedValue: "$125.00 on Amazon", adminNotes: "In cart – will ship by Friday", daysAgo: 4 },
    { userId: emp[3].id, pointsCost: 200, description: "Amazon Gift Card $100", status: "completed", convertedValue: "$100.00 on Amazon", adminNotes: "Sent via email", daysAgo: 14 },
    { userId: emp[9].id, pointsCost: 150, description: "Lululemon Gift Card", status: "completed", convertedValue: "$75.00 in store", adminNotes: "Delivered in person", daysAgo: 10 },
    { userId: emp[20].id, pointsCost: 350, description: "iPad Mini – 64GB", status: "completed", convertedValue: "$175.00 on Amazon", adminNotes: "Shipped via UPS", daysAgo: 20 },
    { userId: emp[21].id, pointsCost: 100, description: "Movie Night Bundle – Popcorn + Streaming Gift Card", status: "completed", convertedValue: "$50.00 on Amazon", adminNotes: "Handed off by shift manager", daysAgo: 8 },
  ];

  for (const o of orderData) {
    const ts = new Date(Date.now() - o.daysAgo * 24 * 60 * 60 * 1000);
    await db.insert(orders).values({
      userId: o.userId,
      pointsCost: o.pointsCost,
      description: o.description,
      photoUrls: [],
      status: o.status,
      convertedValue: o.convertedValue,
      adminNotes: o.adminNotes,
      createdAt: ts,
      updatedAt: ts,
    });
    // Debit transaction for the employee
    await db.insert(transactions).values({
      userId: o.userId,
      amount: -o.pointsCost,
      reason: `Store order: ${o.description}`,
      performedBy: primeAdmin.id,
      createdAt: ts,
    });
  }

  // 9. A few credit transactions so employees have history
  const creditRecords = [
    { idx: 0, amount: 500, reason: "Perfect attendance – March" },
    { idx: 1, amount: 300, reason: "Safety compliance bonus" },
    { idx: 2, amount: 750, reason: "Top performer – Q1" },
    { idx: 20, amount: 500, reason: "Process improvement award" },
    { idx: 21, amount: 350, reason: "On-time delivery streak" },
  ];
  for (const c of creditRecords) {
    await db.insert(transactions).values({
      userId: emp[c.idx].id,
      amount: c.amount,
      reason: c.reason,
      performedBy: primeAdmin.id,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });
  }

  console.log(`[seedDemo] Done — seeded VIEWDEMO org (id=${org.id}) with ${empValues.length} employees, 2 goals, 3 store items, 10 orders.`);
}
