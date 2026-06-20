import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useListLoadingSessions, 
  useListLoadingItems, 
  useCloseLoadingSession,
  useRequestLoadingSessionReturn,
  useConfirmLoadingSessionReturn
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/auth";
import { 
  PackageOpen, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  ClipboardList, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  User,
  Calendar,
  AlertTriangle
} from "lucide-react";

export default function ReturnStockPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminMode(user);

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [returnItems, setReturnItems] = useState<Record<number, number>>({}); // loading_item_id -> actual_return
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");

  // ─── Fetch Sessions ──────────────────────────────────────────────────────────
  // Admin  : fetch ALL sessions (no salesId filter)
  // Cashier: strictly filter by own staffId. If staffId is missing, pass -1 so
  //          the query returns nothing instead of leaking all sessions.
  const myStaffId = !isAdmin ? (user?.staffId ?? -1) : undefined;

  const { data: rawSessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useListLoadingSessions(
    isAdmin ? undefined : { salesId: myStaffId as number }
  );

  // Client-side safety filter: for cashiers, only show sessions that truly
  // belong to them (in case the backend filter misfires or staffId was undefined).
  const allSessions: any[] = (() => {
    if (!rawSessions) return [];
    if (isAdmin) return rawSessions;
    // Secondary guard: filter to sessions whose sales_id matches our staffId
    if (!user?.staffId) return [];
    return rawSessions.filter((s: any) => s.sales_id === user.staffId);
  })();

  // Fetch items for the currently selected session
  const { data: loadingItems, isLoading: isLoadingItems } = useListLoadingItems(selectedSessionId || undefined);

  // Mutations
  const requestReturn = useRequestLoadingSessionReturn();
  const confirmReturn = useConfirmLoadingSessionReturn();
  const directClose = useCloseLoadingSession();

  // ─── Derived lists ───────────────────────────────────────────────────────────
  const activeSessions  = allSessions.filter((s: any) => s.status === 'active');
  const pendingSessions = allSessions.filter((s: any) => s.status === 'pending_return');
  const closedSessions  = allSessions.filter((s: any) => s.status === 'closed');

  // ─── Side Effects ─────────────────────────────────────────────────────────────
  // Pre-fill returnItems when items for a session load
  useEffect(() => {
    if (loadingItems && loadingItems.length > 0) {
      const initialReturns: Record<number, number> = {};
      loadingItems.forEach((item: any) => {
        const defaultQty = item.quantity_returned > 0
          ? item.quantity_returned
          : Math.max(0, item.quantity_loaded - item.quantity_sold);
        initialReturns[item.id] = defaultQty;
      });
      setReturnItems(initialReturns);
    } else {
      setReturnItems({});
    }
  }, [loadingItems]);

  // Set notes when a session is selected
  useEffect(() => {
    if (selectedSessionId && allSessions.length > 0) {
      const sess = allSessions.find((s: any) => s.id === selectedSessionId);
      if (sess) setNotes(sess.notes || "");
    }
  }, [selectedSessionId, allSessions]);

  // Auto-select the only active session for cashiers
  useEffect(() => {
    if (!isAdmin && activeSessions.length === 1 && selectedSessionId !== activeSessions[0].id) {
      setSelectedSessionId(activeSessions[0].id);
    }
  }, [activeSessions, selectedSessionId, isAdmin]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleReturnChange = (itemId: number, value: string, maxLimit: number) => {
    const val = parseInt(value) || 0;
    setReturnItems(prev => ({
      ...prev,
      [itemId]: Math.min(maxLimit, Math.max(0, val))
    }));
  };

  // Cashier submits return request
  const handleRequestReturn = () => {
    if (!selectedSessionId) return;
    if (!confirm("Apakah Anda yakin ingin mengajukan return barang untuk sesi ini?")) return;

    const itemsToProcess = loadingItems?.map((item: any) => ({
      loading_item_id: item.id,
      product_id: item.product_id,
      actual_return: returnItems[item.id] ?? Math.max(0, item.quantity_loaded - item.quantity_sold)
    })) || [];

    requestReturn.mutate({ sessionId: selectedSessionId, items: itemsToProcess, notes }, {
      onSuccess: () => {
        toast({ title: "Berhasil Diajukan", description: "Permintaan return stok telah diajukan ke Admin.", variant: "success" });
        setSelectedSessionId("");
        setNotes("");
        refetchSessions();
      },
      onError: (err: any) => {
        toast({ title: "Gagal Mengajukan", description: err.message || "Gagal mengajukan return.", variant: "destructive" });
      }
    });
  };

  // Admin confirms return request
  const handleConfirmReturn = () => {
    if (!selectedSessionId) return;
    if (!confirm("Apakah Anda yakin telah memverifikasi dan menyetujui pengembalian stok barang ini ke Gudang Utama?")) return;

    const itemsToProcess = loadingItems?.map((item: any) => ({
      loading_item_id: item.id,
      product_id: item.product_id,
      actual_return: returnItems[item.id] ?? item.quantity_returned
    })) || [];

    confirmReturn.mutate({ sessionId: selectedSessionId, items: itemsToProcess, notes }, {
      onSuccess: () => {
        toast({ title: "Return Dikonfirmasi", description: "Stok berhasil dikembalikan ke Gudang Utama dan sesi ditutup.", variant: "success" });
        setSelectedSessionId("");
        setNotes("");
        refetchSessions();
      },
      onError: (err: any) => {
        toast({ title: "Gagal Konfirmasi", description: err.message || "Gagal melakukan konfirmasi return.", variant: "destructive" });
      }
    });
  };

  // Admin direct-closes a session (bypasses cashier request flow)
  const handleDirectClose = () => {
    if (!selectedSessionId) return;
    if (!confirm("Apakah Anda yakin ingin langsung menutup sesi ini dan mengembalikan stok ke gudang tanpa alur persetujuan?")) return;

    const itemsToProcess = loadingItems?.map((item: any) => ({
      loading_item_id: item.id,
      product_id: item.product_id,
      actual_return: returnItems[item.id] ?? Math.max(0, item.quantity_loaded - item.quantity_sold)
    })) || [];

    directClose.mutate({ sessionId: selectedSessionId, items: itemsToProcess, notes }, {
      onSuccess: () => {
        toast({ title: "Sukses", description: "Sesi berhasil ditutup langsung dan stok dikembalikan ke Gudang.", variant: "success" });
        setSelectedSessionId("");
        setNotes("");
        refetchSessions();
      },
      onError: (err: any) => {
        toast({ title: "Gagal", description: err.message || "Gagal menutup sesi loading.", variant: "destructive" });
      }
    });
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-500 hover:bg-blue-600 font-medium">Aktif / Di Jalan</Badge>;
      case 'pending_return':
        return <Badge className="bg-amber-500 hover:bg-amber-600 font-medium animate-pulse">Menunggu Konfirmasi</Badge>;
      case 'closed':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 font-medium">Selesai (Closed)</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectedSession = allSessions.find((s: any) => s.id === selectedSessionId);

  // ─── Guard: cashier with unknown staffId ─────────────────────────────────────
  if (!isAdmin && !user?.staffId) {
    return (
      <Sidebar>
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 h-full min-h-[calc(100vh-4rem)]">
          <div className="max-w-md w-full p-8 text-center flex flex-col items-center bg-white dark:bg-slate-800 shadow-lg border border-orange-200 dark:border-orange-900/50 rounded-2xl">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-orange-200/50 dark:border-orange-800/50">
              <AlertTriangle className="w-10 h-10 text-orange-600 dark:text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-3">Sesi Tidak Ditemukan</h2>
            <p className="text-orange-700 dark:text-orange-300 mb-6 leading-relaxed">
              Profil akun Sales Anda belum terhubung sepenuhnya. Silakan logout lalu login kembali, atau hubungi Admin untuk memastikan akun Anda sudah terdaftar di sistem staff.
            </p>
          </div>
        </div>
      </Sidebar>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <PackageOpen className="w-6 h-6 text-primary" />
              {isAdmin ? "Konfirmasi Return Stock" : "Return Stock Sales"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isAdmin
                ? "Setujui sisa barang bawaan Sales dikembalikan ke Gudang Utama"
                : "Kembalikan sisa barang bawaan penjualan Anda ke Gudang Utama"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-primary" />}
              {isAdmin ? "Portal Admin" : `Portal Sales · ${user?.name || 'Saya'}`}
            </Badge>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="p-4 sm:p-6 flex-1 overflow-auto max-w-5xl mx-auto w-full space-y-6">

          {/* ─── Admin Dashboard ──────────────────────────────────────────────── */}
          {isAdmin ? (
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedSessionId(""); }} className="space-y-6">
              <TabsList className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 w-full max-w-lg grid grid-cols-3 h-11">
                <TabsTrigger value="pending" className="gap-2 font-medium text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Clock className="w-4 h-4" />
                  Permintaan ({pendingSessions.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-2 font-medium text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ClipboardList className="w-4 h-4" />
                  Sesi Aktif ({activeSessions.length})
                </TabsTrigger>
                <TabsTrigger value="closed" className="gap-2 font-medium text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <History className="w-4 h-4" />
                  Riwayat ({closedSessions.length})
                </TabsTrigger>
              </TabsList>

              {/* PENDING TAB */}
              <TabsContent value="pending" className="space-y-6 outline-none">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase pl-1">Daftar Permintaan</h3>
                    {isLoadingSessions ? (
                      <div className="p-6 text-center text-sm text-slate-500 bg-white dark:bg-slate-900 border rounded-xl">Memuat data...</div>
                    ) : pendingSessions.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-400 bg-white dark:bg-slate-900 border rounded-xl border-dashed">
                        Tidak ada permintaan return yang pending.
                      </div>
                    ) : (
                      pendingSessions.map((session: any) => (
                        <Card
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`cursor-pointer transition-all border shadow-sm hover:shadow-md ${selectedSessionId === session.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800'}`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-400">#{session.id.substring(0, 8)}</span>
                              {renderStatusBadge(session.status)}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <User className="w-4 h-4 text-slate-400" />
                                {session.staff?.name || 'Sales'}
                              </h4>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {selectedSessionId && selectedSession?.status === 'pending_return' ? (
                      <SessionDetailContainer
                        selectedSession={selectedSession}
                        loadingItems={loadingItems}
                        isLoadingItems={isLoadingItems}
                        returnItems={returnItems}
                        handleReturnChange={handleReturnChange}
                        notes={notes}
                        setNotes={setNotes}
                        onSubmit={handleConfirmReturn}
                        submitButtonText="Konfirmasi & Terima Return"
                        cancelAction={() => setSelectedSessionId("")}
                        isPending={confirmReturn.isPending}
                        isAdmin={true}
                      />
                    ) : (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-2xl border-dashed p-8 text-center">
                        <Clock className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <h3 className="font-semibold text-slate-700 dark:text-slate-350">Detail Permintaan</h3>
                        <p className="text-sm text-slate-500 max-w-sm mt-1">Pilih salah satu permintaan return pending di panel kiri untuk melakukan konfirmasi.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ACTIVE TAB */}
              <TabsContent value="active" className="space-y-6 outline-none">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase pl-1">Daftar Sesi Aktif</h3>
                    {isLoadingSessions ? (
                      <div className="p-6 text-center text-sm text-slate-500 bg-white dark:bg-slate-900 border rounded-xl">Memuat data...</div>
                    ) : activeSessions.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-400 bg-white dark:bg-slate-900 border rounded-xl border-dashed">
                        Tidak ada sesi loading aktif di jalan.
                      </div>
                    ) : (
                      activeSessions.map((session: any) => (
                        <Card
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`cursor-pointer transition-all border shadow-sm hover:shadow-md ${selectedSessionId === session.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800'}`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-400">#{session.id.substring(0, 8)}</span>
                              {renderStatusBadge(session.status)}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <User className="w-4 h-4 text-slate-400" />
                                {session.staff?.name || 'Sales'}
                              </h4>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {selectedSessionId && selectedSession?.status === 'active' ? (
                      <SessionDetailContainer
                        selectedSession={selectedSession}
                        loadingItems={loadingItems}
                        isLoadingItems={isLoadingItems}
                        returnItems={returnItems}
                        handleReturnChange={handleReturnChange}
                        notes={notes}
                        setNotes={setNotes}
                        onSubmit={handleDirectClose}
                        submitButtonText="Tutup Sesi & Terima Stok"
                        cancelAction={() => setSelectedSessionId("")}
                        isPending={directClose.isPending}
                        isAdmin={true}
                      />
                    ) : (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-2xl border-dashed p-8 text-center">
                        <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <h3 className="font-semibold text-slate-700 dark:text-slate-350">Detail Sesi Loading</h3>
                        <p className="text-sm text-slate-500 max-w-sm mt-1">Pilih salah satu sesi aktif di panel kiri untuk menutup sesi secara langsung tanpa alur pengajuan kasir.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* CLOSED TAB */}
              <TabsContent value="closed" className="space-y-6 outline-none">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase pl-1">Riwayat Selesai</h3>
                    {isLoadingSessions ? (
                      <div className="p-6 text-center text-sm text-slate-500 bg-white dark:bg-slate-900 border rounded-xl">Memuat data...</div>
                    ) : closedSessions.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-400 bg-white dark:bg-slate-900 border rounded-xl border-dashed">
                        Belum ada sesi yang diselesaikan.
                      </div>
                    ) : (
                      closedSessions.map((session: any) => (
                        <Card
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`cursor-pointer transition-all border shadow-sm hover:shadow-md ${selectedSessionId === session.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800'}`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-400">#{session.id.substring(0, 8)}</span>
                              {renderStatusBadge(session.status)}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <User className="w-4 h-4 text-slate-400" />
                                {session.staff?.name || 'Sales'}
                              </h4>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {selectedSessionId && selectedSession?.status === 'closed' ? (
                      <SessionDetailContainer
                        selectedSession={selectedSession}
                        loadingItems={loadingItems}
                        isLoadingItems={isLoadingItems}
                        returnItems={returnItems}
                        handleReturnChange={handleReturnChange}
                        notes={notes}
                        setNotes={setNotes}
                        onSubmit={() => {}}
                        submitButtonText=""
                        cancelAction={() => setSelectedSessionId("")}
                        isPending={false}
                        isAdmin={true}
                        isReadOnly={true}
                      />
                    ) : (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-2xl border-dashed p-8 text-center">
                        <History className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <h3 className="font-semibold text-slate-700 dark:text-slate-350">Detail Riwayat</h3>
                        <p className="text-sm text-slate-500 max-w-sm mt-1">Pilih salah satu sesi closed di panel kiri untuk melihat rincian barang yang telah dikembalikan.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

          ) : (

            /* ─── Cashier / Sales Portal ─────────────────────────────────────── */
            <div className="space-y-6">

              {/* Info: whose data is this */}
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl px-4 py-3">
                <User className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Menampilkan data sesi tugas atas nama: <span className="font-bold">{user?.name || 'Akun Anda'}</span>
                </p>
              </div>

              {activeSessions.length > 0 ? (

                /* Sesi Aktif Form */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pl-1">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <h2 className="font-bold text-lg text-slate-800 dark:text-white">Ajukan Return Sesi Aktif</h2>
                  </div>

                  {/* Session selector if more than one */}
                  {activeSessions.length > 1 && (
                    <div className="max-w-md bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                      <label className="text-sm font-medium mb-1.5 block">Pilih Sesi Loading Aktif</label>
                      <select
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        className="w-full p-2 border rounded-md bg-white dark:bg-slate-950"
                      >
                        <option value="">-- Pilih Sesi --</option>
                        {activeSessions.map((session: any) => (
                          <option key={session.id} value={session.id}>
                            {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedSessionId && selectedSession?.status === 'active' ? (
                    <SessionDetailContainer
                      selectedSession={selectedSession}
                      loadingItems={loadingItems}
                      isLoadingItems={isLoadingItems}
                      returnItems={returnItems}
                      handleReturnChange={handleReturnChange}
                      notes={notes}
                      setNotes={setNotes}
                      onSubmit={handleRequestReturn}
                      submitButtonText="Ajukan Permintaan Return"
                      cancelAction={() => setSelectedSessionId("")}
                      isPending={requestReturn.isPending}
                      isAdmin={false}
                    />
                  ) : (
                    <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 border rounded-xl">
                      Silakan pilih sesi loading aktif untuk memulai.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center space-y-3">
                  <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300">Tidak Ada Sesi Loading Aktif</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Anda tidak memiliki sesi barang bawaan penjualan (loading) yang sedang aktif di jalan saat ini.
                    Untuk mengembalikan stok, pastikan Admin telah mentransfer stock ke Anda.
                  </p>
                </div>
              )}

              {/* Riwayat Return milik kasir ini saja */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2 pl-1">
                  <History className="w-5 h-5 text-slate-500" />
                  <h2 className="font-bold text-lg text-slate-800 dark:text-white">Status & Riwayat Return Anda</h2>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-355 font-semibold text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Kode Sesi</th>
                          <th className="px-6 py-4">Tanggal Diajukan</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Catatan</th>
                          <th className="px-6 py-4 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {isLoadingSessions ? (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : allSessions.filter((s: any) => s.status !== 'active').length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Belum ada pengajuan return sebelumnya.</td></tr>
                        ) : (
                          allSessions.filter((s: any) => s.status !== 'active').map((session: any) => (
                            <tr key={session.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-4 font-mono text-xs text-slate-500">#{session.id.substring(0, 8)}</td>
                              <td className="px-6 py-4 text-xs">
                                {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-6 py-4">{renderStatusBadge(session.status)}</td>
                              <td className="px-6 py-4 text-xs italic text-slate-500 max-w-xs truncate">{session.notes || '-'}</td>
                              <td className="px-6 py-4 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 font-medium text-xs hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                                  onClick={() => setSelectedSessionId(session.id)}
                                >
                                  Lihat Rincian
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Read-only detail modal for cashier's past sessions */}
              {selectedSessionId && selectedSession?.status !== 'active' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                      <div>
                        <h3 className="font-extrabold text-lg flex items-center gap-2">
                          <PackageOpen className="w-5 h-5 text-primary" />
                          Rincian Pengembalian Barang
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Sesi #{selectedSession.id.substring(0, 8)} • Diajukan {new Date(selectedSession.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      {renderStatusBadge(selectedSession.status)}
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                      <SessionDetailContainer
                        selectedSession={selectedSession}
                        loadingItems={loadingItems}
                        isLoadingItems={isLoadingItems}
                        returnItems={returnItems}
                        handleReturnChange={handleReturnChange}
                        notes={notes}
                        setNotes={setNotes}
                        onSubmit={() => {}}
                        submitButtonText=""
                        cancelAction={() => setSelectedSessionId("")}
                        isPending={false}
                        isAdmin={false}
                        isReadOnly={true}
                      />
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                      <Button onClick={() => setSelectedSessionId("")}>Tutup Rincian</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}

// ─── Session Detail Container (Unified Admin/Cashier) ─────────────────────────
interface SessionDetailProps {
  selectedSession: any;
  loadingItems: any[] | undefined;
  isLoadingItems: boolean;
  returnItems: Record<number, number>;
  handleReturnChange: (itemId: number, value: string, maxLimit: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSubmit: () => void;
  submitButtonText: string;
  cancelAction: () => void;
  isPending: boolean;
  isAdmin: boolean;
  isReadOnly?: boolean;
}

function SessionDetailContainer({
  selectedSession,
  loadingItems,
  isLoadingItems,
  returnItems,
  handleReturnChange,
  notes,
  setNotes,
  onSubmit,
  submitButtonText,
  cancelAction,
  isPending,
  isAdmin,
  isReadOnly = false
}: SessionDetailProps) {
  const systemClosed = selectedSession.status === 'closed';

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold text-slate-850 dark:text-white flex items-center gap-2">
              Detail Barang Bawaan Sesi
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {isReadOnly
                ? "Rincian barang yang dikembalikan pada sesi ini."
                : "Tinjau jumlah barang terjual dan sesuaikan jumlah aktual pengembalian ke gudang."}
            </CardDescription>
          </div>
          {!isReadOnly && selectedSession.status === 'pending_return' && isAdmin && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/30 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Verifikasi Diperlukan
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoadingItems ? (
          <div className="p-12 text-center text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
            Memuat data barang sesi...
          </div>
        ) : !loadingItems || loadingItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Sesi ini tidak memiliki data barang bawaan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-5 py-3.5">Nama Produk</th>
                  <th className="px-5 py-3.5 text-center">Bawa (Load)</th>
                  <th className="px-5 py-3.5 text-center">Terjual (POS)</th>
                  <th className="px-5 py-3.5 text-center bg-slate-100/50 dark:bg-slate-800/30">Sisa (Sistem)</th>
                  <th className="px-5 py-3.5 text-center bg-primary/5 text-primary">
                    {systemClosed ? "Telah Kembali" : "Kembali (Aktual)"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingItems.map((item: any) => {
                  const expectedReturn = Math.max(0, item.quantity_loaded - item.quantity_sold);
                  const actualReturn = returnItems[item.id] ?? (systemClosed ? item.quantity_returned : expectedReturn);
                  const difference = actualReturn - expectedReturn;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {item.products?.name || 'Produk Dihapus'}
                      </td>
                      <td className="px-5 py-4 text-center text-slate-600 dark:text-slate-400 font-medium">
                        {item.quantity_loaded} pcs
                      </td>
                      <td className="px-5 py-4 text-center text-green-600 dark:text-green-500 font-medium">
                        {item.quantity_sold} pcs
                      </td>
                      <td className="px-5 py-4 text-center text-slate-600 dark:text-slate-400 bg-slate-100/20 dark:bg-slate-800/10 font-bold">
                        {expectedReturn} pcs
                      </td>
                      <td className="px-5 py-4 bg-primary/[0.02] dark:bg-primary/[0.01]">
                        <div className="flex flex-col items-center gap-1.5">
                          {isReadOnly || systemClosed ? (
                            <span className="font-bold text-primary text-base">
                              {systemClosed ? item.quantity_returned : actualReturn} pcs
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              max={item.quantity_loaded - item.quantity_sold}
                              className={`w-24 text-center font-extrabold text-sm focus-visible:ring-primary ${difference !== 0 ? 'border-orange-400 ring-orange-100 text-orange-600 dark:text-orange-400' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950'}`}
                              value={actualReturn}
                              onChange={(e) => handleReturnChange(item.id, e.target.value, item.quantity_loaded - item.quantity_sold)}
                            />
                          )}
                          {difference !== 0 && !systemClosed && (
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1 font-semibold">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              Selisih {difference > 0 ? `+${difference}` : difference} pcs
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-slate-50/50 dark:bg-slate-900/30 p-5 flex flex-col items-stretch gap-4 border-t border-slate-100 dark:border-slate-800">
        {/* Session metadata */}
        <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 dark:border-slate-850 pb-4">
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Sales Penanggung Jawab</span>
            <p className="font-semibold flex items-center gap-1 text-slate-750 dark:text-slate-250">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {selectedSession.staff?.name || 'Sales'}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Tanggal Transaksi</span>
            <p className="font-semibold flex items-center gap-1 text-slate-750 dark:text-slate-250">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(selectedSession.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="w-full">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-350 mb-2 block">
            Catatan Return {isReadOnly ? "" : "(Opsional)"}
          </label>
          {isReadOnly ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-sm italic text-slate-600 dark:text-slate-400">
              {notes || "Tidak ada catatan."}
            </div>
          ) : (
            <Input
              placeholder="Tambahkan catatan jika ada selisih barang, kerusakan, dsb..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white dark:bg-slate-950"
            />
          )}
        </div>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex justify-end gap-3 w-full pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={cancelAction} disabled={isPending}>
              Batal
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isPending || !loadingItems || loadingItems.length === 0}
              className="bg-primary hover:bg-primary/95 text-white gap-2 font-semibold shadow-sm"
            >
              <Save className="w-4 h-4" />
              {isPending ? "Memproses..." : submitButtonText}
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
