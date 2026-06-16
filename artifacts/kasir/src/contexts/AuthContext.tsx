import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AuthUser,
  loginWithSupabase,
  registerWithSupabase,
  logoutAuth,
  restoreSession,
  saveSession,
} from "@/lib/auth";
import { initTenantSupport } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string, phone: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    restoreSession()
      .then(async (sessionUser) => {
        if (!active) return;
        if (sessionUser) {
          // Fetch user details from staff table
          const { data } = await supabase.from('staff').select('name, role, outlet_id, avatar_url').ilike('email', sessionUser.email).single();
          if (data) {
            if (data.name) {
              sessionUser.name = data.name;
            }
            if (data.role) {
              sessionUser.role = data.role as any;
            }
            if (sessionUser.email === 'sbagiamu.pos@gmail.com') {
              sessionUser.role = 'admin';
            }
            if (data.avatar_url) {
              sessionUser.avatarUrl = data.avatar_url;
            }
            saveSession(sessionUser);
            // Set outletId for both Kasir and Admin if they have an assigned outlet
            if (data.outlet_id) {
              const outletIdStr = data.outlet_id.toString();
              sessionUser.outletId = outletIdStr;
              saveSession(sessionUser);
              localStorage.setItem('selectedOutletId', outletIdStr);
              window.dispatchEvent(new Event('outletChanged'));
            }
          } else if (sessionUser.email === 'sbagiamu.pos@gmail.com') {
             sessionUser.role = 'admin';
             saveSession(sessionUser);
          } else {
             // If not found in staff table and not root admin, default to kasir for safety
             sessionUser.role = 'kasir';
             saveSession(sessionUser);
          }
        await initTenantSupport();
        }
        setUser(sessionUser);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Realtime subscription for staff updates (Role & Outlet changes)
  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase.channel('staff-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'staff',
        },
        (payload) => {
          const updatedStaff = payload.new as any;
          // Cek apakah update ini untuk user yang sedang login
          if (updatedStaff.email?.toLowerCase() === user.email.toLowerCase()) {
            setUser((prev) => {
              if (!prev) return prev;
              const newUser = { ...prev };
              let changed = false;
              
              // Cek update outlet
              if (updatedStaff.outlet_id !== undefined) {
                const newOutletId = updatedStaff.outlet_id ? updatedStaff.outlet_id.toString() : undefined;
                if (newUser.outletId !== newOutletId) {
                  newUser.outletId = newOutletId;
                  changed = true;
                  if (newOutletId) {
                    localStorage.setItem('selectedOutletId', newOutletId);
                  } else {
                    localStorage.removeItem('selectedOutletId');
                  }
                  window.dispatchEvent(new Event('outletChanged'));
                }
              }

              // Cek update role (kecuali superadmin)
              if (updatedStaff.role && newUser.role !== updatedStaff.role && newUser.email !== 'sbagiamu.pos@gmail.com') {
                newUser.role = updatedStaff.role;
                changed = true;
              }

              // Cek update nama
              if (updatedStaff.name && newUser.name !== updatedStaff.name) {
                newUser.name = updatedStaff.name;
                changed = true;
              }

              if (changed) {
                saveSession(newUser);
                return newUser;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pos_cart");
      }
      const authUser = await loginWithSupabase(email, password);
      
      // Fetch user details from staff table
      const { data } = await supabase.from('staff').select('name, role, outlet_id, avatar_url').ilike('email', authUser.email).single();
      if (data) {
        if (data.name) {
          authUser.name = data.name;
        }
        if (data.role) {
          authUser.role = data.role as any;
        }
        if (authUser.email === 'sbagiamu.pos@gmail.com') {
          authUser.role = 'admin';
        }
        if (data.avatar_url) {
          authUser.avatarUrl = data.avatar_url;
        }
        saveSession(authUser);
        // Set outletId for both Kasir and Admin if they have an assigned outlet
        if (data.outlet_id) {
          const outletIdStr = data.outlet_id.toString();
          authUser.outletId = outletIdStr;
          saveSession(authUser);
          localStorage.setItem('selectedOutletId', outletIdStr);
          window.dispatchEvent(new Event('outletChanged'));
        }
      } else if (authUser.email === 'sbagiamu.pos@gmail.com') {
         authUser.role = 'admin';
         saveSession(authUser);
      } else {
         // If not found in staff table and not root admin, default to kasir for safety
         authUser.role = 'kasir';
         saveSession(authUser);
      }

      await initTenantSupport();
      setUser(authUser);
      return authUser;
    } catch (error) {
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, phone: string) => {
    try {
      const authUser = await registerWithSupabase(email, password, name, phone);
      setUser(authUser);
      return authUser;
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutAuth();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pos_cart");
    }
    setUser(null);
  }, []);

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const newUser = { ...prev, ...data };
      saveSession(newUser);
      return newUser;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      updateUser,
    }),
    [user, isLoading, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
}

export function useAuthUserName(): string {
  const { user } = useAuth();
  return user?.name || "Kasir";
}
