import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessRoute, getDefaultRoute, isAdminMode } from "@/lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setLocation("/login");
      return;
    }

    // Admin-only routes: redirect non-admin users
    if (adminOnly && !isAdminMode(user)) {
      setLocation(getDefaultRoute(user));
      return;
    }

    // Check route access based on user role
    if (!canAccessRoute(user, location)) {
      setLocation(getDefaultRoute(user));
    }
  }, [user, isLoading, location, adminOnly, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Memuat...</p>
      </div>
    );
  }

  if (!user) return null;
  if (adminOnly && !isAdminMode(user)) return null;
  if (!canAccessRoute(user, location)) return null;

  return <>{children}</>;
}
