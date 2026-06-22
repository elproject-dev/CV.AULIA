import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, LayoutDashboard, Package, Users, History, Settings, LogOut, Wallet, UserCog, Tag, User, Megaphone, ArrowRightLeft, Undo2, RefreshCcw, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "./BottomNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useListOutlets } from "@/mocks/api-client-react";
import { ProfileDialog } from "./ProfileDialog";
import { usePendingExpensesCount } from "@/hooks/usePendingExpenses";
import { usePendingReturnsCount } from "@/hooks/usePendingReturns";

const ALL_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/pos", label: "Kasir", icon: Calculator, adminOnly: false, kasirOnly: true },
  { href: "/customer-returns", label: "Retur Pelanggan", icon: RefreshCcw, adminOnly: false },
  { href: "/products", label: "Produk", icon: Package, adminOnly: false },
  { href: "/customers", label: "Pelanggan", icon: Users, adminOnly: false },
  { href: "/staff", label: "Staff", icon: UserCog, adminOnly: true },
  { href: "/transactions", label: "Riwayat Transaksi", icon: History, adminOnly: false },
  { href: "/expenses", label: "Pengeluaran", icon: Wallet, adminOnly: false },
  { href: "/receivables", label: "Piutang", icon: Banknote, adminOnly: false },
  { href: "#profile", label: "Profil", icon: User, adminOnly: false, kasirOnly: true },
  { href: "/promo", label: "Promo", icon: Megaphone, adminOnly: true },
  { href: "/settings", label: "Pengaturan", icon: Settings, adminOnly: false },
];

interface SidebarProps {
  children: ReactNode;
  className?: string;
}

