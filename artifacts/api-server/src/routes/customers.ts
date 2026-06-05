import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db";
import { eq, ilike, and, SQL } from "drizzle-orm";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
  DeleteCustomerParams,
  LookupCustomerQueryParams,
} from "@workspace/api-zod";

const router = Router();

function formatCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    membershipType: c.membershipType,
    points: c.points,
    totalSpent: parseFloat(c.totalSpent),
    createdAt: c.createdAt.toISOString(),
  };
}

// Must be before /:id
router.get("/lookup", async (req, res) => {
  const parsed = LookupCustomerQueryParams.safeParse({ phone: req.query.phone });
  if (!parsed.success) { res.status(400).json({ error: "phone is required" }); return; }

  try {
    const [customer] = await db.select().from(customersTable)
      .where(eq(customersTable.phone, parsed.data.phone));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(formatCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to lookup customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  const parsed = ListCustomersQueryParams.safeParse({
    search: req.query.search,
    membershipType: req.query.membershipType,
  });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const conditions: SQL[] = [];
    if (parsed.data.search) conditions.push(ilike(customersTable.name, `%${parsed.data.search}%`));
    if (parsed.data.membershipType) {
      conditions.push(eq(customersTable.membershipType, parsed.data.membershipType as "member" | "non_member"));
    }

    const customers = await db.select().from(customersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(customersTable.name);

    res.json(customers.map(formatCustomer));
  } catch (err) {
    req.log.error({ err }, "Failed to list customers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [customer] = await db.insert(customersTable).values({
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      membershipType: parsed.data.membershipType,
    }).returning();
    res.status(201).json(formatCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to create customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const parsed = GetCustomerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.id));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(formatCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to get customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  const paramParsed = UpdateCustomerParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const updateData: Partial<typeof customersTable.$inferInsert> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if ("phone" in parsed.data) updateData.phone = parsed.data.phone ?? null;
    if ("email" in parsed.data) updateData.email = parsed.data.email ?? null;
    if (parsed.data.membershipType !== undefined) updateData.membershipType = parsed.data.membershipType;
    if (parsed.data.points !== undefined) updateData.points = parsed.data.points;

    const [customer] = await db.update(customersTable)
      .set(updateData)
      .where(eq(customersTable.id, paramParsed.data.id))
      .returning();

    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(formatCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to update customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const parsed = DeleteCustomerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.delete(customersTable).where(eq(customersTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
