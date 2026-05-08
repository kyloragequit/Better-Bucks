import { db } from "./db";
import { organizations, departments, users, goals, storeItems, orders, transactions, surveys, surveyQuestions, surveyResponses, surveyAnswers, goalNotifications, wishlists, transactionCategories, monthlyReports, customItemTransactions, shopWebsites, documents, invitations } from "@shared/schema";
import { eq, inArray, like } from "drizzle-orm";
import { hashPassword } from "./auth";
import type { User } from "@shared/schema";

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
    {
      organizationId: org.id,
      name: "Company Hoodie",
      price: 300,
      url: "",
      imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
      requiresSize: true,
      requiresColor: true,
    },
    {
      organizationId: org.id,
      name: "Running Shoes – Nike",
      price: 500,
      url: "https://www.nike.com/",
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
      requiresSize: true,
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

  console.log(`[seedDemo] Done — seeded VIEWDEMO org (id=${org.id}) with ${empValues.length} employees, 2 goals, 11 store items, 10 orders, 1 survey.`);
}

// ── Per-session isolated demo org ────────────────────────────────────────────

/**
 * Creates a fresh isolated demo org for a single public demo session.
 * Each visitor gets their own copy of the demo data so changes are
 * fully isolated between concurrent sessions.
 * Returns the org id and the prime admin user to log in as.
 */
