import { Link, useLocation } from "wouter";
import { Calculator, LayoutDashboard, Package, History, Menu, Users, Settings, LogOut, Tag, Wallet, User, UserCog, Megaphone, Undo2, RefreshCcw, CalendarDays } from "lucide-react";
import { TbCoin } from "react-icons/tb";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/auth";
import { usePendingExpensesCount } from "@/hooks/usePendingExpenses";
import { usePendingReturnsCount } from "@/hooks/usePendingReturns";

interface BottomNavigationProps {
  onOpenProfile?: () => void;
}

export function BottomNavigation({ onOpenProfile }: BottomNavigationProps) {
  const [location, setLocation] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { user, logout } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("pos_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCartCount(parsed.length || 0);
      }
    } catch (e) { }

    const handleCartUpdate = (e: any) => {
      setCartCount(e.detail || 0);
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, []);

  const isAdmin = isAdminMode(user);
  const pendingExpensesCount = usePendingExpensesCount();
  const pendingReturnsCount = usePendingReturnsCount();

  const mainLinks = useMemo(() => {
    if (isAdmin) {
      return [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/customers", label: "Pelanggan", icon: Users },
        { href: "/products", label: "Produk", icon: Package },
        { href: "/transactions", label: "Riwayat", icon: History },
      ];
    }
    return [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "Kasir", icon: Calculator },
      { href: "/products", label: "Produk", icon: Package },
      { href: "/transactions", label: "Riwayat", icon: History },
    ];
  }, [isAdmin]);

  const moreLinks = useMemo(() => {
    if (!isAdmin) {
      return [
        { href: "/customers", label: "Pelanggan", icon: Users },
        { href: "/visit-schedule", label: "Jadwal Kunjungan", icon: CalendarDays },
        { href: "/customer-returns", label: "Retur Pelanggan", icon: RefreshCcw },
        { href: "/expenses", label: "Pengeluaran", icon: Wallet },
        { href: "/receivables", label: "Piutang", icon: TbCoin },
        { href: "/settings", label: "Pengaturan", icon: Settings },
      ];
    }

    return [
      { href: "/staff", label: "Staff", icon: UserCog },
      { href: "/visit-schedule", label: "Jadwal Kunjungan", icon: CalendarDays },
      { href: "/customer-returns", label: "Retur Pelanggan", icon: RefreshCcw },
      { href: "/expenses", label: "Pengeluaran", icon: Wallet },
      { href: "/receivables", label: "Piutang", icon: TbCoin },
      { href: "/promo", label: "Promo", icon: Megaphone },
      { href: "/settings", label: "Pengaturan", icon: Settings },
    ];
  }, [isAdmin]);

  const handleLogout = async () => {
    setShowMore(false);
    await logout();
    window.location.href = "/login";
  };

  return (
    <>
      {showMore && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 md:hidden z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 rounded-t-2xl">
        <div className="flex items-center justify-around py-2 px-1 relative z-10 bg-white dark:bg-slate-800 rounded-t-2xl">
          {mainLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-200 relative",
                  isActive
                    ? "text-primary dark:text-primary-400"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <div className="relative">
                  <Icon className={cn("w-5 h-5 mb-1", isActive ? "text-primary dark:text-primary-400" : "text-slate-400 dark:text-slate-500")} />
                  {link.href === "/pos" && cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-slate-800" />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-medium text-center leading-tight",
                  isActive ? "text-primary dark:text-primary-400 font-semibold" : "text-slate-400 dark:text-slate-500"
                )}>
                  {link.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-200",
              showMore
                ? "text-primary dark:text-primary-400"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            <Menu className="w-5 h-5 mb-1" />
            <span className={cn(
              "text-[9px] font-medium text-center leading-tight",
              showMore ? "text-primary dark:text-primary-400 font-semibold" : "text-slate-400 dark:text-slate-500"
            )}>
              Lainnya
            </span>
          </button>
        </div>

        <div className={cn(
          "grid transition-all duration-300 ease-in-out bg-white dark:bg-slate-800",
          showMore ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden">
            <div className="flex items-center justify-around py-3 px-1 flex-wrap gap-y-3 border-t border-slate-100 dark:border-slate-700">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location === link.href;
                const isLogout = "isLogout" in link && link.isLogout;

                if (isLogout) {
                  return (
                    <button
                      key={link.href}
                      onClick={handleLogout}
                      className="flex flex-col items-center justify-center w-16 py-1 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span className="text-[9px] font-medium text-center leading-tight">{link.label}</span>
                    </button>
                  );
                }

                if (link.href === "#profile") {
                  return (
                    <button
                      key={link.href}
                      onClick={() => {
                        setShowMore(false);
                        onOpenProfile?.();
                      }}
                      className="flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-200 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span className="text-[9px] font-medium text-center leading-tight">{link.label}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={link.href}
                    onClick={() => {
                      setShowMore(false);
                      setLocation(link.href);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-200 relative",
                      isActive
                        ? "text-primary dark:text-primary-400"
                        : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                  >
                    <div className="relative">
                      <Icon className={cn("w-5 h-5 mb-1", isActive ? "text-primary dark:text-primary-400" : "text-slate-400 dark:text-slate-500")} />
                      {link.href === "/expenses" && pendingExpensesCount > 0 && isAdmin && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-slate-800" />
                      )}
                      {link.href === "/customer-returns" && pendingReturnsCount > 0 && isAdmin && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-slate-800" />
                      )}
                    </div>
                    <span className={cn(
                      "text-[9px] font-medium text-center leading-tight",
                      isActive ? "text-primary dark:text-primary-400 font-semibold" : "text-slate-400 dark:text-slate-500"
                    )}>
                      {link.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