export function Sidebar({ children, className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [, setStoreName] = useState(() => localStorage.getItem('storeName') || 'Sbagiamu');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Sync primary color to CSS variables on mount
  useEffect(() => {
    const syncPrimaryColor = () => {
      const primaryHue = parseInt(localStorage.getItem('primaryHue') || '35');
      const primarySaturation = parseInt(localStorage.getItem('primarySaturation') || '100');
      const primaryLightness = parseInt(localStorage.getItem('primaryLightness') || '45');
      const root = document.documentElement;

      root.style.setProperty('--primary', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
      root.style.setProperty('--accent', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
      root.style.setProperty('--ring', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
      root.style.setProperty('--sidebar-primary', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
      root.style.setProperty('--sidebar-ring', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
      root.style.setProperty('--chart-1', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
      root.style.setProperty('--sidebar', `${primaryHue} ${Math.max(primarySaturation - 40, 20)}% ${Math.max(primaryLightness - 70, 5)}%`);
      root.style.setProperty('--sidebar-accent', `${primaryHue} ${Math.max(primarySaturation - 30, 20)}% ${Math.max(primaryLightness - 60, 10)}%`);
      root.style.setProperty('--sidebar-border', `${primaryHue} ${Math.max(primarySaturation - 50, 10)}% ${Math.max(primaryLightness - 60, 8)}%`);
    };

    // Sync immediately on mount
    syncPrimaryColor();

    // Also listen for storage changes (for cross-tab sync)
    window.addEventListener('storage', syncPrimaryColor);
    window.addEventListener('storeSettingsChanged', syncPrimaryColor);

    return () => {
      window.removeEventListener('storage', syncPrimaryColor);
      window.removeEventListener('storeSettingsChanged', syncPrimaryColor);
    };
  }, []);

  useEffect(() => {
    const syncStoreName = () => {
      setStoreName(localStorage.getItem('storeName') || 'Sbagiamu');
    };

    syncStoreName();
    window.addEventListener('storage', syncStoreName);
    window.addEventListener('storeNameChanged', syncStoreName);

    return () => {
      window.removeEventListener('storage', syncStoreName);
      window.removeEventListener('storeNameChanged', syncStoreName);
    };
  }, []);

  const { data: outlets } = useListOutlets();

  useEffect(() => {
    if (user?.outletId && user.outletId !== "all" && outlets && outlets.length > 0) {
      const assignedOutlet = outlets.find((o: any) => o.id.toString() === user.outletId);
      if (assignedOutlet) {
        let changed = false;
        
        const currentName = localStorage.getItem('storeName');
        const expectedStoreName = assignedOutlet.store_name || assignedOutlet.name;
        if (currentName !== expectedStoreName) {
          localStorage.setItem('storeName', expectedStoreName);
          changed = true;
        }

        const currentAddress = localStorage.getItem('storeAddress');
        const newAddress = assignedOutlet.address || '';
        if (currentAddress !== newAddress) {
          localStorage.setItem('storeAddress', newAddress);
          changed = true;
        }

        const currentPhone = localStorage.getItem('storePhone');
        const newPhone = assignedOutlet.phone || '';
        if (currentPhone !== newPhone) {
          localStorage.setItem('storePhone', newPhone);
          changed = true;
        }

        const currentFooter1 = localStorage.getItem('footerMessage');
        const newFooter1 = assignedOutlet.footer_message || 'Terima kasih atas kunjungan Anda';
        if (currentFooter1 !== newFooter1) {
          localStorage.setItem('footerMessage', newFooter1);
          changed = true;
        }

        const currentFooter2 = localStorage.getItem('footerMessage2');
        const newFooter2 = assignedOutlet.footer_message2 || 'Real Brew, Real Bean, Real Coffee';
        if (currentFooter2 !== newFooter2) {
          localStorage.setItem('footerMessage2', newFooter2);
          changed = true;
        }

        const currentFooter3 = localStorage.getItem('footerMessage3');
        const newFooter3 = assignedOutlet.footer_message3 || 'Powered by Tembus Digital';
        if (currentFooter3 !== newFooter3) {
          localStorage.setItem('footerMessage3', newFooter3);
          changed = true;
        }

        if (changed) {
          window.dispatchEvent(new Event('storeNameChanged'));
          window.dispatchEvent(new Event('storeSettingsChanged'));
        }
      }
    }
  }, [user?.outletId, outlets]);

  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("pos_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCartCount(parsed.length || 0);
      }
    } catch (e) {}

    const handleCartUpdate = (e: any) => {
      setCartCount(e.detail || 0);
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, []);

  const pendingExpensesCount = usePendingExpensesCount();
  const pendingReturnsCount = usePendingReturnsCount();

  const links = useMemo(() => {
    if (!user) return [];
    if (isAdminMode(user)) return ALL_LINKS.filter((link) => !(link as any).kasirOnly);
    return ALL_LINKS.filter((link) => !link.adminOnly);
  }, [user]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className={cn("flex h-screen w-full bg-background overflow-hidden", className)}>
      {/* Desktop/Landscape Tablet Sidebar - Icons only */}
      <aside className="w-16 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col flex-shrink-0 transition-all duration-300">
        <div className="h-16 flex items-center justify-center border-b border-sidebar-border">
          <img
            src={`${import.meta.env.BASE_URL}logo-login.png`}
            alt="Store Logo"
            className="h-8 w-8 object-contain"
          />
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            
            if (link.href === "#profile") {
              return (
                <button
                  key={link.href}
                  onClick={() => setIsProfileOpen(true)}
                  title={link.label}
                  className="w-full flex items-center p-3 rounded-md text-sm font-medium transition-colors justify-center relative text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                </button>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={cn(
                  "flex items-center p-3 rounded-md text-sm font-medium transition-colors justify-center relative",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {link.href === "/pos" && cartCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                )}
                {link.href === "/expenses" && pendingExpensesCount > 0 && isAdminMode(user) && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                )}
                {link.href === "/customer-returns" && pendingReturnsCount > 0 && isAdminMode(user) && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-center cursor-pointer transition-transform hover:scale-105" onClick={() => setIsProfileOpen(true)}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border-2 border-primary/20 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
                {userInitial}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content with Bottom Nav (Mobile & Portrait Tablet) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto pb-[72px] md:pb-0 page-content">
        {children}
        <BottomNavigation onOpenProfile={() => setIsProfileOpen(true)} />
      </main>

      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </div>
  );
}