export async function createSessionDemoOrg(): Promise<{ orgId: number; primeAdmin: User }> {
  const code = `TMPDEMO_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const hashedPw = await hashPassword(DEMO_PASSWORD);

  const BUDGET = 10000;

  const [org] = await db.insert(organizations).values({
    name: "Better Bucks Demo",
    code,
    tier: "large",
    maxEmployees: 100,
    status: "active",
    isDemo: true,
    storeEnabled: true,
    manualOrdersEnabled: true,
    bucksPerDollar: 2,
    monthlyBudgetBucks: BUDGET,
    adminRoleLabel: "Manager",
    employeeRoleLabel: "Team Member",
    storeUrl: "https://www.amazon.com/",
  }).returning();

  const [invDept] = await db.insert(departments).values({ name: "Inventory", organizationId: org.id }).returning();
  const [opsDept] = await db.insert(departments).values({ name: "Operations", organizationId: org.id }).returning();

  const [primeAdmin] = await db.insert(users).values({
    username: `${code}_prime`,
    password: hashedPw,
    role: "prime_admin",
    fullName: "Demo Prime Admin",
    barcode: `${code}_PRIME`,
    organizationId: org.id,
    emailVerified: true,
    tutorialCompleted: false,
    twoFaPromptDismissed: true,
    termsAcceptedAt: new Date(),
    status: "approved",
    balance: 0,
  }).returning();

  const createdAdmins = await db.insert(users).values([
    { username: `${code}_inv_mgr`, password: hashedPw, role: "admin" as const, fullName: "Inventory Manager", barcode: `${code}_INVMGR`, organizationId: org.id, departmentId: invDept.id, emailVerified: true, twoFaPromptDismissed: true, termsAcceptedAt: new Date(), status: "approved" as const, balance: 4000 },
    { username: `${code}_ops_mgr`, password: hashedPw, role: "admin" as const, fullName: "Operations Manager", barcode: `${code}_OPSMGR`, organizationId: org.id, departmentId: opsDept.id, emailVerified: true, twoFaPromptDismissed: true, termsAcceptedAt: new Date(), status: "approved" as const, balance: 3500 },
  ]).returning();

  const invMgr = createdAdmins[0];
  const opsMgr = createdAdmins[1];

  const categories = await db.insert(transactionCategories).values([
    { orgId: org.id, name: "Safety & Compliance", color: "#22c55e" },
    { orgId: org.id, name: "Performance", color: "#3b82f6" },
    { orgId: org.id, name: "Team Spirit", color: "#f59e0b" },
  ]).returning();
  const catSafety = categories[0].id;
  const catPerf = categories[1].id;
  const catSpirit = categories[2].id;

  const empBalances = [700, 600, 650, 650, 950, 650, 800, 1000, 800, 800];
  const empValues = [
    ...INV_NAMES.map((fullName, i) => ({ username: `${code}_inv_${String(i+1).padStart(2,"0")}`, password: hashedPw, role: "employee" as const, fullName, barcode: `${code}_INV${i+1}`, organizationId: org.id, departmentId: invDept.id, managerId: invMgr.id, emailVerified: true, termsAcceptedAt: new Date(), status: "approved" as const, balance: empBalances[i] })),
    ...OPS_NAMES.map((fullName, i) => ({ username: `${code}_ops_${String(i+1).padStart(2,"0")}`, password: hashedPw, role: "employee" as const, fullName, barcode: `${code}_OPS${i+1}`, organizationId: org.id, departmentId: opsDept.id, managerId: opsMgr.id, emailVerified: true, termsAcceptedAt: new Date(), status: "approved" as const, balance: empBalances[5 + i] })),
  ];
  const createdEmps = await db.insert(users).values(empValues).returning();
  const emp = createdEmps;

  const loggedInUserIds = [
    primeAdmin.id, invMgr.id, opsMgr.id,
    ...emp.slice(0, 8).map(e => e.id),
  ];
  await db.update(users)
    .set({ successfulLoginCount: 3 })
    .where(inArray(users.id, loggedInUserIds));

  const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  type TxRow = { userId: number; amount: number; reason: string; categoryId: number | null; daysAgo: number };
  const txData: TxRow[] = [
    { userId: emp[0].id, amount: 300, reason: "Safety inspection completion bonus", categoryId: catSafety, daysAgo: 85 },
    { userId: emp[1].id, amount: 200, reason: "Forklift certification achievement", categoryId: catSafety, daysAgo: 83 },
    { userId: emp[2].id, amount: 400, reason: "Quarterly review – exceeds expectations", categoryId: catPerf, daysAgo: 80 },
    { userId: emp[3].id, amount: 250, reason: "Warehouse reorganization project", categoryId: catPerf, daysAgo: 78 },
    { userId: emp[4].id, amount: 350, reason: "Perfect attendance – January", categoryId: catPerf, daysAgo: 75 },
    { userId: emp[5].id, amount: 200, reason: "Loading dock safety compliance", categoryId: catSafety, daysAgo: 82 },
    { userId: emp[6].id, amount: 300, reason: "Shipping accuracy streak", categoryId: catPerf, daysAgo: 79 },
    { userId: emp[7].id, amount: 150, reason: "Emergency drill participation", categoryId: catSafety, daysAgo: 76 },
    { userId: emp[8].id, amount: 250, reason: "Route optimization suggestion", categoryId: catPerf, daysAgo: 73 },
    { userId: emp[9].id, amount: 200, reason: "Holiday shift volunteer", categoryId: catSpirit, daysAgo: 88 },
    { userId: emp[0].id, amount: 150, reason: "Team training mentorship", categoryId: catSpirit, daysAgo: 70 },
    { userId: emp[7].id, amount: 200, reason: "Process improvement award", categoryId: catPerf, daysAgo: 65 },
    { userId: emp[9].id, amount: 150, reason: "Peer recognition – helping new hires", categoryId: catSpirit, daysAgo: 62 },
    { userId: emp[0].id, amount: 200, reason: "PPE compliance check – perfect score", categoryId: catSafety, daysAgo: 55 },
    { userId: emp[1].id, amount: 250, reason: "Inventory accuracy improvement", categoryId: catPerf, daysAgo: 53 },
    { userId: emp[2].id, amount: 300, reason: "Team spirit award – potluck organizer", categoryId: catSpirit, daysAgo: 50 },
    { userId: emp[3].id, amount: 200, reason: "Safety suggestion implemented", categoryId: catSafety, daysAgo: 48 },
    { userId: emp[4].id, amount: 300, reason: "Top performer – February", categoryId: catPerf, daysAgo: 45 },
    { userId: emp[5].id, amount: 250, reason: "Cross-training completion", categoryId: catPerf, daysAgo: 52 },
    { userId: emp[6].id, amount: 200, reason: "Customer feedback excellence", categoryId: catPerf, daysAgo: 49 },
    { userId: emp[7].id, amount: 300, reason: "Team building event organizer", categoryId: catSpirit, daysAgo: 46 },
    { userId: emp[8].id, amount: 200, reason: "On-time delivery streak – 30 days", categoryId: catPerf, daysAgo: 43 },
    { userId: emp[9].id, amount: 250, reason: "Mentor of the month", categoryId: catSpirit, daysAgo: 40 },
    { userId: emp[6].id, amount: 150, reason: "Workplace cleanliness champion", categoryId: catSpirit, daysAgo: 35 },
    { userId: emp[8].id, amount: 150, reason: "Safety report documentation", categoryId: catSafety, daysAgo: 33 },
    { userId: emp[0].id, amount: 150, reason: "Hazmat handling refresher", categoryId: catSafety, daysAgo: 25 },
    { userId: emp[1].id, amount: 100, reason: "Team spirit – birthday celebrations", categoryId: catSpirit, daysAgo: 22 },
    { userId: emp[2].id, amount: 200, reason: "Perfect attendance – March", categoryId: catPerf, daysAgo: 20 },
    { userId: emp[3].id, amount: 250, reason: "Warehouse efficiency award", categoryId: catPerf, daysAgo: 18 },
    { userId: emp[4].id, amount: 300, reason: "Safety champion of the month", categoryId: catSafety, daysAgo: 15 },
    { userId: emp[5].id, amount: 200, reason: "Shift coverage appreciation", categoryId: catSpirit, daysAgo: 12 },
    { userId: emp[6].id, amount: 250, reason: "Order fulfillment record", categoryId: catPerf, daysAgo: 10 },
    { userId: emp[7].id, amount: 200, reason: "First aid certification renewal", categoryId: catSafety, daysAgo: 8 },
    { userId: emp[8].id, amount: 300, reason: "Quarter-end push excellence", categoryId: catPerf, daysAgo: 5 },
    { userId: emp[9].id, amount: 200, reason: "Team morale contributor", categoryId: catSpirit, daysAgo: 3 },
    { userId: emp[4].id, amount: 200, reason: "Helping hand award", categoryId: catSpirit, daysAgo: 2 },
    { userId: emp[5].id, amount: 150, reason: "Fire extinguisher training", categoryId: catSafety, daysAgo: 1 },
    { userId: emp[1].id, amount: 150, reason: "Inventory cycle count accuracy", categoryId: catPerf, daysAgo: 15 },
    { userId: emp[3].id, amount: 100, reason: "Safety meeting participation", categoryId: catSafety, daysAgo: 10 },
    { userId: emp[7].id, amount: 150, reason: "Charity drive volunteer", categoryId: catSpirit, daysAgo: 3 },
    { userId: emp[9].id, amount: 150, reason: "Weekend overtime appreciation", categoryId: catPerf, daysAgo: 6 },
  ];

  for (const tx of txData) {
    await db.insert(transactions).values({
      userId: tx.userId,
      amount: tx.amount,
      reason: tx.reason,
      categoryId: tx.categoryId,
      performedBy: primeAdmin.id,
      createdAt: d(tx.daysAgo),
    });
  }

  type OrderStatus = "pending" | "approved" | "completed";
  const orderData: Array<{ userId: number; pointsCost: number; description: string; status: OrderStatus; convertedValue: string; adminNotes: string | null; daysAgo: number }> = [
    { userId: emp[2].id, pointsCost: 100, description: "Amazon Gift Card $50", status: "completed", convertedValue: "$50.00 on Amazon", adminNotes: "Sent via email", daysAgo: 72 },
    { userId: emp[5].id, pointsCost: 150, description: "Nike Gift Card – $50", status: "completed", convertedValue: "$50.00 on Nike", adminNotes: "Delivered in person", daysAgo: 68 },
    { userId: emp[1].id, pointsCost: 100, description: "Starbucks Gift Card – $20", status: "completed", convertedValue: "$20.00 at Starbucks", adminNotes: "Picked up at front desk", daysAgo: 47 },
    { userId: emp[3].id, pointsCost: 150, description: "Wireless Bluetooth Earbuds", status: "completed", convertedValue: "$75.00 on Amazon", adminNotes: "Shipped via UPS", daysAgo: 42 },
    { userId: emp[4].id, pointsCost: 200, description: "Walmart Gift Card – $50", status: "completed", convertedValue: "$50.00 at Walmart", adminNotes: "Handed to employee", daysAgo: 38 },
    { userId: emp[9].id, pointsCost: 150, description: "Premium Insulated Tumbler", status: "completed", convertedValue: "$75.00 on Amazon", adminNotes: "Delivered to locker", daysAgo: 14 },
    { userId: emp[2].id, pointsCost: 150, description: "Company Logo T-Shirt", status: "approved", convertedValue: "$62.50 on Amazon", adminNotes: "Ordering this week", daysAgo: 12 },
    { userId: emp[6].id, pointsCost: 100, description: "$25 Amazon Gift Card", status: "approved", convertedValue: "$25.00 on Amazon", adminNotes: "Processing", daysAgo: 5 },
    { userId: emp[0].id, pointsCost: 100, description: "Chipotle Gift Card – $15", status: "pending", convertedValue: "$15.00 at Chipotle", adminNotes: null, daysAgo: 7 },
    { userId: emp[8].id, pointsCost: 100, description: "Starbucks Gift Card – $20", status: "pending", convertedValue: "$20.00 at Starbucks", adminNotes: null, daysAgo: 4 },
  ];

  for (const o of orderData) {
    const ts = d(o.daysAgo);
    await db.insert(orders).values({ userId: o.userId, pointsCost: o.pointsCost, description: o.description, photoUrls: [], status: o.status, convertedValue: o.convertedValue, adminNotes: o.adminNotes, createdAt: ts, updatedAt: ts });
    await db.insert(transactions).values({ userId: o.userId, amount: -o.pointsCost, reason: `Store order: ${o.description}`, performedBy: primeAdmin.id, createdAt: ts });
  }

  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const allocationDay = new Date(currentMonthStart.getTime() + 2 * 24 * 60 * 60 * 1000);
  await db.insert(transactions).values([
    { userId: invMgr.id, amount: 4000, reason: "Monthly budget allocation from prime admin", performedBy: primeAdmin.id, createdAt: allocationDay },
    { userId: opsMgr.id, amount: 3500, reason: "Monthly budget allocation from prime admin", performedBy: primeAdmin.id, createdAt: allocationDay },
  ]);

  const now = new Date();
  await db.insert(goals).values([
    { organizationId: org.id, title: "Complete all safety checks", type: "quantity", status: "active", bucksReward: 500, targetQuantity: 100, currentQuantity: 0, startDate: now, createdBy: primeAdmin.id },
    { organizationId: org.id, title: "Restock 100 items before closing", type: "quantity", status: "active", bucksReward: 750, targetQuantity: 100, currentQuantity: 37, startDate: now, createdBy: primeAdmin.id },
    { organizationId: org.id, title: "Achieve 500 Shipments This Month", type: "quantity", status: "active", bucksReward: 300, targetQuantity: 500, currentQuantity: 312, startDate: now, createdBy: primeAdmin.id },
    { organizationId: org.id, title: "Zero Late Orders – 30 Days", type: "quantity", status: "active", bucksReward: 400, targetQuantity: 30, currentQuantity: 14, startDate: now, createdBy: primeAdmin.id },
  ]);

  await db.insert(storeItems).values([
    { organizationId: org.id, name: "Company Logo T-Shirt", price: 250, url: "https://www.amazon.com/", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400" },
    { organizationId: org.id, name: "Premium Insulated Tumbler", price: 400, url: "https://www.amazon.com/", imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400" },
    { organizationId: org.id, name: "$25 Amazon Gift Card", price: 600, url: "https://www.amazon.com/", imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400" },
    { organizationId: org.id, name: "Chipotle Gift Card – $15", price: 150, url: "https://www.chipotle.com/", imageUrl: "https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400" },
    { organizationId: org.id, name: "Starbucks Gift Card – $20", price: 200, url: "https://www.starbucks.com/", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400" },
    { organizationId: org.id, name: "Nike Gift Card – $50", price: 500, url: "https://www.nike.com/", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400" },
    { organizationId: org.id, name: "Wireless Bluetooth Earbuds", price: 350, url: "https://www.amazon.com/", imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400" },
    { organizationId: org.id, name: "Walmart Gift Card – $50", price: 500, url: "https://www.walmart.com/", imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400" },
    { organizationId: org.id, name: "Apple AirPods (3rd Gen)", price: 900, url: "https://www.apple.com/airpods/", imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400" },
    { organizationId: org.id, name: "Company Hoodie", price: 300, url: "", imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", requiresSize: true, requiresColor: true },
    { organizationId: org.id, name: "Running Shoes – Nike", price: 500, url: "https://www.nike.com/", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", requiresSize: true },
  ]);

  const [demoSurvey] = await db.insert(surveys).values({
    organizationId: org.id, createdBy: primeAdmin.id, title: "Team Feedback – Q1 2026",
    description: "Help us improve our workplace! Your responses are anonymous.", status: "active",
  }).returning();
  await db.insert(surveyQuestions).values([
    { surveyId: demoSurvey.id, orderIndex: 0, questionType: "multiple_choice", questionText: "How would you rate your overall job satisfaction?", options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"] },
    { surveyId: demoSurvey.id, orderIndex: 1, questionType: "multiple_choice", questionText: "How often do you feel recognized for your hard work?", options: ["Always", "Usually", "Sometimes", "Rarely", "Never"] },
    { surveyId: demoSurvey.id, orderIndex: 2, questionType: "written", questionText: "What is one thing we could do to improve your work environment?", options: null },
    { surveyId: demoSurvey.id, orderIndex: 3, questionType: "multiple_choice", questionText: "How well does your team communicate and collaborate?", options: ["Excellent", "Good", "Fair", "Poor"] },
    { surveyId: demoSurvey.id, orderIndex: 4, questionType: "written", questionText: "Any other feedback or suggestions for leadership?", options: null },
  ]);

  console.log(`[sessionDemo] Created isolated demo org ${code} (id=${org.id})`);
  return { orgId: org.id, primeAdmin: primeAdmin as User };
}

/**
 * Deletes a temporary session demo org and ALL its associated data.
 * Called when a demo user exits (Back to Home / logout / session expiry).
 */
export async function deleteSessionDemoOrg(orgId: number): Promise<void> {
  try {
    // Get all user IDs in this org
    const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, orgId));
    const userIds = orgUsers.map(u => u.id);

    // Get all survey IDs for this org
    const orgSurveys = await db.select({ id: surveys.id }).from(surveys).where(eq(surveys.organizationId, orgId));
    const surveyIds = orgSurveys.map(s => s.id);

    // Delete in dependency order
    if (surveyIds.length > 0) {
      // surveyAnswers depend on surveyResponses; surveyResponses depend on surveys
      const surveyResponseRows = await db.select({ id: surveyResponses.id }).from(surveyResponses).where(inArray(surveyResponses.surveyId, surveyIds));
      const responseIds = surveyResponseRows.map(r => r.id);
      if (responseIds.length > 0) await db.delete(surveyAnswers).where(inArray(surveyAnswers.responseId, responseIds));
      await db.delete(surveyResponses).where(inArray(surveyResponses.surveyId, surveyIds));
      await db.delete(surveyQuestions).where(inArray(surveyQuestions.surveyId, surveyIds));
      await db.delete(surveys).where(eq(surveys.organizationId, orgId));
    }

    if (userIds.length > 0) {
      await db.delete(goalNotifications).where(inArray(goalNotifications.userId, userIds));
      await db.delete(wishlists).where(inArray(wishlists.userId, userIds));
      await db.delete(surveyResponses).where(inArray(surveyResponses.userId, userIds));
      await db.delete(orders).where(inArray(orders.userId, userIds));
      await db.delete(transactions).where(inArray(transactions.userId, userIds));
      await db.delete(customItemTransactions).where(eq(customItemTransactions.orgId, orgId));
    }

    await db.delete(goals).where(eq(goals.organizationId, orgId));
    await db.delete(storeItems).where(eq(storeItems.organizationId, orgId));
    await db.delete(documents).where(eq(documents.organizationId, orgId));
    await db.delete(shopWebsites).where(eq(shopWebsites.organizationId, orgId));
    await db.delete(transactionCategories).where(eq(transactionCategories.orgId, orgId));
    await db.delete(monthlyReports).where(eq(monthlyReports.orgId, orgId));
    await db.delete(invitations).where(eq(invitations.organizationId, orgId));

    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
    await db.delete(departments).where(eq(departments.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));

    console.log(`[sessionDemo] Deleted temp demo org id=${orgId}`);
  } catch (err) {
    console.error(`[sessionDemo] Failed to delete temp demo org id=${orgId}:`, err);
    throw err;
  }
}

/**
 * Cleans up stale temp demo orgs that were created more than 3 hours ago
 * (handles sessions that expired without an explicit exit).
 */
export async function cleanupStaleDemoOrgs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const staleOrgs = await db
      .select({ id: organizations.id, createdAt: organizations.createdAt })
      .from(organizations)
      .where(like(organizations.code, "TMPDEMO_%"));
    for (const org of staleOrgs) {
      if (org.createdAt && org.createdAt < cutoff) {
        await deleteSessionDemoOrg(org.id).catch(e =>
          console.error(`[sessionDemo] Cleanup failed for org ${org.id}:`, e)
        );
      }
    }
  } catch (err) {
    console.error("[sessionDemo] Stale cleanup job failed:", err);
  }
}
