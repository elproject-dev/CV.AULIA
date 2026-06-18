import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetDashboardStats, useGetTopProducts, useGetRecentTransactions, useGetRevenueChart, useHealthCheck, useListTransactions, useGetCashierNames, useListOutlets, useListStaff, useAdvancedAnalytics } from "@workspace/api-client-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { getProductImageUrl } from "@/lib/supabase-storage";
import { formatRupiah } from "@/lib/formatters";
import { Activity, CreditCard, DollarSign, Package, Users, BarChart3, ShieldCheck, FileDown, Download, ChevronRight, WifiOff, Building2, UserCircle, LayoutDashboard, Crown, Star, TrendingUp, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DownloadExcelDialog, mapApiTransactionsToExport } from "@/components/excel-export";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, useAuthUserName } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/auth";
import { useCountUp } from "@/hooks/useCountUp";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CalendarRange, SlidersHorizontal, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // Online/Offline state
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Polling aktif untuk Android WebView karena navigator.onLine bisa bernilai true jika terhubung ke WiFi tanpa internet
    const interval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 detik timeout

        // Gunakan mode no-cors agar tidak terblokir CORS, dan tambahkan timestamp agar tidak di-cache oleh browser/ServiceWorker
        await fetch('https://www.google.com/favicon.ico?t=' + new Date().getTime(), {
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Default filter values - "all" for both
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [outletFilter, setOutletFilter] = useState<string>("all");

  // Date filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [tempEndDate, setTempEndDate] = useState<string>("");
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const [tempCashierFilter, setTempCashierFilter] = useState<string>("all");
  const [tempOutletFilter, setTempOutletFilter] = useState<string>("all");
  const [memberProductOutletFilter, setMemberProductOutletFilter] = useState<string>("all");
  const [memberProductDayFilter, setMemberProductDayFilter] = useState<string>("all");
  const [isMemberProductFilterOpen, setIsMemberProductFilterOpen] = useState(false);
  const [generalProductOutletFilter, setGeneralProductOutletFilter] = useState<string>("all");
  const [generalProductDayFilter, setGeneralProductDayFilter] = useState<string>("all");
  const [isGeneralProductFilterOpen, setIsGeneralProductFilterOpen] = useState(false);

  const [hourlyOutletFilter, setHourlyOutletFilter] = useState<string>("all");
  const [hourlyDayFilter, setHourlyDayFilter] = useState<string>("all");
  const [isHourlyFilterOpen, setIsHourlyFilterOpen] = useState(false);

  const [outletPerformanceDayFilter, setOutletPerformanceDayFilter] = useState<string>("all");
  const [isOutletPerformanceFilterOpen, setIsOutletPerformanceFilterOpen] = useState(false);

  const [topCustomersOutletFilter, setTopCustomersOutletFilter] = useState<string>("all");
  const [isTopCustomersFilterOpen, setIsTopCustomersFilterOpen] = useState(false);

  // Ref for auto-scrolling hourly chart to peak hour
  const hourlyScrollRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    if (isDateFilterOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      setTempCashierFilter(cashierFilter);
      setTempOutletFilter(outletFilter);
    }
  }, [isDateFilterOpen]);

  // Reset filters to default
  const handleResetFilters = () => {
    setCashierFilter("all");
    setOutletFilter("all");
    setStartDate("");
    setEndDate("");
    setTempStartDate("");
    setTempEndDate("");
    setTempCashierFilter("all");
    setTempOutletFilter("all");
  };

  const handleApplyDateFilter = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setCashierFilter(tempCashierFilter);
    setOutletFilter(tempOutletFilter);
    setIsDateFilterOpen(false);
  };

  const handleResetDateFilter = () => {
    setTempStartDate("");
    setTempEndDate("");
    setTempCashierFilter("all");
    setTempOutletFilter("all");
    // Do not close popup automatically, let user click Apply to confirm reset
  };

  // Check if user is admin super
  const isAdminSuper = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Get dynamic cashier names from database
  const { data: cashierNames } = useGetCashierNames();

  // Get outlets for filter
  const { data: outlets } = useListOutlets();

  // Get all staff for filter
  const { data: allStaff } = useListStaff({ outletId: "all" });

  // Get staff filtered by selected temp outlet
  const { data: filterStaffList } = useListStaff({ outletId: tempOutletFilter });

  // Reset staff filter if selected outlet changes
  useEffect(() => {
    if (tempOutletFilter !== "all" && tempCashierFilter !== "all" && filterStaffList && filterStaffList.length > 0) {
      const staffExistsInOutlet = filterStaffList.some((s: any) => s.name === tempCashierFilter);
      if (!staffExistsInOutlet) {
        setTempCashierFilter("all");
      }
    }
  }, [tempOutletFilter, filterStaffList]);

  // Bundle all filter parameters including date range
  const filterParams = { cashierFilter, outletFilter, startDate, endDate, memberProductOutletFilter, memberProductDayFilter, generalProductOutletFilter, generalProductDayFilter, hourlyOutletFilter, hourlyDayFilter, outletPerformanceDayFilter, topCustomersOutletFilter };

  const { data: stats } = useGetDashboardStats(filterParams);
  // Get all transactions for Excel export (without outlet filter)
  const { data: allTransactions } = useListTransactions({ limit: 10000, cashierFilter: "all", outletFilter: "all" });
  const { data: topProducts } = useGetTopProducts(filterParams);
  const { data: recentTransactions } = useGetRecentTransactions(filterParams);
  const { data: revenueChart } = useGetRevenueChart(filterParams);
  const { data: health } = useHealthCheck();
  const { data: advancedAnalytics } = useAdvancedAnalytics(filterParams);

  // Auto-scroll to peak hour when data loads
  useEffect(() => {
    if (advancedAnalytics?.hourlyAnalytics && hourlyScrollRef.current) {
      const data = advancedAnalytics.hourlyAnalytics;
      const peakIndex = data.reduce(
        (maxIdx: number, item: any, idx: number, arr: any[]) =>
          item.transactions > arr[maxIdx].transactions ? idx : maxIdx, 0
      );

      // Only scroll if peak hour has transactions
      if (data[peakIndex]?.transactions > 0) {
        const container = hourlyScrollRef.current;
        const innerWidth = 1500; // min-w-[1500px]
        const barWidth = innerWidth / 24;
        const scrollTarget = (peakIndex * barWidth) - (container.clientWidth / 2) + (barWidth / 2);

        setTimeout(() => {
          container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
        }, 300);
      }
    }
  }, [advancedAnalytics?.hourlyAnalytics]);

  // Check font size for responsive layout adjustments
  const currentFontSize = typeof window !== 'undefined' ? localStorage.getItem('fontSize') || 'small' : 'small';

  const chartData = revenueChart || Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString(), revenue: 0, transactions: 0 };
  });
  const chartMaxRevenue = Math.max(...chartData.map((point) => point.revenue || 0), 0);
  const chartTotalRevenue = chartData.reduce((sum, point) => sum + (point.revenue || 0), 0);
  const chartTotalTransactions = chartData.reduce((sum, point) => sum + (point.transactions || 0), 0);
  const hasChartData = chartTotalRevenue > 0 || chartTotalTransactions > 0;

  // Calculate comparison with yesterday
  const todayRevenue = stats?.totalRevenueToday || 0;
  const yesterdayRevenue = chartData.length >= 2 ? (chartData[chartData.length - 2]?.revenue || 0) : 0;
  const todayTransactions = stats?.transactionsToday || 0;
  const yesterdayTransactions = chartData.length >= 2 ? (chartData[chartData.length - 2]?.transactions || 0) : 0;

  // Revenue comparison
  const revenueChange = yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0;
  const revenueChangeText = revenueChange > 0 ? `+${revenueChange}% dari kemarin` : revenueChange < 0 ? `${revenueChange}% dari kemarin` : 'Tidak berubah';

  // Transactions comparison
  const transactionsChange = yesterdayTransactions > 0 ? Math.round(((todayTransactions - yesterdayTransactions) / yesterdayTransactions) * 100) : 0;
  const transactionsChangeText = transactionsChange > 0 ? `+${transactionsChange}% dari kemarin` : transactionsChange < 0 ? `${transactionsChange}% dari kemarin` : 'Tidak berubah';

  const getProductImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    return getProductImageUrl(imageUrl);
  };

  const transactionsForExport = mapApiTransactionsToExport(allTransactions || []);

  // Animated count-up values for stats cards
  const revenueToday = useCountUp(stats?.totalRevenueToday || 0, { duration: 1200 });
  const transactionsToday = useCountUp(stats?.transactionsToday || 0, { duration: 1000 });
  const totalCustomers = useCountUp(stats?.totalCustomers || 0, { duration: 1400 });
  const revenueMonth = useCountUp(stats?.totalRevenueMonth || 0, { duration: 1600 });

  // Helper for dynamic period label
  const getPeriodLabel = (prefix: string, isTodayDefault: string) => {
    if (!stats?.isCustomDateRange) return isTodayDefault;

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (startDate && endDate) {
      if (startDate === endDate) {
        return `${prefix} ${formatDate(startDate)}`;
      }
      return `${prefix} ${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else if (startDate) {
      return `${prefix} ${formatDate(startDate)}`;
    } else if (endDate) {
      return `${prefix} ${formatDate(endDate)}`;
    }

    return `${prefix} (Periode)`;
  };

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 lg:p-8 pb-6 md:pb-8 lg:pb-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">Dashboard Pro</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5 text-xs sm:text-sm font-normal">
              Hai, {user?.name || user?.email?.split('@')[0] || 'Pengguna'}! Selamat datang kembali...
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 sm:gap-3">
            <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-white dark:bg-slate-800 dark:border-slate-700 shrink-0 w-10 h-10 sm:w-auto sm:h-12 rounded-full p-0 sm:px-4 border-2 flex items-center justify-center sm:gap-2 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="hidden sm:inline font-medium">Filter</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] max-w-[95vw] sm:w-[400px] p-4 sm:rounded-2xl shadow-xl">
                <div className="flex items-center gap-2 font-semibold text-base mb-4 border-b pb-2">
                  <CalendarRange className="w-5 h-5 text-primary" />
                  Filter Dashboard
                </div>

                <div className="space-y-4">
                  {/* Date Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">Rentang Tanggal</Label>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                      <div className="relative w-full h-9">
                        <Input
                          type="text"
                          placeholder="Tanggal Mulai"
                          value={tempStartDate ? tempStartDate.split('-').reverse().join('-') : ""}
                          readOnly
                          className="absolute inset-0 h-9 w-full rounded-md text-sm text-center bg-transparent focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="date"
                          value={tempStartDate}
                          onChange={(e: any) => setTempStartDate(e.target.value)}
                          onClick={(e: any) => {
                            try { e.target.showPicker?.(); } catch (err) { }
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
                          value={tempEndDate ? tempEndDate.split('-').reverse().join('-') : ""}
                          readOnly
                          className="absolute inset-0 h-9 w-full rounded-md text-sm text-center bg-transparent focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="date"
                          value={tempEndDate}
                          onChange={(e: any) => setTempEndDate(e.target.value)}
                          onClick={(e: any) => {
                            try { e.target.showPicker?.(); } catch (err) { }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Tanggal Akhir"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Filter Outlet & Kasir (Khusus Admin) */}
                  {isAdminSuper && (
                    <>
                      {/* Outlet Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Filter Outlet</Label>
                        <Select value={tempOutletFilter} onValueChange={setTempOutletFilter}>
                          <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                            <Building2 className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <SelectValue placeholder="Semua Outlet" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Outlet</SelectItem>
                            {(outlets || []).map((outlet: any) => (
                              <SelectItem key={outlet.id} value={outlet.id.toString()}>
                                {outlet.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Cashier Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500">Filter Kasir</Label>
                        <Select value={tempCashierFilter} onValueChange={setTempCashierFilter}>
                          <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                            <UserCircle className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <SelectValue placeholder="Semua Kasir" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Kasir</SelectItem>
                            {(filterStaffList ? filterStaffList.filter((s: any) => s.role?.toLowerCase() === 'kasir').map((s: any) => s.name) : (cashierNames || [])).map((name: string) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2 justify-end mt-6">
                  <Button variant="outline" onClick={handleResetDateFilter} className="h-9 text-sm w-full sm:w-auto">
                    Atur Ulang
                  </Button>
                  <Button onClick={handleApplyDateFilter} className="h-9 px-6 text-sm w-full sm:w-auto">
                    Terapkan
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Profile Photo - Static Display */}
            <div className="relative inline-flex items-center justify-center shrink-0 border-0 bg-transparent p-0 cursor-default" title="Profil Pengguna">
              <div className={`absolute inset-0 rounded-full animate-ping opacity-40 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <div className={`relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base font-bold shadow-md border-2 animate-ring ${isOnline ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-red-500 text-red-700 bg-red-50'}`}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover flex-shrink-0" />
                ) : (
                  user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 items-stretch`}>
          {/* Pendapatan Hari Ini */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg h-full">
            <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-blue-100 text-xs sm:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{getPeriodLabel("Pendapatan", "Pendapatan Hari Ini")}</p>
                  <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1">
                    {formatRupiah(revenueToday.value)}
                  </p>
                </div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              </div>
              <p className={`text-xs mt-3 ${revenueChange >= 0 ? 'text-emerald-100' : 'text-red-100'}`}>{revenueChangeText}</p>
            </CardContent>
          </Card>

          {/* Transaksi Hari Ini */}
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg h-full">
            <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-purple-100 text-xs sm:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{getPeriodLabel("Transaksi", "Transaksi Hari Ini")}</p>
                  <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1">
                    {transactionsToday.value}
                  </p>
                </div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              </div>
              <p className={`text-xs mt-3 ${transactionsChange >= 0 ? 'text-emerald-100' : 'text-red-100'}`}>{transactionsChangeText}</p>
            </CardContent>
          </Card>

          {/* Total Pelanggan */}
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg h-full">
            <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-emerald-100 text-xs sm:text-sm font-medium">Total Pelanggan</p>
                  <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1">
                    {totalCustomers.value}
                  </p>
                </div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              </div>
              <p className="text-emerald-200 text-xs mt-3">+{stats?.newCustomersThisMonth || 0} {stats?.isCustomDateRange ? 'di periode ini' : 'bulan ini'}</p>
            </CardContent>
          </Card>

          {/* Total Penjualan */}
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-lg h-full">
            <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-amber-100 text-xs sm:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{getPeriodLabel("Pendapatan", "Pendapatan Bulan Ini")}</p>
                  <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1">
                    {formatRupiah(revenueMonth.value)}
                  </p>
                </div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              </div>
              <p className="text-amber-200 text-xs mt-3">{stats?.transactionsMonth || 0} transaksi</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="mb-6 shadow-lg border-0 bg-white">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100 text-base sm:text-lg">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              <span className="hidden sm:inline">Grafik Pendapatan Harian</span>
              <span className="sm:hidden">Pendapatan</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-48 sm:h-52 md:h-[220px] mt-4 w-full overflow-x-auto overflow-y-hidden scrollbar-slim">
              <div
                className="h-full pr-2 sm:pr-0"
                style={{ minWidth: chartData.length > 7 ? `${chartData.length * 56}px` : '100%' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="colorRevenueHover" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      </linearGradient>
                    </defs>

                    <XAxis
                      dataKey="date"
                      tickFormatter={(dateStr) => {
                        const date = new Date(dateStr);
                        return date.toLocaleDateString('id-ID', { weekday: 'short' });
                      }}
                      fontSize="0.6875rem"
                      tickLine={false}
                      axisLine={false}
                      stroke="#9ca3af"
                    />
                    <YAxis hide={true} />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const date = new Date(label);
                          return (
                            <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[120px] z-50">
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                {date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 tracking-wide">
                                {formatRupiah(data.revenue)}
                              </p>
                              <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                                {data.transactions} Transaksi
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="url(#colorRevenue)"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                      maxBarSize={48}
                      activeBar={{ fill: 'url(#colorRevenueHover)' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Bottom Section - Stack on mobile */}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Products */}
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span>Produk Terlaris</span>
                </CardTitle>
                {topProducts && topProducts.length > 0 && (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-600 text-[10px] px-2 font-normal">
                    Top 5
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              {topProducts && topProducts.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {(() => {
                    const topList = topProducts.slice(0, 5);
                    const maxSold = topList[0]?.totalSold || 1;

                    return topList.map((product, i) => {
                      const productImage = getProductImage(product.imageUrl);
                      const percentage = Math.max((product.totalSold / maxSold) * 100, 2);

                      return (
                        <div key={product.productId ?? i} className="flex flex-col gap-2 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-200">
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-50 dark:border-slate-800">
                              {productImage ? (
                                <img src={productImage} className="w-full h-full object-cover" alt={product.productName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : null}
                              <Package className={`w-5 h-5 text-slate-400 ${productImage ? 'hidden' : ''}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{product.productName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {product.totalSold} Terjual
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatRupiah(product.totalRevenue)}</p>
                            </div>
                          </div>

                          {/* Progress bar line */}
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Package className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">Belum ada produk terlaris</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Transaksi Terakhir</span>
                </CardTitle>
                {recentTransactions && recentTransactions.length > 0 && (
                  <a
                    href="/transactions"
                    className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-normal"
                  >
                    Lihat semua <ChevronRight className="w-3 h-3 inline-block" />
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              {recentTransactions && recentTransactions.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {(() => {
                    const topList = recentTransactions.slice(0, 5);
                    const maxTotal = topList.reduce((max, trx) => Math.max(max, trx.total), 1);

                    return topList.map((trx, i) => {
                      const percentage = Math.max((trx.total / maxTotal) * 100, 2);

                      return (
                        <div
                          key={trx.id || i}
                          onClick={() => trx.id && setLocation(`/transactions/${trx.id}`)}
                          className="flex flex-col gap-2 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 w-full">
                            {/* Customer Image */}
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
                              <span className="text-lg sm:text-xl font-medium text-primary-foreground">
                                {trx.customerName ? trx.customerName.charAt(0).toUpperCase() : 'U'}
                              </span>
                            </div>

                            {/* Customer Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight text-xs sm:text-sm truncate">{trx.customerName || "Umum"}</p>
                                <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-normal shrink-0">
                                  - {new Date(trx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                                {trx.outletName && trx.outletName !== '-' && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{trx.outletName.replace(/^Outlet\s+/i, '')}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Total & Kasir */}
                            <div className="text-right shrink-0 flex flex-col justify-center items-end">
                              {trx.cashierName && (
                                <p className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-normal mb-0.5 truncate max-w-[80px] sm:max-w-[120px]">
                                  <UserCircle className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{trx.cashierName}</span>
                                </p>
                              )}
                              <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">{formatRupiah(trx.total)}</p>
                            </div>
                          </div>

                          {/* Progress bar line */}
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">Belum ada transaksi</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Business Insights Section - Khusus Admin */}
        {isAdminSuper && advancedAnalytics && (
          <div className="mt-6 space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 px-1">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 fill-amber-500" /> Analisa Performa Bisnis
            </h2>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">

              {/* General Customer (Umum) Insights */}
              {advancedAnalytics.generalCustomerAnalytics && (
                <Card className="shadow-lg border-0 bg-white dark:bg-slate-900">
                  <CardHeader className="pb-3 px-4 pt-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" /> Analisa Produk (Umum)
                        </CardTitle>
                        <Badge variant="secondary" className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 h-5 font-normal">
                          {advancedAnalytics.generalCustomerAnalytics.percentageOfTotalRevenue.toFixed(1)}%
                        </Badge>
                      </div>
                      <Popover open={isGeneralProductFilterOpen} onOpenChange={setIsGeneralProductFilterOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="shrink-0 w-9 h-9 sm:w-auto sm:h-9 rounded-full p-0 sm:px-3 border-2 flex items-center justify-center sm:gap-2">
                            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            <span className="hidden sm:inline text-xs font-medium">Filter</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[260px] p-4 sm:rounded-2xl shadow-xl">
                          <div className="flex items-center gap-2 font-semibold text-sm mb-3 border-b pb-2">
                            <SlidersHorizontal className="w-4 h-4 text-primary" />
                            Filter Grafik
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Outlet</Label>
                              <Select value={generalProductOutletFilter} onValueChange={setGeneralProductOutletFilter}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Semua Outlet" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Semua Outlet</SelectItem>
                                  {outlets?.map((outlet: any) => (
                                    <SelectItem key={outlet.id} value={outlet.id.toString()}>{outlet.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Hari</Label>
                              <Select value={generalProductDayFilter} onValueChange={setGeneralProductDayFilter}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Semua Hari" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Semua Hari</SelectItem>
                                  <SelectItem value="1">Senin</SelectItem>
                                  <SelectItem value="2">Selasa</SelectItem>
                                  <SelectItem value="3">Rabu</SelectItem>
                                  <SelectItem value="4">Kamis</SelectItem>
                                  <SelectItem value="5">Jumat</SelectItem>
                                  <SelectItem value="6">Sabtu</SelectItem>
                                  <SelectItem value="0">Minggu</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="ghost"
                              className="w-full h-8 text-xs text-slate-500 hover:text-slate-700"
                              onClick={() => { setGeneralProductOutletFilter('all'); setGeneralProductDayFilter('all'); }}
                            >
                              Reset Filter
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className="space-y-2 mt-2 overflow-y-auto max-h-[430px] pr-2 scrollbar-slim">
                      {(() => {
                        const analyticsData = advancedAnalytics.generalProductAnalytics?.slice(0, 20) || [];
                        const maxQty = analyticsData[0]?.qty || 1;

                        return analyticsData.map((prod: any) => {
                          const productImage = getProductImage(prod.imageUrl);
                          const percentage = Math.max((prod.qty / maxQty) * 100, 2);

                          return (
                            <div key={prod.id} className="flex flex-col gap-2 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-200">
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-50 dark:border-slate-800">
                                  {productImage ? (
                                    <img src={productImage} className="w-full h-full object-cover" alt={prod.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ) : null}
                                  <Package className={`w-5 h-5 text-slate-400 ${productImage ? 'hidden' : ''}`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{prod.name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate" title="Pelanggan Umum">
                                    <Users className="w-3 h-3 inline-block shrink-0" /> <span className="truncate">Umum</span>
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{prod.qty} Terjual</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                                    <Building2 className="w-3 h-3 inline-block" /> {prod.topOutletName}
                                  </p>
                                </div>
                              </div>

                              {/* Progress bar line */}
                              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                      {(!advancedAnalytics.generalProductAnalytics || advancedAnalytics.generalProductAnalytics.length === 0) && (
                        <div className="text-center py-6">
                          <p className="text-xs text-slate-400">Belum ada data produk umum</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Product Analytics Deep Dive (Member) */}
              <Card className="shadow-lg border-0 bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" /> Analisa Produk (Member)
                      </CardTitle>
                      {advancedAnalytics.memberCustomerAnalytics && (
                        <Badge variant="secondary" className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 h-5 font-normal">
                          {advancedAnalytics.memberCustomerAnalytics.percentageOfTotalRevenue.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <Popover open={isMemberProductFilterOpen} onOpenChange={setIsMemberProductFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="shrink-0 w-9 h-9 sm:w-auto sm:h-9 rounded-full p-0 sm:px-3 border-2 flex items-center justify-center sm:gap-2">
                          <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          <span className="hidden sm:inline text-xs font-medium">Filter</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[260px] p-4 sm:rounded-2xl shadow-xl">
                        <div className="flex items-center gap-2 font-semibold text-sm mb-3 border-b pb-2">
                          <SlidersHorizontal className="w-4 h-4 text-primary" />
                          Filter Grafik
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Outlet</Label>
                            <Select value={memberProductOutletFilter} onValueChange={setMemberProductOutletFilter}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Semua Outlet" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Semua Outlet</SelectItem>
                                {outlets?.map((outlet: any) => (
                                  <SelectItem key={outlet.id} value={outlet.id.toString()}>{outlet.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Hari</Label>
                            <Select value={memberProductDayFilter} onValueChange={setMemberProductDayFilter}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Semua Hari" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Semua Hari</SelectItem>
                                <SelectItem value="1">Senin</SelectItem>
                                <SelectItem value="2">Selasa</SelectItem>
                                <SelectItem value="3">Rabu</SelectItem>
                                <SelectItem value="4">Kamis</SelectItem>
                                <SelectItem value="5">Jumat</SelectItem>
                                <SelectItem value="6">Sabtu</SelectItem>
                                <SelectItem value="0">Minggu</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            className="w-full h-8 text-xs text-slate-500 hover:text-slate-700"
                            onClick={() => { setMemberProductOutletFilter('all'); setMemberProductDayFilter('all'); }}
                          >
                            Reset Filter
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="space-y-2 mt-2 overflow-y-auto max-h-[430px] pr-2 scrollbar-slim">
                    {(() => {
                      const analyticsData = advancedAnalytics.memberProductAnalytics?.slice(0, 20) || [];
                      const maxQty = analyticsData[0]?.qty || 1;

                      return analyticsData.map((prod: any) => {
                        const productImage = getProductImage(prod.imageUrl);
                        const percentage = Math.max((prod.qty / maxQty) * 100, 2);

                        return (
                          <div key={prod.id} className="flex flex-col gap-2 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-200">
                            <div className="flex items-center gap-3 w-full">
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-50 dark:border-slate-800">
                                {productImage ? (
                                  <img src={productImage} className="w-full h-full object-cover" alt={prod.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                ) : null}
                                <Package className={`w-5 h-5 text-slate-400 ${productImage ? 'hidden' : ''}`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{prod.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate" title={prod.topCustomerName}>
                                  <Users className="w-3 h-3 inline-block shrink-0" /> <span className="truncate">{prod.topCustomerName}</span>
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{prod.qty} Terjual</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                                  <Building2 className="w-3 h-3 inline-block" /> {prod.topOutletName}
                                </p>
                              </div>
                            </div>

                            {/* Progress bar line */}
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                    {(!advancedAnalytics.memberProductAnalytics || advancedAnalytics.memberProductAnalytics.length === 0) && (
                      <div className="text-center py-6">
                        <p className="text-xs text-slate-400">Belum ada data produk member</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Customers */}
              <Card className="shadow-lg border-0 bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                      <Crown className="w-4 h-4 text-slate-400" /> Pelanggan Sultan
                    </CardTitle>
                    <div className="flex items-center gap-2">

                      <Popover open={isTopCustomersFilterOpen} onOpenChange={setIsTopCustomersFilterOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="shrink-0 w-9 h-9 sm:w-auto sm:px-3 p-0 sm:gap-2 rounded-full border-2 border-slate-200 flex items-center justify-center">
                            <SlidersHorizontal className="w-4 h-4 text-primary" />
                            <span className="hidden sm:inline-block text-xs font-medium">Filter</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[280px] p-4 sm:rounded-2xl shadow-xl border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-semibold text-sm mb-3 border-b pb-2">
                            <SlidersHorizontal className="w-4 h-4 text-primary" />
                            Filter Pelanggan
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Outlet</Label>
                              <Select value={topCustomersOutletFilter} onValueChange={setTopCustomersOutletFilter}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Semua Outlet" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Semua Outlet</SelectItem>
                                  {outlets?.map((outlet: any) => (
                                    <SelectItem key={outlet.id} value={outlet.id.toString()}>{outlet.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full h-8 text-xs mt-2 text-slate-600 dark:text-slate-400"
                              onClick={() => { setTopCustomersOutletFilter('all'); }}
                            >
                              Reset Filter
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  {advancedAnalytics.topCustomers && advancedAnalytics.topCustomers.length > 0 ? (
                    <div className="space-y-2 mt-2 overflow-y-auto max-h-[430px] pr-2 scrollbar-slim">
                      {(() => {
                        const topList = advancedAnalytics.topCustomers.slice(0, 20);
                        const maxSpent = topList[0]?.total_spent || 1;

                        return topList.map((customer: any, idx: number) => {
                          const percentage = Math.max((customer.total_spent / maxSpent) * 100, 2);

                          return (
                            <div key={customer.id || idx} className="flex flex-col gap-2 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-200">
                              <div className="flex items-center gap-3 w-full">
                                {/* Customer Image */}
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
                                  <span className="text-lg sm:text-xl font-medium text-primary-foreground">
                                    {customer.name?.charAt(0).toUpperCase()}
                                  </span>
                                </div>

                                {/* Customer Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{customer.name}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate" title={customer.outletName}>
                                    <Building2 className="w-3 h-3 shrink-0" /> <span className="truncate">{customer.outletName}</span>
                                  </p>
                                </div>

                                {/* Total & Points */}
                                <div className="text-right shrink-0 flex flex-col justify-center items-end">
                                  <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-normal mb-0.5">
                                    {(customer.points || 0).toLocaleString('id-ID')} Poin
                                  </p>
                                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {formatRupiah(customer.total_spent || 0)}
                                  </p>
                                </div>
                              </div>

                              {/* Progress bar line */}
                              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400">Belum ada pelanggan sultan</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Outlet Performance */}
              <Card className="shadow-lg border-0 bg-white dark:bg-slate-900">
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" /> Peringkat Outlet
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Popover open={isOutletPerformanceFilterOpen} onOpenChange={setIsOutletPerformanceFilterOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="shrink-0 w-9 h-9 sm:w-auto sm:px-3 p-0 sm:gap-2 rounded-full border-2 border-slate-200 flex items-center justify-center">
                            <SlidersHorizontal className="w-4 h-4 text-primary" />
                            <span className="hidden sm:inline-block text-xs font-medium">Filter</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[280px] p-4 sm:rounded-2xl shadow-xl border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-semibold text-sm mb-3 border-b pb-2">
                            <SlidersHorizontal className="w-4 h-4 text-primary" />
                            Filter Peringkat
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500">Hari</Label>
                              <Select value={outletPerformanceDayFilter} onValueChange={setOutletPerformanceDayFilter}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Semua Hari" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Semua Hari</SelectItem>
                                  <SelectItem value="1">Senin</SelectItem>
                                  <SelectItem value="2">Selasa</SelectItem>
                                  <SelectItem value="3">Rabu</SelectItem>
                                  <SelectItem value="4">Kamis</SelectItem>
                                  <SelectItem value="5">Jumat</SelectItem>
                                  <SelectItem value="6">Sabtu</SelectItem>
                                  <SelectItem value="0">Minggu</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full h-8 text-xs mt-2 text-slate-600 dark:text-slate-400"
                              onClick={() => { setOutletPerformanceDayFilter('all'); }}
                            >
                              Reset Filter
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  {advancedAnalytics.outletPerformance && advancedAnalytics.outletPerformance.length > 0 ? (
                    <div className="space-y-2 mt-2 overflow-y-auto max-h-[430px] pr-2 scrollbar-slim">
                      {(() => {
                        const topList = advancedAnalytics.outletPerformance.slice(0, 20);
                        const maxRevenue = topList[0]?.revenue || 1;

                        return topList.map((outlet: any, idx: number) => {
                          const percentage = Math.max((outlet.revenue / maxRevenue) * 100, 2);

                          return (
                            <div key={outlet.id} className="flex flex-col gap-2 p-2 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-200">
                              <div className="flex items-center gap-3 w-full">
                                {/* Outlet Badge */}
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
                                  <span className="text-lg sm:text-xl font-bold text-primary-foreground">
                                    {idx + 1}
                                  </span>
                                </div>

                                {/* Outlet Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{outlet.name}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {outlet.transactions} Transaksi
                                  </p>
                                </div>

                                {/* Revenue */}
                                <div className="text-right shrink-0 flex flex-col justify-center items-end">
                                  <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-normal mb-0.5">
                                    {outlet.percentage.toFixed(1)}% Kontribusi
                                  </p>
                                  <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {formatRupiah(outlet.revenue)}
                                  </p>
                                </div>
                              </div>

                              {/* Progress bar line */}
                              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400">Belum ada data outlet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Grafik Jam Sibuk */}
            {advancedAnalytics?.hourlyAnalytics && advancedAnalytics.hourlyAnalytics.length > 0 && (() => {
              // Find peak hour index
              const peakIndex = advancedAnalytics.hourlyAnalytics.reduce(
                (maxIdx: number, item: any, idx: number, arr: any[]) =>
                  item.transactions > arr[maxIdx].transactions ? idx : maxIdx, 0
              );

              return (
                <div className="mt-4 sm:mt-6">
                  <Card className="shadow-lg border-0 bg-white dark:bg-slate-900 w-full">
                    <CardHeader className="pb-3 px-4 pt-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" /> Jam Sibuk Transaksi (Rata-rata)
                        </CardTitle>
                        <Popover open={isHourlyFilterOpen} onOpenChange={setIsHourlyFilterOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="shrink-0 w-9 h-9 sm:w-auto sm:px-3 p-0 sm:gap-2 rounded-full border-2 border-slate-200 flex items-center justify-center">
                              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                              <span className="hidden sm:inline text-xs font-medium">Filter</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-[260px] p-4 sm:rounded-2xl shadow-xl">
                            <div className="flex items-center gap-2 font-semibold text-sm mb-3 border-b pb-2">
                              <SlidersHorizontal className="w-4 h-4 text-primary" />
                              Filter Grafik
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500">Outlet</Label>
                                <Select value={hourlyOutletFilter} onValueChange={setHourlyOutletFilter}>
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Semua Outlet" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Semua Outlet</SelectItem>
                                    {outlets?.map((outlet: any) => (
                                      <SelectItem key={outlet.id} value={outlet.id.toString()}>{outlet.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500">Hari</Label>
                                <Select value={hourlyDayFilter} onValueChange={setHourlyDayFilter}>
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Semua Hari" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Semua Hari</SelectItem>
                                    <SelectItem value="1">Senin</SelectItem>
                                    <SelectItem value="2">Selasa</SelectItem>
                                    <SelectItem value="3">Rabu</SelectItem>
                                    <SelectItem value="4">Kamis</SelectItem>
                                    <SelectItem value="5">Jumat</SelectItem>
                                    <SelectItem value="6">Sabtu</SelectItem>
                                    <SelectItem value="0">Minggu</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                variant="ghost"
                                className="w-full h-8 text-xs text-slate-500 hover:text-slate-700"
                                onClick={() => { setHourlyOutletFilter('all'); setHourlyDayFilter('all'); }}
                              >
                                Reset Filter
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </CardHeader>
                    <CardContent className="px-2 sm:px-4 pb-4">
                      <div
                        ref={hourlyScrollRef}
                        className="h-40 sm:h-44 md:h-[180px] w-full mt-4 overflow-x-auto overflow-y-hidden scrollbar-slim">
                        <div className="h-full min-w-[1500px] pr-6">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={advancedAnalytics.hourlyAnalytics} margin={{ top: 5, right: 15, left: -10, bottom: 5 }} barCategoryGap="80%">
                              <defs>
                                <linearGradient id="colorBar" x1="0" y1="1" x2="0" y2="0">
                                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="colorBarHover" x1="0" y1="1" x2="0" y2="0">
                                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                                </linearGradient>
                              </defs>

                              <XAxis
                                dataKey="hour"
                                fontSize="0.6875rem"
                                tickLine={false}
                                axisLine={false}
                                stroke="#9ca3af"
                                interval={0}
                              />
                              <YAxis
                                hide={true}
                              />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: '8px',
                                  border: '1px solid #f3f4f6',
                                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                                }}
                                formatter={(value: number) => [`${value} Transaksi`, 'Total Transaksi']}
                                labelFormatter={(label: string) => `Jam ${label}`}
                                cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                              />
                              <Bar
                                dataKey="transactions"
                                fill="url(#colorBar)"
                                radius={[6, 6, 0, 0]}
                                barSize={32}
                                maxBarSize={48}
                                activeBar={{ fill: 'url(#colorBarHover)' }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </div>
        )}

        {/* Download Report Card */}
        <div className="mt-6 mb-0">
          <Card
            className="shadow-lg border-0 bg-gradient-to-r from-slate-700 to-slate-800 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
            onClick={() => setShowDownloadDialog(true)}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/10 flex items-center justify-center">
                    <FileDown className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm sm:text-base">Download Laporan Excel</h3>
                    <p className="text-slate-300 text-xs sm:text-sm mt-0.5 font-normal">Ekspor data transaksi ke file Excel</p>
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Download className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Download Excel Dialog - using reusable component */}
      <DownloadExcelDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        transactions={transactionsForExport}
        branchName="SBAGIAMU"
        cashierDefault="Admin Kasir"
        isAdmin={isAdminSuper}
        outlets={outlets || []}
        outletFilter={outletFilter}
        staffList={allStaff ? allStaff.filter((s: any) => s.role?.toLowerCase() === 'kasir') : []}
      />
    </Sidebar>
  );
}