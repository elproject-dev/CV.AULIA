import { useState, useMemo, useRef } from "react";
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


export default function VisitSchedulePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminMode(user);

  const [activeTab, setActiveTab] = useState<"schedule" | "history">("schedule");
  const [selectedDay, setSelectedDay] = useState<number>(getTodayDayId());
  const [salesFilter, setSalesFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  // Active staff list for sales dropdown
  const activeSalesList = useMemo(() => {
    return (staffList || []).filter((s: any) => s.status === 'active' && s.name);
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

  // Unique sales names from schedules
  const uniqueSalesNames = useMemo(() => {
    const names = visibleSchedules.map((s: any) => s.sales_name).filter(Boolean);
    return Array.from(new Set(names)).sort() as string[];
  }, [visibleSchedules]);

  // Unique sales names from logs
  const uniqueLogSalesNames = useMemo(() => {
    const names = visibleLogs.map((l: any) => l.sales_name).filter(Boolean);
    return Array.from(new Set(names)).sort() as string[];
  }, [visibleLogs]);

  const filteredSchedules = useMemo(
    () =>
      salesFilter === "all"
        ? visibleSchedules
        : visibleSchedules.filter((s: any) => s.sales_name === salesFilter),
    [visibleSchedules, salesFilter]
  );

  const filteredLogs = useMemo(
    () =>
      salesFilter === "all"
        ? visibleLogs
        : visibleLogs.filter((l: any) => l.sales_name === salesFilter),
    [visibleLogs, salesFilter]
  );

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
        sales_name: isAdmin ? (salesFilter !== "all" ? salesFilter : "") : (user?.name || ""),
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
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-6">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${
              activeTab === "schedule"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Jadwal
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat
            {(logs || []).length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5">
                {(logs || []).length}
              </Badge>
            )}
          </button>
        </div>

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day tabs + Sales filter bar */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 space-y-3">
              {/* Sales filter */}
              {uniqueSalesNames.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Sales:
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSalesFilter("all")}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
                        salesFilter === "all"
                          ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                          : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Semua
                    </button>
                    {uniqueSalesNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => setSalesFilter(name)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
                          salesFilter === name
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                            : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Day tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {DAYS.map((day) => {
                  const isToday = day.id === getTodayDayId();
                  const isSelected = day.id === selectedDay;
                  const count = dayScheduleCounts[day.id] || 0;
                  return (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDay(day.id)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[54px] flex-shrink-0 border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-transparent shadow-md scale-105"
                          : isToday
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <span className="text-[11px] font-semibold">{day.short}</span>
                      {count > 0 ? (
                        <span
                          className={cn(
                            "text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center",
                            isSelected
                              ? "bg-white/25 text-primary-foreground"
                              : "bg-primary/15 text-primary"
                          )}
                        >
                          {count}
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-50">-</span>
                      )}
                    </button>
                  );
                })}
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
                  {schedulesForDay.length} toko
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
                    const address = customer.address
                      ? `${customer.address}${customer.district ? `, Kec. ${customer.district}` : ""}${customer.city ? `, ${customer.city}` : ""}`
                      : null;
                    const isTracking = trackingId === schedule.id;

                    return (
                      <div
                        key={schedule.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
                      >
                        {/* Card header */}
                        <div className="flex items-start gap-3 p-3 sm:p-4">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                {name}
                              </h3>
                              {schedule.visit_time && (
                                <Badge variant="secondary" className="text-[10px] flex-shrink-0 gap-1">
                                  <Clock className="w-3 h-3" />
                                  {schedule.visit_time}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span>{phone}</span>
                            </div>
                            {address && (
                              <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{address}</span>
                              </div>
                            )}
                            {schedule.notes && (
                              <p className="mt-1.5 text-xs text-slate-400 italic line-clamp-1">
                                "{schedule.notes}"
                              </p>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Riwayat Kunjungan
                {filteredLogs.length > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5">
                    {filteredLogs.length}
                  </Badge>
                )}
              </h2>
              {/* Sales filter for history */}
              {uniqueLogSalesNames.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Sales:
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSalesFilter("all")}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
                        salesFilter === "all"
                          ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                          : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Semua
                    </button>
                    {uniqueLogSalesNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => setSalesFilter(name)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
                          salesFilter === name
                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                            : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  {salesFilter !== "all" ? `Belum ada riwayat untuk ${salesFilter}` : "Belum ada riwayat kunjungan"}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Klik "Kunjungi" pada jadwal untuk mencatat kunjungan
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
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
                          {log.notes && (
                            <p className="mt-1.5 text-xs text-slate-400 italic">"{log.notes}"</p>
                          )}
                        </div>
                      </div>

                      {log.latitude && log.longitude && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs flex-shrink-0"
                          onClick={() => openInMaps(log.latitude, log.longitude)}
                        >
                          <Map className="w-3.5 h-3.5" />
                          Maps
                        </Button>
                      )}
                    </div>

                    {log.latitude && log.longitude && (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                        <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="font-mono">
                          {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                        </span>
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
              Lokasi berhasil didapatkan. Tambahkan catatan kunjungan (opsional).
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
                  <MapPin className="w-3.5 h-3.5 text-green-500" />
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
    </Sidebar>
  );
}
