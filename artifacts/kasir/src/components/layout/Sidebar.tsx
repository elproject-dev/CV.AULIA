import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, LayoutDashboard, Package, Users, History, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Kasir", icon: Calculator },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/products", label: "Produk", icon: Package },
    { href: "/customers", label: "Pelanggan", icon: Users },
    { href: "/transactions", label: "Riwayat Transaksi", icon: History },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Store className="w-6 h-6 mr-3 text-accent" />
          <span className="font-bold text-lg tracking-tight">Kasir Pro</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href} className={cn(
                "flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <Icon className="w-5 h-5 mr-3" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-accent-foreground">
              A
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-sidebar-foreground">Admin Kasir</p>
              <p className="text-xs text-sidebar-foreground/60">Shift Pagi</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
