import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, transactionItemsTable, productsTable, customersTable } from "@workspace/db";
import { eq, desc, gte, lte, sql, and, count } from "drizzle-orm";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRevenue] = await db.select({
      total: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`,
      count: sql<string>`COUNT(*)`,
    }).from(transactionsTable)
      .where(and(
        gte(transactionsTable.createdAt, todayStart),
        eq(transactionsTable.status, "completed")
      ));

    const [monthRevenue] = await db.select({
      total: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`,
      count: sql<string>`COUNT(*)`,
    }).from(transactionsTable)
      .where(and(
        gte(transactionsTable.createdAt, monthStart),
        eq(transactionsTable.status, "completed")
      ));

    const [customersCount] = await db.select({
      total: sql<string>`COUNT(*)`,
    }).from(customersTable);

    const [newCustomers] = await db.select({
      total: sql<string>`COUNT(*)`,
    }).from(customersTable)
      .where(gte(customersTable.createdAt, monthStart));

    const [productsCount] = await db.select({
      total: sql<string>`COUNT(*)`,
    }).from(productsTable).where(eq(productsTable.isActive, true));

    const monthTotalRevenue = parseFloat(monthRevenue.total);
    const monthTransactions = parseInt(monthRevenue.count);
    const avgTxValue = monthTransactions > 0 ? monthTotalRevenue / monthTransactions : 0;

    res.json({
      totalRevenueToday: parseFloat(todayRevenue.total),
      totalRevenueMonth: monthTotalRevenue,
      transactionsToday: parseInt(todayRevenue.count),
      transactionsMonth: monthTransactions,
      totalCustomers: parseInt(customersCount.total),
      totalProducts: parseInt(productsCount.total),
      newCustomersThisMonth: parseInt(newCustomers.total),
      averageTransactionValue: avgTxValue,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/top-products
router.get("/top-products", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 5;

  try {
    const topProducts = await db.select({
      productId: transactionItemsTable.productId,
      productName: transactionItemsTable.productName,
      totalSold: sql<string>`SUM(${transactionItemsTable.quantity})`,
      totalRevenue: sql<string>`SUM(${transactionItemsTable.subtotal})`,
    })
      .from(transactionItemsTable)
      .groupBy(transactionItemsTable.productId, transactionItemsTable.productName)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(limit);

    // Get image URLs for these products
    const productIds = topProducts.map(p => p.productId);
    let imageMap = new Map<number, string | null>();
    if (productIds.length > 0) {
      const products = await db.select({ id: productsTable.id, imageUrl: productsTable.imageUrl })
        .from(productsTable)
        .where(sql`${productsTable.id} = ANY(${sql.raw(`ARRAY[${productIds.join(",")}]`)})`);
      imageMap = new Map(products.map(p => [p.id, p.imageUrl ?? null]));
    }

    res.json(topProducts.map(p => ({
      productId: p.productId,
      productName: p.productName,
      imageUrl: imageMap.get(p.productId) ?? null,
      totalSold: parseInt(p.totalSold),
      totalRevenue: parseFloat(p.totalRevenue),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get top products");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/recent-transactions
router.get("/recent-transactions", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  try {
    const transactions = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.status, "completed"))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit);

    res.json(transactions.map(t => ({
      id: t.id,
      customerId: t.customerId ?? null,
      customerName: t.customerName ?? null,
      cashierName: t.cashierName,
      paymentMethod: t.paymentMethod,
      subtotal: parseFloat(t.subtotal),
      discount: parseFloat(t.discount),
      tax: parseFloat(t.tax),
      total: parseFloat(t.total),
      amountPaid: parseFloat(t.amountPaid),
      change: parseFloat(t.change),
      pointsEarned: t.pointsEarned,
      pointsUsed: t.pointsUsed,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recent transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/revenue-chart
router.get("/revenue-chart", async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 7;

  try {
    const results = await db.select({
      date: sql<string>`DATE(${transactionsTable.createdAt})`,
      revenue: sql<string>`COALESCE(SUM(${transactionsTable.total}), 0)`,
      transactions: sql<string>`COUNT(*)`,
    })
      .from(transactionsTable)
      .where(and(
        gte(transactionsTable.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(days))} days'`),
        eq(transactionsTable.status, "completed")
      ))
      .groupBy(sql`DATE(${transactionsTable.createdAt})`)
      .orderBy(sql`DATE(${transactionsTable.createdAt})`);

    res.json(results.map(r => ({
      date: r.date,
      revenue: parseFloat(r.revenue),
      transactions: parseInt(r.transactions),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get revenue chart");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
