import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/auth";
import {
  PackageOpen,
  Package,
  Search,
  History,
  ArrowLeft,
  AlertTriangle,
  Receipt,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Banknote,
  TrendingDown
} from "lucide-react";
import {
  useListReturns,
  useGetTransactionByInvoice,
  useCreateReturn,
  useConfirmReturn,
  useDeleteReturn
} from "@workspace/api-client-react";
import { formatRupiah, formatInvoiceNumber } from "@/lib/formatters";
import { getProductImageUrl } from "@/lib/supabase-storage";

export default function CustomerReturnsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminMode(user);

  const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'history'>('new');
  const [searchInvoice, setSearchInvoice] = useState("");
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);

  // Return Form State
  const [returnItems, setReturnItems] = useState<Record<number, number>>({}); // transaction_item_id -> return quantity
  const [returnUnits, setReturnUnits] = useState<Record<number, any>>({}); // transaction_item_id -> selected uom object
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: returnHistory, isLoading: isLoadingHistory } = useListReturns();
  const { data: transaction, isLoading: isLoadingTransaction, isError: isTransactionError } = useGetTransactionByInvoice(searchedId);
  const createReturn = useCreateReturn();
  const confirmReturn = useConfirmReturn();
  const deleteReturn = useDeleteReturn();

  const pendingReturns = returnHistory?.filter((r: any) => r.status === 'pending') || [];
  const completedReturns = returnHistory?.filter((r: any) => r.status === 'completed') || [];

  // Summary Metrics
  const totalPermintaan = returnHistory?.length || 0;
  const totalBarangDiretur = returnHistory?.reduce((sum: number, r: any) => sum + (r.sales_return_items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity * (item.transaction_items?.conversion_factor || 1)), 0) || 0), 0) || 0;
  const totalBarangRusak = returnHistory?.filter((r: any) => r.reason === 'Barang Rusak/Cacat' || r.reason === 'Barang Kadaluarsa').reduce((sum: number, r: any) => sum + (r.sales_return_items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity * (item.transaction_items?.conversion_factor || 1)), 0) || 0), 0) || 0;
  const totalNilaiRefund = returnHistory?.reduce((sum: number, r: any) => sum + Number(r.total_refund || 0), 0) || 0;

  // Handle Search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInvoice.trim()) return;
    // Extract ID if they type the invoice format (e.g. INV-00123 -> 123)
    const idMatch = searchInvoice.match(/\d+$/);
    const id = idMatch ? parseInt(idMatch[0], 10).toString() : searchInvoice;
    setSearchedId(id);
    setReturnItems({});
    setReturnUnits({});
    setReason("");
    setNotes("");
  };

  const handleReturnQtyChange = (itemId: number, value: string, maxLimit: number) => {
    const val = parseInt(value) || 0;
    setReturnItems(prev => ({
      ...prev,
      [itemId]: Math.min(maxLimit, Math.max(0, val))
    }));
  };

  const handleReturnUnitChange = (item: any, uom: any, maxLimitInSelectedUnit: number) => {
    setReturnUnits(prev => ({ ...prev, [item.id]: uom }));
    // Clamp quantity to new max limit
    if (returnItems[item.id] !== undefined) {
      setReturnItems(prev => ({
        ...prev,
        [item.id]: Math.min(maxLimitInSelectedUnit, prev[item.id])
      }));
    }
  };

  // Calculate totals
  const totalRefundItems = Object.values(returnItems).reduce((sum, qty) => sum + qty, 0);
  let totalRefundAmount = 0;
  if (transaction?.items) {
    totalRefundAmount = transaction.items.reduce((sum: number, item: any) => {
      const qty = returnItems[item.id] || 0;
      const selectedUnit = returnUnits[item.id] || { unit_name: item.unit_name || 'PCS', conversion_factor: item.conversion_factor || 1 };
      const basePrice = Number(item.price);
      const refundPrice = basePrice * (selectedUnit.conversion_factor || 1);
      return sum + (qty * refundPrice);
    }, 0);
  }

  const handleSubmitReturn = () => {
    if (!transaction) return;
    if (totalRefundItems === 0) {
      toast({ title: "Peringatan", description: "Pilih minimal 1 barang untuk diretur.", variant: "destructive" });
      return;
    }
    if (!reason) {
      toast({ title: "Peringatan", description: "Pilih alasan retur.", variant: "destructive" });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin memproses retur ini dengan total refund ${formatRupiah(totalRefundAmount)}?`)) return;

    // Filter items that have return quantity > 0
    const itemsToReturn = transaction.items
      .filter((item: any) => (returnItems[item.id] || 0) > 0)
      .map((item: any) => {
        const qty = returnItems[item.id] || 0;
        const selectedUnit = returnUnits[item.id] || { unit_name: item.unit_name || 'PCS', conversion_factor: item.conversion_factor || 1 };
        const basePrice = Number(item.price);
        const refundPrice = basePrice * (selectedUnit.conversion_factor || 1);
        return {
          ...item,
          return_unit_name: selectedUnit.unit_name,
          return_conversion_factor: selectedUnit.conversion_factor,
          return_quantity: qty,
          return_price: refundPrice,
          return_subtotal: qty * refundPrice
        };
      });

    createReturn.mutate({
      transactionId: transaction.id,
      customerId: transaction.customer_id,
      cashierName: user?.name || 'Kasir',
      totalRefund: totalRefundAmount,
      reason,
      notes,
      items: itemsToReturn,
      status: isAdmin ? 'completed' : 'pending'
    }, {
      onSuccess: () => {
        toast({ title: "Sukses", description: "Retur penjualan berhasil dicatat.", variant: "success" });
        setSearchedId(null);
        setSearchInvoice("");
        setActiveTab(isAdmin ? "history" : "pending");
      },
      onError: (err: any) => {
        toast({ title: "Gagal", description: err.message || "Terjadi kesalahan saat memproses retur.", variant: "destructive" });
      }
    });
  };

  const renderTable = (data: any[], emptyTitle: string, emptyIcon: React.ReactNode) => {
    if (isLoadingHistory) {
      return <div className="p-12 text-center text-slate-500">Memuat data...</div>;
    }
    if (!data || data.length === 0) {
      return (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
          <div className="mb-3 text-slate-300">{emptyIcon}</div>
          {emptyTitle}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left block sm:table">
          <thead className="hidden sm:table-header-group bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Tanggal Retur</th>
              <th className="px-6 py-4">ID Transaksi</th>
              <th className="px-6 py-4">Pelanggan</th>
              <th className="px-6 py-4">Sales</th>
              <th className="px-6 py-4">Alasan</th>
              <th className="px-6 py-4 text-right">Total Refund</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group divide-y sm:divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((ret: any) => (
              <tr key={ret.id} onClick={() => setSelectedReturn(ret)} className="block sm:table-row bg-white dark:bg-slate-900 sm:bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/50 p-4 sm:p-0 mb-4 sm:mb-0 border border-slate-200 dark:border-slate-800 sm:border-0 rounded-xl sm:rounded-none shadow-sm sm:shadow-none relative cursor-pointer">
                <td className="block sm:table-cell px-0 sm:px-6 py-1 sm:py-4 text-slate-600 dark:text-slate-400 mb-2 sm:mb-0">
                  <div className="flex items-center justify-between sm:justify-start gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {new Date(ret.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    <div className="sm:hidden">
                      {ret.status === 'pending' ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Pending</Badge>
                      ) : (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600">Selesai</Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="block sm:table-cell px-0 sm:px-6 py-1 sm:py-4 font-mono font-medium text-primary text-lg sm:text-sm">
                  {formatInvoiceNumber(ret.transaction_id)}
                </td>
                <td className="block sm:table-cell px-0 sm:px-6 py-1 sm:py-4">
                  <div className="flex sm:block justify-between items-center">
                    <span className="sm:hidden text-slate-500 text-xs uppercase tracking-wider font-semibold">Pelanggan</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-right sm:text-left">
                      {ret.customers?.name || 'Pelanggan Umum'}
                    </div>
                  </div>
                </td>
                <td className="block sm:table-cell px-0 sm:px-6 py-1 sm:py-4">
                  <div className="flex sm:block justify-between items-center">
                    <span className="sm:hidden text-slate-500 text-xs uppercase tracking-wider font-semibold">Kasir</span>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-end sm:justify-start gap-1.5">
                      {ret.cashier_name}
                    </div>
                  </div>
                </td>
                <td className="block sm:table-cell px-0 sm:px-6 py-2 sm:py-4 mt-2 sm:mt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                  <div className="flex sm:block justify-between items-start">
                    <span className="sm:hidden text-slate-500 text-xs uppercase tracking-wider font-semibold mt-1">Alasan</span>
                    <div className="text-right sm:text-left">
                      <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 font-normal">
                        {ret.reason}
                      </Badge>
                      {ret.notes && <div className="text-xs text-slate-400 mt-1 italic max-w-[200px] sm:max-w-none ml-auto sm:ml-0 truncate sm:whitespace-normal">{ret.notes}</div>}
                    </div>
                  </div>
                </td>
                <td className="block sm:table-cell px-0 sm:px-6 py-3 sm:py-4 mt-2 sm:mt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                  <div className="flex sm:block justify-between items-center bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none sm:text-right">
                    <span className="sm:hidden text-slate-700 dark:text-slate-300 font-bold">Total Refund</span>
                    <span className="font-extrabold text-orange-600 dark:text-orange-400 text-lg sm:text-base">
                      {formatRupiah(ret.total_refund)}
                    </span>
                  </div>
                </td>
                <td className="hidden sm:table-cell px-6 py-4 text-center">
                  {ret.status === 'pending' ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Pending</Badge>
                  ) : (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600">Selesai</Badge>
                  )}
                </td>
                <td className="block sm:table-cell px-0 sm:px-6 py-2 sm:py-4 text-center mt-2 sm:mt-0">
                  {ret.status === 'pending' && isAdmin ? (
                    <Button
                      size="sm"
                      className="w-full sm:h-7 sm:text-xs sm:px-2 sm:max-w-[100px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Konfirmasi retur ini?`)) {
                          confirmReturn.mutate({ returnId: ret.id }, {
                            onSuccess: () => toast({ title: "Dikonfirmasi", description: "Retur berhasil disetujui", variant: "success" }),
                            onError: (err: any) => toast({ title: "Gagal", description: err.message, variant: "destructive" })
                          });
                        }
                      }}
                      disabled={confirmReturn.isPending}
                    >
                      Konfirmasi
                    </Button>
                  ) : ret.status === 'completed' && isAdmin ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full sm:h-7 sm:text-xs sm:px-2 sm:max-w-[100px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Anda yakin ingin menghapus riwayat retur ini secara permanen?`)) {
                          deleteReturn.mutate({ id: ret.id }, {
                            onSuccess: () => toast({ title: "Terhapus", description: "Riwayat retur berhasil dihapus", variant: "success" }),
                            onError: (err: any) => toast({ title: "Gagal", description: err.message, variant: "destructive" })
                          });
                        }
                      }}
                      disabled={deleteReturn.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1 hidden sm:inline" /> Hapus
                    </Button>
                  ) : (
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <PackageOpen className="w-6 h-6 text-primary" />
            Laporan & Retur Penjualan
          </h1>

        </div>

        {/* Tabs Switcher */}
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button
            onClick={() => setActiveTab('new')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'new'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Receipt className="w-4 h-4" />
            Buat Retur Baru
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Clock className="w-4 h-4" />
            Menunggu Konfirmasi
            {pendingReturns.length > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 animate-bounce" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <History className="w-4 h-4" />
            Riwayat Selesai
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          {activeTab === 'new' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 items-stretch">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-emerald-100 text-xs sm:text-sm font-medium">Total Permintaan</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {totalPermintaan} <span className="text-sm font-normal text-emerald-200">laporan</span>
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Receipt className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-emerald-200">seluruh laporan retur terdata</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-indigo-100 text-xs sm:text-sm font-medium">Total Barang Diretur</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {totalBarangDiretur} <span className="text-sm font-normal text-indigo-200">pcs</span>
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <PackageOpen className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-indigo-200">kuantitas dari semua retur</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-red-100 text-xs sm:text-sm font-medium">Barang Rusak</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {totalBarangRusak} <span className="text-sm font-normal text-red-200">pcs</span>
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-red-200">kondisi buruk tidak masuk stok</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-purple-100 text-xs sm:text-sm font-medium">Total Nilai Refund</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {formatRupiah(totalNilaiRefund)}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Banknote className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-purple-200">nominal pengembalian dana</p>
                  </div>
                </div>
              </div>

              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-lg">Cari Transaksi</CardTitle>
                  <CardDescription>Masukkan Nomor Invoice atau ID Transaksi untuk memulai proses retur</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-lg">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={searchInvoice}
                        onChange={(e) => setSearchInvoice(e.target.value)}
                        placeholder="Contoh: TRX-ID00123 atau 123"
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                    <Button type="submit" disabled={!searchInvoice.trim() || isLoadingTransaction} className="w-full sm:w-auto">
                      Cari Transaksi
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {isLoadingTransaction ? (
                <div className="p-12 text-center text-slate-500 animate-pulse bg-white dark:bg-slate-900 rounded-xl border">
                  Mencari data transaksi...
                </div>
              ) : isTransactionError || (searchedId && !transaction) ? (
                <div className="p-12 text-center flex flex-col items-center bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                  <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
                  <h3 className="font-semibold text-red-700 dark:text-red-400">Transaksi Tidak Ditemukan</h3>
                  <p className="text-sm text-red-600/80 mt-1">Pastikan ID transaksi atau nomor invoice sudah benar.</p>
                  <Button variant="outline" className="mt-4" onClick={() => { setSearchedId(null); setSearchInvoice(""); }}>
                    Coba Lagi
                  </Button>
                </div>
              ) : transaction ? (
                <div className="flex flex-col gap-6 w-full">
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 mb-0.5">Informasi Pelanggan</div>
                      <div className="font-bold text-slate-900 dark:text-white text-lg">
                        {transaction.customers?.name || 'Pelanggan Umum'}
                      </div>
                      {transaction.customers?.phone && (
                        <div className="text-sm text-slate-500 mt-0.5">{transaction.customers.phone}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
                      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              Rincian Barang Transaksi
                            </CardTitle>
                            <CardDescription>Pilih barang yang akan diretur</CardDescription>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center mt-2 sm:mt-0">
                            {transaction.cashier_name && (
                              <Badge variant="outline" className="text-xs sm:text-sm px-3 py-1 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {transaction.cashier_name}
                              </Badge>
                            )}
                            <Badge variant="outline" className="font-mono text-sm px-3 py-1 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                              INV-{transaction.id.toString().padStart(5, '0')}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left block sm:table border-collapse">
                            <thead className="hidden sm:table-header-group bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold tracking-wider">
                              <tr>
                                <th className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">Produk</th>
                                <th className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 text-right">Harga</th>
                                <th className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 text-center">Dibeli</th>
                                <th className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 text-center bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 w-[280px]">Jumlah Retur</th>
                              </tr>
                            </thead>
                            <tbody className="block sm:table-row-group divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
                              {transaction.items?.map((item: any) => {
                                const selectedUnit = returnUnits[item.id] || { unit_name: item.unit_name || 'PCS', conversion_factor: item.conversion_factor || 1 };
                                const baseRemaining = item.quantity - (item.already_returned_base_qty || 0);
                                const maxInSelectedUnit = Math.floor(baseRemaining / (selectedUnit.conversion_factor || 1));
                                const hasUoms = item.uoms && item.uoms.length > 0;
                                const isLunas = baseRemaining <= 0;

                                return (
                                <tr key={item.id} className="block sm:table-row hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors p-4 sm:p-0 sm:border-b border-slate-100 dark:border-slate-800 last:border-0 relative">
                                  <td className="block sm:table-cell px-0 sm:px-5 py-2 sm:py-5 align-middle">
                                    <div className="flex items-center gap-4">
                                      {item.image_url ? (
                                        <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-white dark:bg-slate-800 flex-shrink-0 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                                          <img
                                            src={getProductImageUrl(item.image_url)}
                                            alt={item.product_name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              const parent = e.currentTarget.parentElement;
                                              if (parent) {
                                                const icon = parent.nextElementSibling;
                                                if (icon) icon.classList.remove('hidden');
                                              }
                                            }}
                                          />
                                          <div className="w-full h-full flex items-center justify-center hidden bg-slate-50 dark:bg-slate-800/50">
                                            <Package className="w-5 h-5 text-slate-400" />
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center flex-shrink-0 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                                          <Package className="w-6 h-6 sm:w-5 sm:h-5 text-slate-400" />
                                        </div>
                                      )}
                                      <div className="font-bold text-slate-900 dark:text-white text-[15px] leading-tight">{item.product_name}</div>
                                    </div>
                                  </td>
                                  <td className="block sm:table-cell px-0 sm:px-5 py-1 sm:py-5 align-middle text-left sm:text-right">
                                    <div className="flex sm:block justify-between items-center">
                                      <span className="sm:hidden text-slate-500 font-medium text-xs uppercase tracking-wider">Harga:</span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatRupiah(item.price)}</span>
                                    </div>
                                  </td>
                                  <td className="block sm:table-cell px-0 sm:px-5 py-1 sm:py-5 align-middle text-left sm:text-center">
                                    <div className="flex sm:block justify-between items-center">
                                      <span className="sm:hidden text-slate-500 font-medium text-xs uppercase tracking-wider">Dibeli:</span>
                                      <div className="text-right sm:text-center flex flex-col sm:items-center">
                                        <div className="font-bold text-slate-900 dark:text-white text-base">
                                          {item.unit_qty || (item.quantity / (item.conversion_factor || 1))} <span className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-0.5">{item.unit_name || 'PCS'}</span>
                                        </div>
                                        {item.already_returned_qty > 0 && (
                                          <Badge variant="outline" className="mt-1.5 text-[10px] text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/20 font-medium flex items-center gap-1 px-1.5 py-0.5 w-fit sm:mx-auto">
                                            Sudah Retur: {item.already_returned_qty} {item.unit_name || 'PCS'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="block sm:table-cell px-0 sm:px-5 py-4 sm:py-5 sm:bg-orange-50/30 sm:dark:bg-orange-900/10 mt-3 sm:mt-0 border-t sm:border-0 border-dashed border-slate-200 dark:border-slate-800 align-middle">
                                    <div className="flex flex-col items-start sm:items-center justify-center gap-2 w-full">
                                      <span className="sm:hidden font-bold text-orange-700 dark:text-orange-400 text-xs uppercase tracking-wider mb-1">Jumlah Retur:</span>
                                      
                                      {isLunas ? (
                                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 whitespace-nowrap px-3 py-1 font-medium">
                                          Sudah Maksimal
                                        </Badge>
                                      ) : (
                                        <div className="flex flex-col sm:items-center gap-2 w-full">
                                          <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <Input
                                              type="number"
                                              min="0"
                                              max={maxInSelectedUnit}
                                              value={returnItems[item.id] || ''}
                                              onChange={(e) => handleReturnQtyChange(item.id, e.target.value, maxInSelectedUnit)}
                                              className="w-full sm:w-20 text-center font-bold text-lg h-10 border-slate-300 focus-visible:ring-orange-400 focus-visible:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all shadow-sm"
                                              placeholder="0"
                                            />
                                            {hasUoms ? (
                                              <Select
                                                value={selectedUnit.unit_name}
                                                onValueChange={(val) => {
                                                  const uom = item.uoms.find((u: any) => u.unit_name === val);
                                                  if (uom) {
                                                    const newMax = Math.floor(baseRemaining / (uom.conversion_factor || 1));
                                                    handleReturnUnitChange(item, uom, newMax);
                                                  }
                                                }}
                                              >
                                                <SelectTrigger className="w-28 h-10 font-medium bg-white dark:bg-slate-950 border-slate-300 shadow-sm focus:ring-orange-400 focus:border-orange-400">
                                                  <SelectValue placeholder="Satuan" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {Array.from(new Map(item.uoms.map((u: any) => [u.unit_name, u])).values()).map((u: any) => (
                                                    <SelectItem key={u.id || u.unit_name} value={u.unit_name} className="font-medium">
                                                      {u.unit_name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <div className="h-10 px-3 flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
                                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{selectedUnit.unit_name}</span>
                                              </div>
                                            )}
                                          </div>
                                          {baseRemaining > 0 && (
                                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-start sm:justify-center w-full gap-1">
                                              Maksimal: <span className="font-bold text-slate-700 dark:text-slate-300">{maxInSelectedUnit} {selectedUnit.unit_name}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base">Informasi Retur</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-3 flex flex-col">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Alasan Retur <span className="text-red-500">*</span>
                            </label>
                            <Select value={reason} onValueChange={setReason}>
                              <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-orange-400 focus:border-orange-400 transition-all font-medium">
                                <SelectValue placeholder="Pilih alasan pengembalian..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Barang Rusak/Cacat" className="font-medium">Barang Rusak / Cacat</SelectItem>
                                <SelectItem value="Barang Kadaluarsa" className="font-medium">Barang Kadaluarsa</SelectItem>
                                <SelectItem value="Salah Produk/Varian" className="font-medium">Salah Produk / Varian</SelectItem>
                                <SelectItem value="Tidak Sesuai Pesanan" className="font-medium">Tidak Sesuai Pesanan</SelectItem>
                                <SelectItem value="Toko Tutup" className="font-medium">Toko Tutup</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-3 flex flex-col">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Catatan Tambahan
                            </label>
                            <textarea
                              className="w-full flex-1 min-h-[48px] p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:border-orange-400 transition-all resize-none font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                              placeholder="Opsional: Tuliskan detail kendala di sini..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-full pointer-events-none -mr-10 -mt-10"></div>
                          
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-100 dark:border-slate-700">
                                <Receipt className="w-6 h-6 text-slate-400" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-500 mb-1">Total Barang Diretur</div>
                                <div className="font-bold text-slate-900 dark:text-white text-lg">{totalRefundItems} <span className="text-sm font-medium text-slate-500">items</span></div>
                              </div>
                            </div>
                            
                            <div className="w-full sm:w-auto h-px sm:h-12 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                            <div className="w-full sm:hidden h-px bg-slate-200 dark:bg-slate-700"></div>

                            <div className="flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end w-full sm:w-auto">
                              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Refund</div>
                              <div className="text-2xl sm:text-3xl font-extrabold text-orange-600 dark:text-orange-400 tracking-tight">
                                {formatRupiah(totalRefundAmount)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <Button
                          className="w-full gap-2 h-14 text-base font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none disabled:shadow-none"
                          size="lg"
                          onClick={handleSubmitReturn}
                          disabled={totalRefundItems === 0 || !reason || createReturn.isPending}
                        >
                          <CheckCircle2 className="w-6 h-6" />
                          {createReturn.isPending ? "Memproses Retur..." : "Konfirmasi & Proses Retur"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle>Menunggu Konfirmasi</CardTitle>
                  <CardDescription>Daftar retur penjualan yang masih berstatus pending</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {renderTable(pendingReturns, "Belum ada retur yang menunggu konfirmasi.", <Clock className="w-12 h-12 mb-3" />)}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle>Riwayat Selesai</CardTitle>
                  <CardDescription>Daftar seluruh laporan retur yang telah diproses/selesai</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {renderTable(completedReturns, "Belum ada riwayat retur yang selesai.", <History className="w-12 h-12 mb-3" />)}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedReturn} onOpenChange={(open) => !open && setSelectedReturn(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
            <DialogTitle className="flex items-center justify-between text-lg">
              <span>Detail Retur</span>
              {selectedReturn && (
                <Badge variant="outline" className="font-mono bg-slate-50 dark:bg-slate-900 text-sm py-1 px-3">
                  {formatInvoiceNumber(selectedReturn.transaction_id)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedReturn?.status === 'pending' ? 'Menunggu konfirmasi admin' : 'Telah dikonfirmasi/selesai'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/20">
            {selectedReturn && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Tanggal</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {new Date(selectedReturn.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Pelanggan</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedReturn.customers?.name || 'Umum'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Sales</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedReturn.cashier_name}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Total Refund</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatRupiah(selectedReturn.total_refund)}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl">
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mb-1">Alasan Retur</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedReturn.reason}</p>
                  {selectedReturn.notes && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 pt-2 border-t border-orange-200/50 dark:border-orange-900/50 italic">
                      Catatan: {selectedReturn.notes}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <PackageOpen className="w-4 h-4 text-primary" /> Barang yang Diretur
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-medium text-slate-500">Produk</th>
                          <th className="px-4 py-3 font-medium text-slate-500 text-center">Jml</th>
                          <th className="px-4 py-3 font-medium text-slate-500 text-right">Refund/Item</th>
                          <th className="px-4 py-3 font-medium text-slate-500 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedReturn.sales_return_items?.map((item: any) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {item.products?.image_url ? (
                                  <img
                                    src={getProductImageUrl(item.products.image_url)}
                                    alt={item.product_name}
                                    className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-700"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                    <Package className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <div className="font-medium text-slate-900 dark:text-slate-100">{item.product_name}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold">{item.quantity}</span> <span className="text-xs text-slate-500">{item.unit_name || 'PCS'}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                              {formatRupiah(item.refund_price)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatRupiah(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                        {(!selectedReturn.sales_return_items || selectedReturn.sales_return_items.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                              Rincian item tidak tersedia.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSelectedReturn(null)}>Tutup</Button>
            {selectedReturn?.status === 'pending' && isAdmin && (
              <Button
                onClick={() => {
                  if (confirm(`Konfirmasi retur ini?`)) {
                    confirmReturn.mutate({ returnId: selectedReturn.id }, {
                      onSuccess: () => {
                        toast({ title: "Dikonfirmasi", description: "Retur berhasil disetujui", variant: "success" });
                        setSelectedReturn(null);
                      },
                      onError: (err: any) => toast({ title: "Gagal", description: err.message, variant: "destructive" })
                    });
                  }
                }}
                disabled={confirmReturn.isPending}
              >
                Konfirmasi Retur
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
