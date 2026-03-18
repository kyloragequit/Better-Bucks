import { db } from "./db";
import { organizations, departments, users, goals, storeItems, orders, transactions, surveys, surveyQuestions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

const DEMO_CODE = "VIEWDEMO";
const DEMO_PASSWORD = "Demo2024!";

const INV_NAMES = [
  "Jordan Brooks", "Casey Nguyen", "Riley Torres", "Quinn Park", "Avery Williams",
];

const OPS_NAMES = [
  "Alex Rivera", "Bailey Cooper", "Charlie Reed", "Drew Price", "Elliot Ward",
];

export async function seedDemoOrg() {
  try {
    await _seedDemoOrg();
  } catch (err) {
    console.error("[seedDemo] Failed to seed demo org (non-fatal):", err);
  }
}

async function _seedDemoOrg() {
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
      termsAcceptedAt: new Date(),
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
      termsAcceptedAt: new Date(),
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
      termsAcceptedAt: new Date(),
      status: "approved",
      balance: 0,
    },
  ]);

  // 5. Employees — 5 Inventory, 5 Operations
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
      termsAcceptedAt: new Date(),
      status: "approved" as const,
      balance: [450, 150, 600, 350, 750][i],
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
      termsAcceptedAt: new Date(),
      status: "approved" as const,
      balance: [300, 500, 200, 650, 425][i],
    })),
  ];
  const createdEmps = await db.insert(users).values(empValues).returning();

  // 6. Goals
  const now = new Date();
  await db.insert(goals).values([
    {
      organizationId: org.id,
      title: "Complete all safety checks",
      type: "quantity",
      status: "active",
      bucksReward: 500,
      targetQuantity: 100,
      currentQuantity: 0,
      startDate: now,
      createdBy: primeAdmin.id,
    },
    {
      organizationId: org.id,
      title: "Restock 100 items before closing",
      type: "quantity",
      status: "active",
      bucksReward: 750,
      targetQuantity: 100,
      currentQuantity: 37,
      startDate: now,
      createdBy: primeAdmin.id,
    },
    {
      organizationId: org.id,
      title: "Achieve 500 Shipments This Month",
      type: "quantity",
      status: "active",
      bucksReward: 300,
      targetQuantity: 500,
      currentQuantity: 312,
      startDate: now,
      createdBy: primeAdmin.id,
    },
    {
      organizationId: org.id,
      title: "Zero Late Orders – 30 Days",
      type: "quantity",
      status: "active",
      bucksReward: 400,
      targetQuantity: 30,
      currentQuantity: 14,
      startDate: now,
      createdBy: primeAdmin.id,
    },
  ]);

  // 7. Store items
  await db.insert(storeItems).values([
    {
      organizationId: org.id,
      name: "Company Logo T-Shirt",
      price: 250,
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
    },
    {
      organizationId: org.id,
      name: "Premium Insulated Tumbler",
      price: 400,
      imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400",
    },
    {
      organizationId: org.id,
      name: "$25 Amazon Gift Card",
      price: 600,
      url: "https://www.amazon.com/",
      imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400",
    },
    {
      organizationId: org.id,
      name: "Chipotle Gift Card – $15",
      price: 150,
      url: "https://www.chipotle.com/",
      imageUrl: "https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400",
    },
    {
      organizationId: org.id,
      name: "Starbucks Gift Card – $20",
      price: 200,
      url: "https://www.starbucks.com/",
      imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
    },
    {
      organizationId: org.id,
      name: "Nike Gift Card – $50",
      price: 500,
      url: "https://www.nike.com/",
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    },
    {
      organizationId: org.id,
      name: "Wireless Bluetooth Earbuds",
      price: 350,
      url: "https://www.amazon.com/",
      imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400",
    },
    {
      organizationId: org.id,
      name: "Walmart Gift Card – $50",
      price: 500,
      url: "https://www.walmart.com/",
      imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400",
    },
    {
      organizationId: org.id,
      name: "Apple AirPods (3rd Gen)",
      price: 900,
      url: "https://www.apple.com/airpods/",
      imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400",
    },
  ]);

  // 8. Orders + transactions (using the 10 employees)
  const emp = createdEmps;
  type OrderStatus = "pending" | "approved" | "completed";
  const orderData: Array<{
    userId: number; pointsCost: number; description: string;
    status: OrderStatus; convertedValue: string; adminNotes: string | null;
    daysAgo: number;
  }> = [
    { userId: emp[0].id, pointsCost: 150, description: "Wireless Bluetooth Headphones", status: "pending", convertedValue: "$75.00 on Amazon", adminNotes: null, daysAgo: 2 },
    { userId: emp[2].id, pointsCost: 100, description: "Amazon Gift Card $50", status: "pending", convertedValue: "$50.00 on Amazon", adminNotes: null, daysAgo: 1 },
    { userId: emp[4].id, pointsCost: 200, description: "Nike Running Shoes – Size 10", status: "pending", convertedValue: "$100.00 on Amazon", adminNotes: null, daysAgo: 0 },
    { userId: emp[6].id, pointsCost: 100, description: "Starbucks Gift Card $50", status: "pending", convertedValue: "$50.00 in store", adminNotes: null, daysAgo: 0 },
    { userId: emp[1].id, pointsCost: 100, description: "Apple AirPods Gen 3", status: "approved", convertedValue: "$50.00 on Amazon", adminNotes: "Approved – ordering this week", daysAgo: 6 },
    { userId: emp[7].id, pointsCost: 250, description: "Yeti Rambler 30 oz Tumbler", status: "approved", convertedValue: "$125.00 on Amazon", adminNotes: "In cart – will ship by Friday", daysAgo: 4 },
    { userId: emp[3].id, pointsCost: 200, description: "Amazon Gift Card $100", status: "completed", convertedValue: "$100.00 on Amazon", adminNotes: "Sent via email", daysAgo: 14 },
    { userId: emp[9].id, pointsCost: 150, description: "Lululemon Gift Card", status: "completed", convertedValue: "$75.00 in store", adminNotes: "Delivered in person", daysAgo: 10 },
    { userId: emp[5].id, pointsCost: 350, description: "iPad Mini – 64GB", status: "completed", convertedValue: "$175.00 on Amazon", adminNotes: "Shipped via UPS", daysAgo: 20 },
    { userId: emp[8].id, pointsCost: 100, description: "Movie Night Bundle – Streaming Gift Card", status: "completed", convertedValue: "$50.00 on Amazon", adminNotes: "Handed off by shift manager", daysAgo: 8 },
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
    await db.insert(transactions).values({
      userId: o.userId,
      amount: -o.pointsCost,
      reason: `Store order: ${o.description}`,
      performedBy: primeAdmin.id,
      createdAt: ts,
    });
  }

  // 9. Credit transactions so employees have history
  const creditRecords = [
    { idx: 0, amount: 500, reason: "Perfect attendance – March" },
    { idx: 1, amount: 350, reason: "Safety compliance bonus" },
    { idx: 5, amount: 500, reason: "Process improvement award" },
    { idx: 6, amount: 350, reason: "On-time delivery streak" },
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

  // 10. Demo survey
  const [demoSurvey] = await db.insert(surveys).values({
    organizationId: org.id,
    createdBy: primeAdmin.id,
    title: "Team Feedback – Q1 2026",
    description: "Help us improve our workplace! Your responses are anonymous.",
    status: "active",
  }).returning();
  await db.insert(surveyQuestions).values([
    { surveyId: demoSurvey.id, orderIndex: 0, questionType: "multiple_choice", questionText: "How would you rate your overall job satisfaction?", options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"] },
    { surveyId: demoSurvey.id, orderIndex: 1, questionType: "multiple_choice", questionText: "How often do you feel recognized for your hard work?", options: ["Always", "Usually", "Sometimes", "Rarely", "Never"] },
    { surveyId: demoSurvey.id, orderIndex: 2, questionType: "written", questionText: "What is one thing we could do to improve your work environment?", options: null },
    { surveyId: demoSurvey.id, orderIndex: 3, questionType: "multiple_choice", questionText: "How well does your team communicate and collaborate?", options: ["Excellent", "Good", "Fair", "Poor"] },
    { surveyId: demoSurvey.id, orderIndex: 4, questionType: "written", questionText: "Any other feedback or suggestions for leadership?", options: null },
  ]);

  console.log(`[seedDemo] Done — seeded VIEWDEMO org (id=${org.id}) with ${empValues.length} employees, 2 goals, 3 store items, 10 orders, 1 survey.`);
}
