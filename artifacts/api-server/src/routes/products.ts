import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, and, SQL } from "drizzle-orm";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    imageUrl: p.imageUrl ?? null,
    categoryId: p.categoryId ?? null,
    categoryName: categoryName ?? null,
    stock: p.stock ?? null,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const parsed = ListProductsQueryParams.safeParse({
    search: req.query.search,
    categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
  });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const conditions: SQL[] = [];
    if (parsed.data.search) conditions.push(ilike(productsTable.name, `%${parsed.data.search}%`));
    if (parsed.data.categoryId != null) conditions.push(eq(productsTable.categoryId, parsed.data.categoryId));
    if (parsed.data.isActive != null) conditions.push(eq(productsTable.isActive, parsed.data.isActive));

    const products = await db.select().from(productsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(productsTable.name);

    const categories = await db.select().from(categoriesTable);
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    res.json(products.map(p => formatProduct(p, p.categoryId ? catMap.get(p.categoryId) : null)));
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [product] = await db.insert(productsTable).values({
      name: parsed.data.name,
      price: String(parsed.data.price),
      imageUrl: parsed.data.imageUrl ?? null,
      categoryId: parsed.data.categoryId ?? null,
      stock: parsed.data.stock ?? null,
      isActive: parsed.data.isActive ?? true,
    }).returning();
    res.status(201).json(formatProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to create product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const parsed = GetProductParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.id));
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(formatProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to get product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  const paramParsed = UpdateProductParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const updateData: Partial<typeof productsTable.$inferInsert> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
    if ("imageUrl" in parsed.data) updateData.imageUrl = parsed.data.imageUrl ?? null;
    if ("categoryId" in parsed.data) updateData.categoryId = parsed.data.categoryId ?? null;
    if ("stock" in parsed.data) updateData.stock = parsed.data.stock ?? null;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const [product] = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, paramParsed.data.id))
      .returning();

    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(formatProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to update product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const parsed = DeleteProductParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.delete(productsTable).where(eq(productsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete product");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
