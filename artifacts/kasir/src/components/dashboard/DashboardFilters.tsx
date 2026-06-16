import { Building2, UserCircle, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DashboardFiltersProps {
  outletFilter: string;
  cashierFilter: string;
  outlets?: { id: number; name: string }[];
  cashierNames?: string[];
  onOutletChange: (value: string) => void;
  onCashierChange: (value: string) => void;
  onReset: () => void;
}

export function DashboardFilters({
  outletFilter,
  cashierFilter,
  outlets = [],
  cashierNames = [],
  onOutletChange,
  onCashierChange,
  onReset,
}: DashboardFiltersProps) {
  const hasActiveFilter = outletFilter !== "all" || cashierFilter !== "all";

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
      {/* Outlet Filter */}
      <Select value={outletFilter} onValueChange={onOutletChange}>
        <SelectTrigger className="h-9 w-full sm:w-[180px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
          <Building2 className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <SelectValue placeholder="Semua Outlet" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Outlet</SelectItem>
          {outlets.map((outlet) => (
            <SelectItem key={outlet.id} value={outlet.id.toString()}>
              {outlet.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cashier Filter */}
      <Select value={cashierFilter} onValueChange={onCashierChange}>
        <SelectTrigger className="h-9 w-full sm:w-[180px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
          <UserCircle className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <SelectValue placeholder="Semua Kasir" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Kasir</SelectItem>
          {cashierNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
