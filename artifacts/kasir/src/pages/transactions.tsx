import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListTransactions, useListOutlets } from "@workspace/api-client-react";
import { formatRupiah, formatInvoiceNumber } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, CreditCard, Banknote, QrCode, Award, Building2, User, History, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAIL } from "@/lib/auth";

const ITEMS_PER_PAGE = 30;

const formatTransactionHistoryDate = (dateStr: string) => {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const month = new Intl.DateTimeFormat("id-ID", { month: "long" })
    .format(date)
    .toLowerCase();
  const day = date.getDate();
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} — ${hour}:${minute}`;
};

const getPointsSettingsForUser = (user: any) => {
  const outletId = user?.outletId || "all";
  const staffEmail = user?.email || "all";

  const getVal = (field: string, defaultValue: string): string => {
    // 1. Combo specific
    const keyCombo = `${field}_o_${outletId}_s_${staffEmail}`;
    const valCombo = localStorage.getItem(keyCombo);
    if (valCombo !== null) return valCombo;

    // 2. Staff specific
    const keyStaff = `${field}_o_all_s_${staffEmail}`;
    const valStaff = localStorage.getItem(keyStaff);
    if (valStaff !== null) return valStaff;

    // 3. Outlet specific
    const keyOutlet = `${field}_o_${outletId}_s_all`;
    const valOutlet = localStorage.getItem(keyOutlet);
    if (valOutlet !== null) return valOutlet;

    // 4. Global fallback
    return localStorage.getItem(field) || defaultValue;
  };

  const pointsValue = parseInt(getVal('pointsValue', '1000'));
  return { pointsValue };
};

export default function TransactionsPage() {
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [outletFilter, setOutletFilter] = useState<string>("all");
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [cashiers, setCashiers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Check if user is admin super
  const { user } = useAuth();
  const isAdminSuper = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Get outlets for filter
  const { data: outlets } = useListOutlets();

  const { data: transactions, isLoading } = useListTransactions({
    paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
    outletFilter: outletFilter === "all" ? undefined : outletFilter,
    cashierFilter: cashierFilter === "all" ? undefined : cashierFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 30,
    offset: (page - 1) * ITEMS_PER_PAGE
  });

  // Fetch unique cashiers from transactions
  useEffect(() => {
    if (isAdminSuper) {
      const fetchCashiers = async () => {
        const { data, error } = await supabase
          .from("transactions")
          .select("cashier_name")
          .not("cashier_name", "is", null);
          
        if (!error && data) {
          const uniqueCashiers = [...new Set(data.map(t => t.cashier_name))].filter(Boolean) as string[];
          setCashiers(uniqueCashiers);
        }
      };
      fetchCashiers();
    }
  }, [isAdminSuper]);

  const handlePrevious = () => {
    if (page > 1) setPage(p => p - 1);
  };

  const handleNext = () => {
    if ((transactions?.length || 0) >= ITEMS_PER_PAGE) {
      setPage(p => p + 1);
    }
  };

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value);
    setPage(1);
  };

  const getPointsValue = () => {
    return getPointsSettingsForUser(user).pointsValue;
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4 text-emerald-600" />;
      case 'qris': return <QrCode className="w-4 h-4 text-blue-600" />;
      case 'transfer': return <CreditCard className="w-4 h-4 text-purple-600" />;
      default: return <CreditCard className="w-4 h-4 text-slate-600" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Tunai';
      case 'debit_card': return 'Debit';
      case 'transfer': return 'Transfer';
      case 'qris': return 'QRIS';
      default: return method;
    }
  };

  const calculateTotal = (trx: any) => {
    const subtotal = trx.subtotal || 0;
    const tax = trx.tax || 0;
    const discount = trx.discount || 0;
    const pointsValue = getPointsValue();
    const pointsDiscount = (trx.points_used || 0) * pointsValue;
    return subtotal + tax - discount - pointsDiscount;
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex flex-row items-center justify-between gap-4 w-full">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <History className="w-6 h-6 text-primary animate-pulse shrink-0" />
              <span className="truncate">Riwayat Transaksi</span>
            </h1>

            {/* Filter Section (Popover) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="shrink-0 w-9 h-9 sm:w-auto sm:h-9 rounded-full sm:rounded-md p-0 sm:px-4 flex items-center justify-center sm:gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter Transaksi</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] max-w-[95vw] sm:w-[400px] p-4 sm:rounded-2xl shadow-xl">
                <div className="space-y-4">
                  <div className="font-semibold text-sm mb-2">Filter Data</div>
                  
                  {/* Date Filters */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">Rentang Tanggal</label>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                      <div className="relative w-full h-9">
                        <Input
                          type="text"
                          placeholder="Tanggal Mulai"
                          value={startDate ? startDate.split('-').reverse().join('-') : ""}
                          readOnly
                          className="absolute inset-0 h-9 w-full rounded-md text-sm text-center bg-transparent focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e: any) => { setStartDate(e.target.value); setPage(1); }}
                          onClick={(e: any) => {
                            try { e.target.showPicker?.(); } catch(err){}
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Tanggal Mulai"
                        />
                      </div>
                      <span className="text-slate-400 text-sm hidden sm:block">-</span>
                      <div className="relative w-full h-9">
                        <Input
                          type="text"
                          placeholder="Tanggal Akhir"
                          value={endDate ? endDate.split('-').reverse().join('-') : ""}
                          readOnly
                          className="absolute inset-0 h-9 w-full rounded-md text-sm text-center bg-transparent focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e: any) => { setEndDate(e.target.value); setPage(1); }}
                          onClick={(e: any) => {
                            try { e.target.showPicker?.(); } catch(err){}
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Tanggal Akhir"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Only show for admin super */}
                  {isAdminSuper && (
                    <>
                      {/* Outlet Filter */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Outlet</label>
                        <Select value={outletFilter} onValueChange={(v) => { setOutletFilter(v); setPage(1); }}>
                          <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                            <Building2 className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <SelectValue placeholder="Semua Outlet" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Outlet</SelectItem>
                            {outlets?.map((outlet: any) => (
                              <SelectItem key={outlet.id} value={outlet.id.toString()}>
                                {outlet.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Cashier Filter */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Kasir</label>
                        <Select value={cashierFilter} onValueChange={(v) => { setCashierFilter(v); setPage(1); }}>
                          <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                            <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <SelectValue placeholder="Semua Kasir" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Kasir</SelectItem>
                            {cashiers.map((cashier) => (
                              <SelectItem key={cashier} value={cashier}>
                                {cashier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Payment Method Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">Metode Pembayaran</label>
                    <Select value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                      <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                        <CreditCard className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        <SelectValue placeholder="Semua Metode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Metode</SelectItem>
                        <SelectItem value="cash">Tunai</SelectItem>
                        <SelectItem value="qris">QRIS</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="debit_card">Debit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-x-hidden pb-20">

          {/* ── MOBILE & TABLET: Card List ── */}
          <div className="flex flex-col gap-3 lg:hidden">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500">Memuat...</div>
            ) : transactions?.length === 0 ? (
              <div className="text-center py-10 text-slate-500">Tidak ada transaksi ditemukan</div>
            ) : (
              <>
                {transactions?.map(trx => {
                  const total = calculateTotal(trx);
                  const pointsUsed = trx.points_used || 0;
                  const pointsEarned = trx.points_earned || 0;
                  const customerName = trx.customers?.membership_type && trx.customers.membership_type !== 'non_member'
                    ? trx.customers.name
                    : "Umum";

                  return (
                    <Link key={trx.id} href={`/transactions/${trx.id}`}>
                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/20 hover:shadow-md active:bg-primary/5 transition-all duration-200">
                        {/* Row 1: Invoice + Total */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">
                              {formatInvoiceNumber(trx.id)}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {formatTransactionHistoryDate(trx.created_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary text-base whitespace-nowrap">
                              {formatRupiah(total)}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Customer + Cashier + Payment */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-slate-500">
                              <span className="font-medium text-slate-700">{customerName}</span>
                              {(pointsUsed > 0 || pointsEarned > 0) && (
                                <span className="inline-flex items-center gap-1 ml-2">
                                  {pointsUsed > 0 && (
                                    <span className="text-red-500 font-medium">-{pointsUsed}</span>
                                  )}
                                  {pointsUsed > 0 && pointsEarned > 0 && (
                                    <span className="text-slate-400">|</span>
                                  )}
                                  {pointsEarned > 0 && (
                                    <span className="text-emerald-600 font-medium">+{pointsEarned}</span>
                                  )}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-400">{trx.cashier_name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-700 whitespace-nowrap">
                            {getPaymentIcon(trx.payment_method)}
                            {getPaymentLabel(trx.payment_method)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Mobile/Tablet Pagination */}
                <div className="flex items-center justify-between px-2 py-3 border-t border-slate-200 mt-2">
                  <div className="text-sm text-slate-500">Halaman {page}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={page === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      disabled={transactions.length < ITEMS_PER_PAGE}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── DESKTOP LARGE: Table (hidden on tablet and below) ── */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>ID / Waktu</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead className="text-center">Poin</TableHead>
                  <TableHead className="text-center">Kasir</TableHead>
                  <TableHead>Metode Pembayaran</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell>
                  </TableRow>
                ) : transactions?.map(trx => {
                  const total = calculateTotal(trx);
                  const pointsUsed = trx.points_used || 0;
                  const pointsEarned = trx.points_earned || 0;

                  return (
                    <TableRow
                      key={trx.id}
                      className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                      onClick={() => window.location.href = `/transactions/${trx.id}`}
                    >
                      <TableCell>
                        <div className="font-medium">{formatInvoiceNumber(trx.id)}</div>
                        <div className="text-xs text-slate-500">{formatTransactionHistoryDate(trx.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {trx.customers?.membership_type && trx.customers.membership_type !== 'non_member'
                            ? trx.customers.name
                            : "Umum"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-sm">
                          {pointsUsed > 0 && (
                            <span className="text-red-500 font-semibold">-{pointsUsed}</span>
                          )}
                          {pointsEarned > 0 && (
                            <span className="text-emerald-600 font-semibold">+{pointsEarned}</span>
                          )}
                          {pointsUsed === 0 && pointsEarned === 0 && (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-slate-600">{trx.cashier_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 w-max rounded text-sm font-medium">
                          {getPaymentIcon(trx.payment_method)}
                          {getPaymentLabel(trx.payment_method)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatRupiah(total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {transactions?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Tidak ada transaksi ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {!isLoading && transactions && transactions.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                <div className="text-sm text-slate-500">
                  Halaman {page}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={page === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={transactions.length < ITEMS_PER_PAGE}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </Sidebar>
  );
}
