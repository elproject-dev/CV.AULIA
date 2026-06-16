import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "migration-add-discount-note.sql");
const sql = readFileSync(migrationPath, "utf8");

const projectRef = process.env.SUPABASE_PROJECT_REF || "bqmxjxsdassgiuhtquaw";
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.log("Kolom discount_note & customer_type belum ada di Supabase.");
  console.log("");
  console.log("Cara 1 (disarankan): Supabase Dashboard → SQL Editor → paste isi file:");
  console.log("  artifacts/kasir/migration-add-discount-note.sql");
  console.log("");
  console.log("Cara 2: jalankan script ini dengan password database:");
  console.log("  SUPABASE_DB_PASSWORD=your_password node scripts/apply-transaction-migration.mjs");
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ||
  `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("Migrasi berhasil: discount_note & customer_type sudah ditambahkan.");
} catch (error) {
  console.error("Migrasi gagal:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
