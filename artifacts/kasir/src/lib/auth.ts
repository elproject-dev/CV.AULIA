import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Login modes - Admin and Kasir
export type LoginMode = "admin" | "kasir";
export type UserRole = "admin" | "kasir";

// Admin email for admin mode
export const ADMIN_EMAIL = "sbagiamu.pos@gmail.com";

// Kasir default email (can be customized)
export const KASIR_EMAIL = "kasir@sbagiamu.com";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  loginMode: LoginMode;
  outletId?: string;
  avatarUrl?: string;
  createdAt?: string;
}

const SESSION_KEY = "kasir_auth_session";

// Check if user is in admin mode
export function isAdminMode(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

// Check if user is in kasir mode
export function isKasirMode(user: AuthUser | null): boolean {
  return user?.role === "kasir";
}

// Check if user can access a specific route
export function canAccessRoute(user: AuthUser | null, path: string): boolean {
  if (!user) return false;
  if (isAdminMode(user)) return true;

  // Kasir can only access POS, transactions, products, dashboard, customers, expenses, and settings
  const kasirAllowed = ["/", "/pos", "/transactions", "/products", "/customers", "/expenses", "/settings"];
  return kasirAllowed.some(
    (route) => path === route || (route !== "/" && path.startsWith(`${route}/`))
  );
}

// Get default route based on login mode
export function getDefaultRoute(user: AuthUser): string {
  return "/";
}

export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed?.email || !parsed?.loginMode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(user: AuthUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function getDisplayName(authUser: User): string {
  const metadata = authUser.user_metadata ?? {};
  return (
    metadata.name ||
    metadata.full_name ||
    authUser.email?.split("@")[0] ||
    "User"
  );
}

function getUserRole(authUser: User, mode: LoginMode): UserRole {
  const metadataRole = String(authUser.user_metadata?.role ?? "").toLowerCase();
  if (metadataRole === "admin") return "admin";
  if (metadataRole === "kasir" || metadataRole === "sales") return "kasir";
  return mode === "admin" ? "admin" : "kasir";
}

function validateAccess(_authUser: User, _mode: LoginMode): void {
  // All users can login - no access restriction
  // The role is determined by Supabase metadata and stored in AuthUser
}

function buildAuthUser(authUser: User, mode: LoginMode): AuthUser {
  return {
    id: authUser.id,
    name: getDisplayName(authUser),
    email: authUser.email ?? "",
    role: getUserRole(authUser, mode),
    loginMode: mode,
  };
}

export async function loginWithSupabase(
  email: string,
  password: string,
  mode: LoginMode = "admin"
): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Email dan password wajib diisi");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    throw new Error(
      error?.message?.toLowerCase().includes("invalid")
        ? "Email atau password salah"
        : error?.message || "Login gagal"
    );
  }

  try {
    validateAccess(data.user, mode);
  } catch (accessError) {
    await supabase.auth.signOut();
    throw accessError;
  }

  const user = buildAuthUser(data.user, mode);
  saveSession(user);

  // Query data memakai role anon (policy publik yang sudah ada).
  // Session login disimpan di localStorage untuk UI & filter multi-tenant.
  await supabase.auth.signOut();

  return user;
}

export async function registerWithSupabase(
  email: string,
  password: string,
  name: string,
  phone: string
): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password || !name || !phone) {
    throw new Error("Nama, Email, No. Telp, dan Password wajib diisi");
  }

  // 1. Sign up on Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        name,
        role: 'kasir',
      }
    }
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Registrasi gagal");
  }

  // 2. Insert into staff table as Kasir
  const { error: dbError } = await supabase.from('staff').insert([{
    name,
    email: normalizedEmail,
    phone,
    role: 'kasir',
    status: 'active',
    owner_id: authData.user.id
  }]);

  if (dbError) {
    console.error("Gagal menyimpan profil staff:", dbError);
    // Ignore error, might already exist or handled by trigger
  }

  const user = buildAuthUser(authData.user, "kasir");
  saveSession(user);

  // We sign out to match the login architecture (using anon key for public RLS)
  await supabase.auth.signOut();

  return user;
}

export async function restoreSession(): Promise<AuthUser | null> {
  return loadSession();
}

export async function logoutAuth(): Promise<void> {
  await supabase.auth.signOut();
  clearSession();
}
