import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, transactionItemsTable, customersTable } from "@workspace/db";
import { eq, desc, and, gte, lte, SQL } from "drizzle-orm";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  GetTransactionParams,
} from "@workspace/api-zod";

const router = Router();

function formatTransaction(t: typeof transactionsTable.$inferSelect) {
  return {
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
  };
}

router.get("/", async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    paymentMethod: req.query.paymentMethod,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const conditions: SQL[] = [];
    if (parsed.data.startDate) {
      conditions.push(gte(transactionsTable.createdAt, new Date(parsed.data.startDate)));
    }
    if (parsed.data.endDate) {
      const end = new Date(parsed.data.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(transactionsTable.createdAt, end));
    }
    if (parsed.data.paymentMethod) {
      conditions.push(eq(transactionsTable.paymentMethod, parsed.data.paymentMethod as typeof transactionsTable.$inferSelect["paymentMethod"]));
    }

    const transactions = await db.select().from(transactionsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(parsed.data.limit ?? 100)
      .offset(parsed.data.offset ?? 0);

    res.json(transactions.map(formatTransaction));
  } catch (err) {
    req.log.error({ err }, "Failed to list transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const { customerId, cashierName, paymentMethod, discount = 0, amountPaid = 0, pointsUsed = 0, items } = parsed.data;

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = 0;
    const total = subtotal - discount + tax;
    const change = amountPaid > 0 ? Math.max(0, amountPaid - total) : 0;
    const pointsEarned = Math.floor(total / 10000);

    let customerName: string | null = null;
    if (customerId) {
      const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
      if (customer) customerName = customer.name;
    }

    const [transaction] = await db.insert(transactionsTable).values({
      customerId: customerId ?? null,
      customerName,
      cashierName,
      paymentMethod,
      subtotal: String(subtotal),
      discount: String(discount),
      tax: String(tax),
      total: String(total),
      amountPaid: String(amountPaid),
      change: String(change),
      pointsEarned,
      pointsUsed: pointsUsed ?? 0,
      status: "completed",
    }).returning();

    // Insert items with actual product names
    const itemRows = items.map(item => ({
      transactionId: transaction.id,
      productId: item.productId,
      productName: `Product #${item.productId}`,
      quantity: item.quantity,
      price: String(item.price),
      subtotal: String(item.price * item.quantity),
    }));
    await db.insert(transactionItemsTable).values(itemRows);

    // Update customer points and total spent
    if (customerId) {
      const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
      if (customer) {
        const newPoints = Math.max(0, customer.points + pointsEarned - (pointsUsed ?? 0));
        const newTotalSpent = parseFloat(customer.totalSpent) + total;
        await db.update(customersTable)
          .set({ points: newPoints, totalSpent: String(newTotalSpent) })
          .where(eq(customersTable.id, customerId));
      }
    }

    res.status(201).json(formatTransaction(transaction));
  } catch (err) {
    req.log.error({ err }, "Failed to create transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const parsed = GetTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [transaction] = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.id, parsed.data.id));

    if (!transaction) { res.status(404).json({ error: "Transaction not found" }); return; }

    const items = await db.select().from(transactionItemsTable)
      .where(eq(transactionItemsTable.transactionId, parsed.data.id));

    res.json({
      ...formatTransaction(transaction),
      items: items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: parseFloat(item.price),
        subtotal: parseFloat(item.subtotal),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
