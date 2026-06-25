import { useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  useListVisitSchedules,
  useCreateVisitSchedule,
  useUpdateVisitSchedule,
  useDeleteVisitSchedule,
  useListVisitLogs,
  useCreateVisitLog,
  useListStaff,
} from "@/mocks/api-client-react";
import { useListCustomers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/auth";
import { Capacitor } from "@capacitor/core";
import {
  CalendarDays,
  Plus,
  MapPin,
  Check,
  ChevronsUpDown,
  Navigation,
  Trash2,
  Edit,
  Clock,
  User,
  Phone,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Map,
  History,
  Store,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { id: 1, short: "Sen", label: "Senin" },
  { id: 2, short: "Sel", label: "Selasa" },
  { id: 3, short: "Rab", label: "Rabu" },
  { id: 4, short: "Kam", label: "Kamis" },
  { id: 5, short: "Jum", label: "Jumat" },
  { id: 6, short: "Sab", label: "Sabtu" },
  { id: 7, short: "Min", label: "Minggu" },
];

function getTodayDayId(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
  if (jsDay === 0) return 7; // Minggu
  return jsDay; // 1=Senin ... 6=Sabtu
}

function formatVisitedAt(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function isDateInCurrentWeek(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    const now = new Date();

    // Get start of current week (Monday)
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get end of current week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return date >= startOfWeek && date <= endOfWeek;
  } catch {
    return false;
  }
}

async function getLocationNative(): Promise<{ latitude: number; longitude: number }> {
  // Use Capacitor Geolocation on Android native
  if (Capacitor.isNativePlatform()) {
    try {
      // Access Capacitor plugin via window object (registered by native layer)
      const Geolocation = (window as any).Capacitor?.Plugins?.Geolocation;
      if (Geolocation) {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted") {
          throw new Error("Izin lokasi ditolak. Aktifkan izin GPS di pengaturan.");
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
    } catch (e: any) {
      if (e.message?.includes("Izin")) throw e;
      // Fall through to browser geolocation if plugin not available
    }
  }
  // Fallback for browser / web
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Perangkat tidak mendukung GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error("Gagal mendapatkan lokasi: " + err.message)),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

const cleanNotes = (notes: string | null | undefined) => {
  if (!notes) return "";
  return notes.replace(/\s*\[verified\]\s*/g, "").trim();
};

export default function VisitSchedulePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminMode(user);

  const [activeTab, setActiveTab] = useState<"schedule" | "history">("schedule");
  const [selectedDay, setSelectedDay] = useState<number>(getTodayDayId());
  const [scheduleSalesFilter, setScheduleSalesFilter] = useState<string>("all");
  const [logSalesFilter, setLogSalesFilter] = useState<string>("all");
  const [logDayFilter, setLogDayFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [checkingLog, setCheckingLog] = useState<any>(null);
  const [verifiedLogs, setVerifiedLogs] = useState<Record<number, boolean>>(() => {
    try {
      const stored = localStorage.getItem("kasir_verified_logs");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null); // schedule id being tracked
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [pendingCheckIn, setPendingCheckIn] = useState<any>(null);
  const [checkInNotes, setCheckInNotes] = useState("");

  const [formData, setFormData] = useState<any>({
    customer_id: "",
    day_of_week: "1",
    visit_time: "",
    notes: "",
    sales_name: "",
  });
  const [customerOpen, setCustomerOpen] = useState(false);

  const { data: schedules, isLoading: schedulesLoading, refetch: refetchSchedules } = useListVisitSchedules();
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useListVisitLogs({ limit: 200 });
  const { data: customers } = useListCustomers();
  const { data: staffList } = useListStaff({});
  const createSchedule = useCreateVisitSchedule();
  const updateSchedule = useUpdateVisitSchedule();
  const deleteSchedule = useDeleteVisitSchedule();
  const createLog = useCreateVisitLog();

  // Names of admins to exclude from sales options
  const adminNames = useMemo(() => {
    const names = new Set<string>();
    names.add("Admin");
    if (user?.role === "admin" && user?.name) {
      names.add(user.name);
    }
    (staffList || []).forEach((s: any) => {
      if ((s.role === 'admin' || s.role === 'developer') && s.name) {
        names.add(s.name);
      }
    });
    return names;
  }, [staffList, user]);

  // Active staff list for sales dropdown (excluding admins)
  const activeSalesList = useMemo(() => {
    return (staffList || []).filter(
      (s: any) => s.status === 'active' && s.name && s.role !== 'admin' && s.role !== 'developer'
    );
  }, [staffList]);

  const visibleSchedules = useMemo(() => {
    let list = schedules || [];
    if (!isAdmin && user?.name) {
      return list.filter((s: any) => s.sales_name === user.name);
    }
    return list;
  }, [schedules, isAdmin, user?.name]);

  const visibleLogs = useMemo(() => {
    let list = logs || [];
    if (!isAdmin && user?.name) {
      return list.filter((l: any) => l.sales_name === user.name);
    }
    return list;
  }, [logs, isAdmin, user?.name]);

  // Unique sales names from schedules (excluding admins)
  const uniqueSalesNames = useMemo(() => {
    const names = visibleSchedules
      .map((s: any) => s.sales_name)
      .filter((name: string) => name && !adminNames.has(name));
    return Array.from(new Set(names)).sort() as string[];
  }, [visibleSchedules, adminNames]);

  // Unique sales names from logs (excluding admins)
  const uniqueLogSalesNames = useMemo(() => {
    const names = visibleLogs
      .map((l: any) => l.sales_name)
      .filter((name: string) => name && !adminNames.has(name));
    return Array.from(new Set(names)).sort() as string[];
  }, [visibleLogs, adminNames]);

  const filteredSchedules = useMemo(
    () =>
      scheduleSalesFilter === "all"
        ? visibleSchedules
        : visibleSchedules.filter((s: any) => s.sales_name === scheduleSalesFilter),
    [visibleSchedules, scheduleSalesFilter]
  );

  const filteredLogs = useMemo(() => {
    let list = visibleLogs;
    if (logSalesFilter !== "all") {
      list = list.filter((l: any) => l.sales_name === logSalesFilter);
    }
    if (logDayFilter !== "all") {
      const targetDay = parseInt(logDayFilter);
      list = list.filter((l: any) => {
        if (!l.visited_at) return false;
        const jsDay = new Date(l.visited_at).getDay(); // 0=Sun, 1=Mon...6=Sat
        const dayId = jsDay === 0 ? 7 : jsDay;
        return dayId === targetDay;
      });
    }
    return list;
  }, [visibleLogs, logSalesFilter, logDayFilter]);

  // Check if a schedule has been visited this week
  const visitedScheduleIdsToday = useMemo(() => {
    const visitedSet = new Set<number>();
    (logs || []).forEach((log: any) => {
      if (log.schedule_id && log.visited_at) {
        if (isDateInCurrentWeek(log.visited_at)) {
          visitedSet.add(log.schedule_id);
        }
      }
    });
    return visitedSet;
  }, [logs]);

  const schedulesForDay = useMemo(
    () => filteredSchedules.filter((s: any) => s.day_of_week === selectedDay),
    [filteredSchedules, selectedDay]
  );

  const handleOpenDialog = (schedule?: any) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        customer_id: schedule.customer_id?.toString() || "",
        day_of_week: schedule.day_of_week?.toString() || "1",
        visit_time: schedule.visit_time || "",
        notes: schedule.notes || "",
        sales_name: schedule.sales_name || user?.name || "",
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        customer_id: "",
        day_of_week: selectedDay.toString(),
        visit_time: "",
        notes: "",
        sales_name: isAdmin ? (scheduleSalesFilter !== "all" ? scheduleSalesFilter : "") : (user?.name || ""),
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.customer_id) {
      toast({ title: "Perhatian", description: "Pilih pelanggan terlebih dahulu", variant: "destructive" });
      return;
    }

    if (isAdmin && !formData.sales_name) {
      toast({ title: "Perhatian", description: "Pilih sales terlebih dahulu", variant: "destructive" });
      return;
    }

    const selectedCustomer = customers?.find((c: any) => c.id.toString() === formData.customer_id);
    const selectedSales = staffList?.find((s: any) => s.name === (formData.sales_name || user?.name));

    const payload: any = {
      customer_id: parseInt(formData.customer_id),
      customer_name: selectedCustomer?.name || "",
      sales_name: formData.sales_name || user?.name || "Sales",
      staff_id: selectedSales?.id || user?.staffId || null,
      day_of_week: parseInt(formData.day_of_week),
      visit_time: formData.visit_time || null,
      notes: formData.notes || null,
      is_active: true,
    };

    if (editingSchedule) {
      updateSchedule.mutate(
        { id: editingSchedule.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Berhasil", description: "Jadwal diperbarui" });
            setIsDialogOpen(false);
            refetchSchedules();
          },
          onError: () =>
            toast({ title: "Error", description: "Gagal memperbarui jadwal", variant: "destructive" }),
        }
      );
    } else {
      createSchedule.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Berhasil", description: "Jadwal ditambahkan" });
            setIsDialogOpen(false);
            refetchSchedules();
          },
          onError: () =>
            toast({ title: "Error", description: "Gagal menambahkan jadwal", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Hapus jadwal kunjungan ini?")) return;
    deleteSchedule.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Berhasil", description: "Jadwal dihapus" });
          refetchSchedules();
        },
        onError: () =>
          toast({ title: "Error", description: "Gagal menghapus jadwal", variant: "destructive" }),
      }
    );
  };

  const handleStartVisit = async (schedule: any) => {
    setTrackingId(schedule.id);
    try {
      toast({ title: "📍 Mengambil lokasi...", description: "Mohon tunggu sebentar" });
      const position = await getLocationNative();

      // Store pending check-in and open notes dialog
      setPendingCheckIn({ schedule, position });
      setCheckInNotes("");
      setNotesDialogOpen(true);
    } catch (err: any) {
      toast({
        title: "Gagal GPS",
        description: err.message || "Tidak dapat mengambil lokasi",
        variant: "destructive",
      });
    } finally {
      setTrackingId(null);
    }
  };

  const handleConfirmCheckIn = () => {
    if (!pendingCheckIn) return;
    const { schedule, position } = pendingCheckIn;
    const mapsUrl = `https://maps.google.com/?q=${position.latitude},${position.longitude}`;

    createLog.mutate(
      {
        data: {
          schedule_id: schedule.id,
          customer_id: schedule.customer_id,
          customer_name: schedule.customer_name || schedule.customers?.name || "",
          sales_name: user?.name || "Sales",
          visited_at: new Date().toISOString(),
          latitude: position.latitude,
          longitude: position.longitude,
          location_address: mapsUrl,
          notes: checkInNotes || null,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "✅ Check-in Berhasil!",
            description: `Kunjungan ke ${schedule.customer_name || schedule.customers?.name} berhasil dicatat`,
          });
          setNotesDialogOpen(false);
          setPendingCheckIn(null);
          setCheckInNotes("");
          refetchLogs();
        },
        onError: () =>
          toast({ title: "Error", description: "Gagal menyimpan kunjungan", variant: "destructive" }),
      }
    );
  };

  const handleVerifyLog = async (logId: number) => {
    const log = (logs || []).find((l: any) => l.id === logId);
    const currentNotes = log?.notes || "";
    const newNotes = currentNotes.includes("[verified]")
      ? currentNotes
      : (currentNotes ? `${currentNotes} [verified]` : "[verified]");

    try {
      const { error } = await supabase
        .from("visit_logs")
        .update({ notes: newNotes })
        .eq("id", logId);

      if (error) throw error;

      const updated = { ...verifiedLogs, [logId]: true };
      setVerifiedLogs(updated);
      localStorage.setItem("kasir_verified_logs", JSON.stringify(updated));

      toast({
        title: "Validasi Sukses",
        description: "Lokasi kunjungan terverifikasi valid.",
      });

      refetchLogs();
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Gagal memvalidasi kunjungan di database.",
        variant: "destructive",
      });
    } finally {
      setCheckingLog(null);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const dayScheduleCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    filteredSchedules.forEach((s: any) => {
      counts[s.day_of_week] = (counts[s.day_of_week] || 0) + 1;
    });
    return counts;
  }, [filteredSchedules]);

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header — matches products.tsx pattern */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-primary animate-pulse" />
            Jadwal Kunjungan Sales
          </h1>
          {isAdmin && (
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
              </Button>
            </div>
          )}
        </div>

        {/* Tabs — underline style matching products.tsx */}
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("schedule")}
              className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === "schedule"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              <CalendarDays className="w-4 h-4" />
              Jadwal
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              <History className="w-4 h-4" />
              Riwayat
            </button>
          </div>
          {isAdmin && (
            <div className="block sm:hidden flex-shrink-0">
              {activeTab === "schedule" && uniqueSalesNames.length > 0 && (
                <Select value={scheduleSalesFilter} onValueChange={(v) => setScheduleSalesFilter(v)}>
                  <SelectTrigger className="w-[120px] h-8 text-[11px] rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm border">
                    <SelectValue placeholder="Pilih sales..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[11px]">Semua Sales</SelectItem>
                    {uniqueSalesNames.map((name) => (
                      <SelectItem key={name} value={name} className="text-[11px]">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {activeTab === "history" && uniqueLogSalesNames.length > 0 && (
                <Select value={logSalesFilter} onValueChange={(v) => setLogSalesFilter(v)}>
                  <SelectTrigger className="w-[120px] h-8 text-[11px] rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm border">
                    <SelectValue placeholder="Pilih sales..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[11px]">Semua Sales</SelectItem>
                    {uniqueLogSalesNames.map((name) => (
                      <SelectItem key={name} value={name} className="text-[11px]">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day tabs + Sales filter bar */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Day tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                  {DAYS.map((day) => {
                    const isToday = day.id === getTodayDayId();
                    const isSelected = day.id === selectedDay;
                    const count = dayScheduleCounts[day.id] || 0;
                    return (
                      <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={cn(
                          "flex flex-row items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 flex-shrink-0 border text-xs font-semibold",
                          isSelected
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm scale-105"
                            : isToday
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        )}
                      >
                        {count > 0 && (
                          <span
                            className={cn(
                              "text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                              isSelected
                                ? "bg-white text-primary"
                                : "bg-primary text-primary-foreground"
                            )}
                          >
                            {count}
                          </span>
                        )}
                        <span>{day.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sales filter */}
                {isAdmin && uniqueSalesNames.length > 0 && (
                  <div className="hidden sm:block flex-shrink-0">
                    <Select
                      value={scheduleSalesFilter}
                      onValueChange={(v) => setScheduleSalesFilter(v)}
                    >
                      <SelectTrigger className="w-[180px] h-9 text-xs rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Pilih sales..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">Semua Sales</SelectItem>
                        {uniqueSalesNames.map((name) => (
                          <SelectItem key={name} value={name} className="text-xs">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Schedule list */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {DAYS.find((d) => d.id === selectedDay)?.label}
                  {getTodayDayId() === selectedDay && (
                    <Badge className="text-[10px] px-2 py-0 bg-primary text-primary-foreground">Hari Ini</Badge>
                  )}
                </h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {schedulesForDay.length} kunjungan
                </span>
              </div>

              {schedulesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : schedulesForDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">
                    Belum ada jadwal kunjungan
                  </p>
                  {isAdmin && (
                    <>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Klik tombol + untuk menambah jadwal
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4 gap-2"
                        onClick={() => handleOpenDialog()}
                      >
                        <Plus className="w-4 h-4" /> Tambah Jadwal
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {schedulesForDay.map((schedule: any, idx: number) => {
                    const customer = schedule.customers || {};
                    const name = schedule.customer_name || customer.name || "—";
                    const phone = customer.phone || "—";
                    const mainAddress = customer.address || null;
                    const districtAndCity = (customer.district || customer.city)
                      ? `${customer.district ? `Kec. ${customer.district}` : ""}${customer.district && customer.city ? ", " : ""}${customer.city ? `Kab. ${customer.city}` : ""}`
                      : null;
                    const isTracking = trackingId === schedule.id;

                    // Find this week's log for this schedule to check verification status
                    const todayLogForSchedule = (logs || []).find((log: any) => {
                      return (
                        log.schedule_id === schedule.id &&
                        log.visited_at &&
                        isDateInCurrentWeek(log.visited_at)
                      );
                    });

                    return (
                      <div
                        key={schedule.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
                      >
                        {/* Card body */}
                        <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 items-center justify-center text-primary font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                {name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <Phone className="w-3 h-3 flex-shrink-0 text-primary" />
                                <span>{phone}</span>
                              </div>
                              {(mainAddress || districtAndCity) && (
                                <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-primary" />
                                  <div className="flex flex-col">
                                    {mainAddress && <span className="line-clamp-2">{mainAddress}</span>}
                                    {districtAndCity && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                                        {districtAndCity}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {schedule.notes && (
                                <p className="mt-1.5 text-xs text-slate-400 italic line-clamp-1">
                                  "{schedule.notes}"
                                </p>
                              )}
                              {todayLogForSchedule && (
                                <Badge className="bg-primary hover:bg-primary text-primary-foreground border-transparent font-semibold rounded-lg text-[10px] h-6 px-2 flex items-center justify-center gap-1 mt-2 shadow-sm w-max">
                                  <Clock className="w-3 h-3 text-primary-foreground" />
                                  Check-in: {formatVisitedAt(todayLogForSchedule.visited_at)}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Right status / actions container (anchored to the far-right edge) */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-2 self-center ml-auto min-h-[40px]">
                            {/* Visit Time Badge at the top right of the card body */}
                            {schedule.visit_time && (
                              <Badge variant="secondary" className="text-[10px] flex-shrink-0 gap-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-none font-medium h-5 px-1.5 shadow-none rounded-md">
                                <Clock className="w-3 h-3" />
                                {schedule.visit_time}
                              </Badge>
                            )}

                            {/* Status Badge / Admin Verification Action */}
                            {isAdmin ? (
                              todayLogForSchedule ? (
                                (verifiedLogs[todayLogForSchedule.id] || (todayLogForSchedule.notes && todayLogForSchedule.notes.includes('[verified]'))) ? (
                                  <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent font-semibold rounded-lg text-[10px] h-7 px-2.5 flex items-center justify-center gap-1 shadow-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    Selesai
                                  </Badge>
                                ) : (
                                  <div className="flex flex-col sm:flex-row gap-1">
                                    {todayLogForSchedule.latitude && todayLogForSchedule.longitude && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2.5 gap-1.5 text-[11px] border-primary/30 text-primary hover:bg-primary/5 rounded-lg font-semibold shadow-sm"
                                        onClick={() => openInMaps(todayLogForSchedule.latitude, todayLogForSchedule.longitude)}
                                      >
                                        <Map className="w-3.5 h-3.5" />
                                        Periksa
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      className="h-7 px-2.5 gap-1.5 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold shadow-sm"
                                      onClick={() => handleVerifyLog(todayLogForSchedule.id)}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Konfirmasi
                                    </Button>
                                  </div>
                                )
                              ) : (
                                <Badge className="bg-slate-400 dark:bg-slate-700 text-white border-transparent font-semibold rounded-full text-[10px] h-5 px-2.5 shadow-sm">
                                  Pending
                                </Badge>
                              )
                            ) : (
                              visitedScheduleIdsToday.has(schedule.id) && (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent font-semibold rounded-full text-[10px] h-5 px-2.5 shadow-sm">
                                  Selesai
                                </Badge>
                              )
                            )}
                          </div>
                        </div>

                        {/* Card footer — matches products.tsx pattern */}
                        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 px-3">
                          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                            <User className="w-3 h-3" />
                            <span className="truncate">{schedule.sales_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-slate-500 hover:text-primary"
                                  onClick={() => handleOpenDialog(schedule)}
                                >
                                  <Edit className="w-3.5 h-3.5 mr-1" />
                                  <span className="text-xs">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => handleDelete(schedule.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            {!isAdmin && (
                              visitedScheduleIdsToday.has(schedule.id) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1.5 text-xs font-semibold rounded-lg border-green-200 bg-green-50/50 text-green-600 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50 hover:bg-green-100 hover:text-green-700"
                                  onClick={() => handleStartVisit(schedule)}
                                  disabled={isTracking || createLog.isPending}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Kunjungi Lagi
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className={cn(
                                    "h-7 gap-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all",
                                    isTracking
                                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                                      : ""
                                  )}
                                  onClick={() => !isTracking && handleStartVisit(schedule)}
                                  disabled={isTracking || createLog.isPending}
                                >
                                  {isTracking ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      GPS...
                                    </>
                                  ) : (
                                    <>
                                      <Navigation className="w-3.5 h-3.5" />
                                      Kunjungi
                                    </>
                                  )}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-row items-center justify-between gap-2 mb-4">
              <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 sm:gap-2 min-w-0">
                <History className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">Riwayat Kunjungan</span>
              </h2>
              {/* Filters for history */}
              <div className="flex gap-2 items-center shrink-0">
                {/* Sales filter for history */}
                {isAdmin && uniqueLogSalesNames.length > 0 && (
                  <div className="hidden sm:block">
                    <Select
                      value={logSalesFilter}
                      onValueChange={(v) => setLogSalesFilter(v)}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Pilih sales..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">Semua Sales</SelectItem>
                        {uniqueLogSalesNames.map((name) => (
                          <SelectItem key={name} value={name} className="text-xs">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Day filter for history */}
                <Select
                  value={logDayFilter}
                  onValueChange={(v) => setLogDayFilter(v)}
                >
                  <SelectTrigger className="w-[110px] sm:w-[150px] h-8 text-[11px] sm:text-xs rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Semua Hari" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Hari</SelectItem>
                    {DAYS.map((day) => (
                      <SelectItem key={day.id} value={day.id.toString()} className="text-xs">
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {logsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  {logSalesFilter !== "all" || logDayFilter !== "all"
                    ? "Belum ada riwayat dengan kriteria filter tersebut"
                    : "Belum ada riwayat kunjungan"}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Klik "Kunjungi" pada jadwal untuk mencatat kunjungan
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log: any, idx: number) => (
                  <div
                    key={log.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {log.customer_name || "—"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <User className="w-3 h-3" />
                            <span>{log.sales_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatVisitedAt(log.visited_at)}</span>
                          </div>
                          {cleanNotes(log.notes) && (
                            <p className="mt-1.5 text-xs text-slate-400 italic">"{cleanNotes(log.notes)}"</p>
                          )}
                        </div>
                      </div>

                      {/* Status Badges on the far right side of the history card */}
                      <div className="flex-shrink-0 flex flex-col sm:flex-row items-center gap-1.5 self-center ml-auto">
                        <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent font-semibold rounded-full text-[10px] h-5 px-2 shadow-sm">
                          Selesai
                        </Badge>
                        {(verifiedLogs[log.id] || (log.notes && log.notes.includes('[verified]'))) ? (
                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-transparent font-semibold rounded-full text-[10px] h-5 px-2 shadow-sm">
                            Valid
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-transparent font-semibold rounded-full text-[10px] h-5 px-2 shadow-sm">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {log.latitude && log.longitude && (
                      <div className="px-3 sm:px-4 pb-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="font-mono">
                            {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                          </span>
                        </div>
                        <a
                          href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:underline flex items-center gap-1 font-medium"
                        >
                          <Map className="w-3 h-3 text-primary" />
                          Buka Peta
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Schedule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {editingSchedule ? "Edit Jadwal Kunjungan" : "Tambah Jadwal Kunjungan"}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule
                ? "Perbarui informasi jadwal kunjungan"
                : "Atur jadwal kunjungan sales ke toko pelanggan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Sales picker — shown to admin only; non-admin sees their own name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Sales <span className="text-red-500">*</span>
              </label>
              {isAdmin ? (
                <Select
                  value={formData.sales_name}
                  onValueChange={(v) => setFormData({ ...formData, sales_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih sales..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {activeSalesList.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                            {s.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span>{s.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                    {(formData.sales_name || user?.name || "").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    {formData.sales_name || user?.name || "—"}
                  </span>
                </div>
              )}
            </div>

            {/* Customer selection */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Pelanggan / Toko <span className="text-red-500">*</span>
              </label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between h-10 px-3 font-normal"
                  >
                    {formData.customer_id
                      ? customers?.find((c: any) => c.id.toString() === formData.customer_id)?.name
                      : "Pilih pelanggan..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cari pelanggan..." />
                    <CommandList className="max-h-[220px]">
                      <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {(customers || []).map((c: any) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.phone || ""}`}
                            onSelect={() => {
                              setFormData({ ...formData, customer_id: c.id.toString() })
                              setCustomerOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.customer_id === c.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{c.name}</span>
                              {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Day of week */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Hari Kunjungan <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, day_of_week: day.id.toString() })}
                    className={cn(
                      "py-2 rounded-lg text-xs font-semibold transition-all border",
                      formData.day_of_week === day.id.toString()
                        ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                        : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Visit time */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Jam Kunjungan <span className="text-slate-400 text-xs">(opsional)</span>
              </label>
              <Input
                type="time"
                value={formData.visit_time}
                onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                className="w-full"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Catatan <span className="text-slate-400 text-xs">(opsional)</span>
              </label>
              <Input
                placeholder="Misal: Tanya stok bulan ini..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.customer_id ||
                createSchedule.isPending ||
                updateSchedule.isPending
              }
            >
              {createSchedule.isPending || updateSchedule.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-in Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-green-500" />
              Konfirmasi Kunjungan
            </DialogTitle>
            <DialogDescription>
              Selesaikan check-in kunjungan hari ini
            </DialogDescription>
          </DialogHeader>

          {pendingCheckIn && (
            <div className="py-2 space-y-4">
              {/* Store info */}
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                    {pendingCheckIn.schedule.customer_name ||
                      pendingCheckIn.schedule.customers?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono">
                    {pendingCheckIn.position.latitude.toFixed(6)},{" "}
                    {pendingCheckIn.position.longitude.toFixed(6)}
                  </span>
                </div>
              </div>

              {/* Notes input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Catatan Kunjungan
                </label>
                <Input
                  placeholder="Hasil kunjungan, pesanan, dll..."
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmCheckIn()}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNotesDialogOpen(false);
                setPendingCheckIn(null);
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmCheckIn}
              disabled={createLog.isPending}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {createLog.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Check-in Sekarang
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Location Verification Dialog */}
      <Dialog open={!!checkingLog} onOpenChange={(open) => !open && setCheckingLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Pemeriksaan Lokasi Kunjungan
            </DialogTitle>
            <DialogDescription>
              Validasi koordinat GPS sales saat melakukan check-in
            </DialogDescription>
          </DialogHeader>

          {checkingLog && (
            <div className="py-2 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-[100px_1fr] text-xs gap-y-2">
                  <span className="text-slate-400 font-medium">Toko:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {checkingLog.customer_name}
                  </span>

                  <span className="text-slate-400 font-medium">Sales:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {checkingLog.sales_name}
                  </span>

                  <span className="text-slate-400 font-medium">Waktu:</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatVisitedAt(checkingLog.visited_at)}
                  </span>

                  <span className="text-slate-400 font-medium">Koordinat:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {checkingLog.latitude.toFixed(6)}, {checkingLog.longitude.toFixed(6)}
                  </span>

                  {checkingLog.notes && (
                    <>
                      <span className="text-slate-400 font-medium">Catatan:</span>
                      <span className="text-slate-600 dark:text-slate-300 italic">
                        "{cleanNotes(checkingLog.notes)}"
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500">Status Pemeriksaan:</span>
                {(verifiedLogs[checkingLog.id] || (checkingLog.notes && checkingLog.notes.includes('[verified]'))) ? (
                  <Badge className="bg-emerald-500 text-white font-bold">
                    VALID
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white font-bold">
                    MENUNGGU VALIDASI
                  </Badge>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCheckingLog(null)}>
              Tutup
            </Button>
            {checkingLog && !(verifiedLogs[checkingLog.id] || (checkingLog.notes && checkingLog.notes.includes('[verified]'))) && (
              <Button
                onClick={() => handleVerifyLog(checkingLog.id)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Konfirmasi Lokasi Valid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
