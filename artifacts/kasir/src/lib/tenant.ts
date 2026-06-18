import { loadSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAIL } from "@/lib/auth";

const TENANT_READY_KEY = "tenant_owner_id_ready";

let ownerIdColumnReady: boolean | null = null;

function readCachedTenantReady(): boolean | null {
  const cached = localStorage.getItem(TENANT_READY_KEY);
  if (cached === "true") return true;
  if (cached === "false") return false;
  return null;
}

function isMissingOwnerIdColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("owner_id") ||
    message.includes("does not exist")
  );
}

/** Cek apakah kolom owner_id sudah ada di database */
export async function initTenantSupport(): Promise<boolean> {
  const cached = readCachedTenantReady();
  if (cached !== null) {
    ownerIdColumnReady = cached;
    return cached;
  }

  // Test pada tabel products (tabel utama)
  const { error } = await supabase.from("products").select("owner_id").limit(1);
  const ready = !error || !isMissingOwnerIdColumn(error);
  ownerIdColumnReady = ready;
  localStorage.setItem(TENANT_READY_KEY, String(ready));
  return ready;
}

export function isTenantFilterEnabled(): boolean {
  if (ownerIdColumnReady !== null) return ownerIdColumnReady;
  return readCachedTenantReady() === true;
}

/** UUID user Supabase Auth — dipakai sebagai owner_id data kasir */
export function getTenantOwnerId(): string | null {
  return loadSession()?.id ?? null;
}

/** Cek apakah user adalah admin super (hanya sbagiamu.pos@gmail.com) atau memiliki role admin
 * Admin super bisa lihat semua data
 * User lain hanya bisa lihat data miliknya sendiri */
export function isTenantSuperAdmin(): boolean {
  const user = loadSession();
  if (!user) return false;
  const userEmail = (user.email || "").toLowerCase();
  const userRole = (user.role || "").toLowerCase();
  return userEmail === (ADMIN_EMAIL || "").toLowerCase() || userRole === "admin" || userRole === "developer";
}

/** Tabel yang datanya dipisahkan per kasir (transactions, transaction_items, expenses) */
const TENANT_TABLES = ['transactions', 'transaction_items', 'expenses'];

/** Cek apakah tabel seharusnya dipisahkan per kasir */
function isTenantTable(tableName: string): boolean {
  return TENANT_TABLES.includes(tableName.toLowerCase());
}

/** Filter query Supabase:
 * - Produk & Kategori: semua kasir bisa lihat (shared data)
 * - Transactions & Transaction Items: hanya data sendiri
 * - Admin super: semua data */
export function applyTenantFilter(query: any, column = "owner_id"): any {
  // Jika belum diinit atau tidak enabled, jangan filter
  if (!isTenantFilterEnabled()) return query;
  if (isTenantSuperAdmin()) return query;

  const ownerId = getTenantOwnerId();
  if (!ownerId) return query;

  // Cek apakah query ini untuk tabel yang seharusnya dipisahkan
  // Kita tidak bisa cek nama tabel dari query object, jadi kita pakai logika default
  // Semua tabel kecuali products dan categories akan difilter
  return query.eq(column, ownerId);
}

/** Versi applyTenantFilter yang menerima nama tabel untuk kontrol lebih detail */
export function applyTenantFilterForTable(query: any, tableName: string, column = "owner_id"): any {
  if (!isTenantFilterEnabled()) return query;
  if (isTenantSuperAdmin()) return query;

  // Produk, kategori, customer, dan expenses adalah data bersama - tidak difilter (expenses akan difilter secara manual)
  const sharedTables = ['products', 'categories', 'customers', 'outlets'];
  if (sharedTables.includes(tableName.toLowerCase())) {
    return query;
  }

  const ownerId = getTenantOwnerId();
  if (!ownerId) return query;
  return query.eq(column, ownerId);
}

/** Sisipkan owner_id saat INSERT data tenant */
export function withTenantOwner<T extends Record<string, unknown>>(payload: T, tableName?: string): T {
  if (!isTenantFilterEnabled()) return payload;

  // Produk, kategori, dan customer adalah data bersama - tidak perlu owner_id
  const sharedTables = ['products', 'categories', 'customers', 'outlets'];
  if (tableName && sharedTables.includes(tableName.toLowerCase())) {
    return payload;
  }

  const ownerId = getTenantOwnerId();
  if (!ownerId || isTenantSuperAdmin()) return payload;
  return { ...payload, owner_id: ownerId };
}

/** Handle error dari query - jika kolom tidak ada, matikan tenant filter */
export function handleTenantError(error: any): void {
  if (isMissingOwnerIdColumn(error)) {
    ownerIdColumnReady = false;
    localStorage.setItem(TENANT_READY_KEY, "false");
  }
}

/** Panggil setelah kolom owner_id ditambahkan via Dashboard */
export function resetTenantSupportCache(): void {
  ownerIdColumnReady = null;
  localStorage.removeItem(TENANT_READY_KEY);
}
