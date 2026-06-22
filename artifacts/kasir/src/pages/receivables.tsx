import { useState, useMemo } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListReceivables, useListTransactionPayments, useCreateTransactionPayment, useGetTransaction } from "@workspace/api-client-react";
import { formatRupiah, formatInvoiceNumber, formatSimpleDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Banknote, Calendar, User, ChevronRight, AlertCircle, CheckCircle2, Clock, History, TrendingDown, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthUserName } from "@/contexts/AuthContext";

export default function ReceivablesPage() {
  const { toast } = useToast();
  const cashierName = useAuthUserName();
  const [search, setSearch] = useState("");
  const [salesFilter, setSalesFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<'outstanding' | 'history'>('outstanding');
  const { data: receivables, isLoading, refetch } = useListReceivables();

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: paymentsHistory, isLoading: isLoadingHistory } = useListTransactionPayments(selectedTransaction?.id || null);
  const createPayment = useCreateTransactionPayment();

  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const { data: detailTransaction, isLoading: isLoadingDetail } = useGetTransaction(selectedDetailId || 0);

  const uniqueSales = useMemo(() => {
    if (!receivables) return [];
    return Array.from(new Set(receivables.map((r: any) => r.cashier_name).filter(Boolean))) as string[];
  }, [receivables]);

  const { totalPiutang, piutangJatuhTempo, transaksiBerjalan, totalSudahDibayar } = useMemo(() => {
    let tPiutang = 0;
    let tJatuhTempo = 0;
    let tBerjalan = 0;
    let tDibayar = 0;

    if (receivables) {
      receivables.forEach((r: any) => {
        const isOverdue = r.due_date ? new Date(r.due_date) < new Date() : false;
        
        if (r.payment_status !== 'paid') {
          tPiutang += r.remaining_balance;
          tBerjalan += 1;
          if (isOverdue) tJatuhTempo += r.remaining_balance;
        }

        const totalTagihan = (r.subtotal || 0) + (r.tax || 0) - (r.discount || 0);
        tDibayar += (totalTagihan - r.remaining_balance);
      });
    }

    return { totalPiutang: tPiutang, piutangJatuhTempo: tJatuhTempo, transaksiBerjalan: tBerjalan, totalSudahDibayar: tDibayar };
  }, [receivables]);

  const animatedTotalPiutang = useCountUp(totalPiutang, { duration: 1200 });
  const animatedPiutangJatuhTempo = useCountUp(piutangJatuhTempo, { duration: 1400 });
  const animatedTransaksiBerjalan = useCountUp(transaksiBerjalan, { duration: 1000 });
  const animatedTotalSudahDibayar = useCountUp(totalSudahDibayar, { duration: 1600 });

  const filteredReceivables = receivables?.filter((r: any) => {
    // Filter by tab first:
    if (activeTab === 'outstanding' && r.payment_status === 'paid') return false;
    if (activeTab === 'history' && r.payment_status !== 'paid') return false;

    // Filter by sales
    if (salesFilter !== 'all' && r.cashier_name !== salesFilter) return false;

    // Filter by search:
    if (!search || search.length < 3) return true;
    const s = search.toLowerCase();
    const customerName = r.customer?.name?.toLowerCase() || r.customer_name?.toLowerCase() || '';
    const invoiceNum = formatInvoiceNumber(r.id).toLowerCase();
    return customerName.includes(s) || r.id.toString().includes(s) || invoiceNum.includes(s);
  });

  const handleOpenPayment = (trx: any) => {
    setSelectedTransaction(trx);
    setPaymentAmount(trx.remaining_balance.toLocaleString("id-ID"));
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (!value) {
      setPaymentAmount("");
      return;
    }
    const formatted = parseInt(value, 10).toLocaleString("id-ID");
    setPaymentAmount(formatted);
  };

  const handleRowClick = (trx: any) => {
    setSelectedDetailId(trx.id);
    setIsDetailModalOpen(true);
  };

  const handleSubmitPayment = () => {
    const rawAmount = paymentAmount.replace(/\D/g, "");
    const amount = Number(rawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Nominal pembayaran tidak valid", variant: "destructive" });
      return;
    }

    if (amount > selectedTransaction.remaining_balance) {
      toast({ title: "Error", description: "Nominal pembayaran melebihi sisa tagihan", variant: "destructive" });
      return;
    }

    createPayment.mutate({
      transactionId: selectedTransaction.id,
      amount: amount,
      paymentMethod: "cash", // Bawaan cash untuk cicilan, bisa dikembangkan
      cashierName: cashierName,
      notes: paymentNotes
    }, {
      onSuccess: () => {
        toast({ title: "Sukses", description: "Pembayaran berhasil dicatat" });
        setIsPaymentModalOpen(false);
        setSelectedTransaction(null);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Gagal mencatat pembayaran", variant: "destructive" });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'partial') return <Badge className="bg-amber-500 hover:bg-amber-600">Cicilan</Badge>;
    if (status === 'unpaid') return <Badge variant="destructive">Belum Bayar</Badge>;
    return <Badge className="bg-emerald-500 hover:bg-emerald-600">Lunas</Badge>;
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Banknote className="w-6 h-6 text-primary" />
            Piutang Pelanggan
          </h1>
        </div>

        {/* Tabs Switcher */}
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button
            onClick={() => setActiveTab('outstanding')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'outstanding'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Clock className="w-4 h-4" />
            Belum Lunas
            {receivables?.filter((r: any) => r.payment_status !== 'paid').length > 0 && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {receivables.filter((r: any) => r.payment_status !== 'paid').length}
              </span>
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
            Riwayat Lunas
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 items-stretch">
            {/* Total Piutang */}
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Piutang Belum Lunas</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatRupiah(animatedTotalPiutang.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Banknote className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-blue-200">{receivables?.filter((r: any) => r.payment_status !== 'paid').length || 0} faktur aktif</p>
              </div>
            </div>

            {/* Jatuh Tempo */}
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-red-100 text-xs sm:text-sm font-medium">Piutang Jatuh Tempo</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatRupiah(animatedPiutangJatuhTempo.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-red-200">{receivables?.filter((r: any) => r.payment_status !== 'paid' && r.due_date && new Date(r.due_date) < new Date()).length || 0} faktur menunggak</p>
              </div>
            </div>

            {/* Transaksi Berjalan */}
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-purple-100 text-xs sm:text-sm font-medium">Transaksi Berjalan</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {animatedTransaksiBerjalan.value} <span className="text-sm font-normal text-purple-200">faktur</span>
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Receipt className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-purple-200">total semua transaksi piutang</p>
              </div>
            </div>

            {/* Total Sudah Dibayar */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-emerald-100 text-xs sm:text-sm font-medium">Total Sudah Dibayar</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatRupiah(animatedTotalSudahDibayar.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-emerald-200">dari seluruh tagihan lunas/cicilan</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <Input
                placeholder="Cari ID Transaksi / Nama Pelanggan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select value={salesFilter} onValueChange={setSalesFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Sales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sales</SelectItem>
                  {uniqueSales.map((sales: string) => (
                    <SelectItem key={sales} value={sales}>{sales}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="whitespace-nowrap w-[130px]">ID Transaksi</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[120px]">Tgl Transaksi</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[180px]">Pelanggan</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Jatuh Tempo</TableHead>
                  <TableHead className="whitespace-nowrap text-right min-w-[140px]">Total Transaksi</TableHead>
                  <TableHead className="whitespace-nowrap text-right min-w-[140px]">Sisa Tagihan</TableHead>
                  <TableHead className="whitespace-nowrap text-center min-w-[130px]">Sales</TableHead>
                  <TableHead className="whitespace-nowrap text-center min-w-[110px]">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right min-w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Memuat...</TableCell></TableRow>
                ) : filteredReceivables?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      {activeTab === 'outstanding' ? (
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                          <p className="text-lg font-medium text-slate-900 dark:text-white">Semua Piutang Lunas!</p>
                          <p className="text-sm">Tidak ada pelanggan yang menunggak pembayaran saat ini.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <FileText className="w-12 h-12 text-slate-300 mb-3" />
                          <p className="text-lg font-medium text-slate-900 dark:text-white">Belum Ada Riwayat Pelunasan</p>
                          <p className="text-sm">Riwayat pelunasan piutang yang selesai akan muncul di sini.</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceivables?.map((trx: any) => {
                    const isOverdue = trx.due_date ? new Date(trx.due_date) < new Date() : false;
                    return (
                      <TableRow key={trx.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => handleRowClick(trx)}>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatInvoiceNumber(trx.id)}</TableCell>
                        <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                          {formatSimpleDate(trx.created_at)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap truncate max-w-[200px]">
                          {trx.customer?.name || trx.customer_name || 'Umum'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className={`flex items-center gap-1.5 text-sm ${isOverdue && trx.payment_status !== 'paid' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                            {isOverdue && trx.payment_status !== 'paid' && <AlertCircle className="w-3.5 h-3.5" />}
                            {formatSimpleDate(trx.due_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{formatRupiah((trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0))}</TableCell>
                        <TableCell className={`text-right font-bold whitespace-nowrap ${trx.payment_status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatRupiah(trx.remaining_balance)}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[130px]">{trx.cashier_name || '-'}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">{getStatusBadge(trx.payment_status)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button 
                            size="sm" 
                            variant={activeTab === 'history' ? "outline" : "default"} 
                            className={activeTab === 'outstanding' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                            onClick={(e) => { e.stopPropagation(); handleOpenPayment(trx); }}
                          >
                            {activeTab === 'history' ? "Detail" : "Proses Bayar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Payment Modal */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {selectedTransaction?.payment_status === 'paid' ? "Detail Pelunasan Piutang" : "Pembayaran Piutang"}
              </DialogTitle>
              <DialogDescription>
                {selectedTransaction?.payment_status === 'paid'
                  ? "Riwayat lengkap pelunasan piutang pelanggan."
                  : "Catat pembayaran cicilan atau pelunasan hutang pelanggan."}
              </DialogDescription>
            </DialogHeader>

            {selectedTransaction && (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Sisa Tagihan</p>
                    <p className={`font-bold text-lg ${selectedTransaction.payment_status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {selectedTransaction.payment_status === 'paid' ? 'Lunas' : formatRupiah(selectedTransaction.remaining_balance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Pelanggan</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedTransaction.customer?.name || selectedTransaction.customer_name}</p>
                  </div>
                </div>

                {selectedTransaction.payment_status !== 'paid' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nominal Pembayaran</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={paymentAmount}
                        onChange={handlePaymentAmountChange}
                        placeholder="Contoh: 50.000"
                      />
                      <p className="text-xs text-slate-500">Maksimal: {formatRupiah(selectedTransaction.remaining_balance)}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Catatan (Opsional)</label>
                      <Input
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Contoh: Transfer Bank BCA / DP Tahap 2"
                      />
                    </div>
                  </>
                )}

                {/* History Cicilan */}
                {!isLoadingHistory && paymentsHistory && paymentsHistory.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-medium mb-3">Histori Cicilan</p>
                    <div className="space-y-2 max-h-[150px] overflow-auto pr-2">
                      {paymentsHistory.map((p: any) => (
                        <div key={p.id} className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">{formatSimpleDate(p.payment_date)}</p>
                              <div className="mt-1.5">
                                <span className="bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 capitalize">
                                  {p.payment_method === 'cash' ? 'Tunai' : p.payment_method}
                                </span>
                              </div>
                            </div>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">+{formatRupiah(p.amount)}</p>
                          </div>
                          {p.notes && (
                            <div className="bg-slate-50 dark:bg-slate-800/80 rounded px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 w-fit">
                              {p.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {selectedTransaction?.payment_status === 'paid' ? (
                <Button onClick={() => setIsPaymentModalOpen(false)}>Tutup</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Batal</Button>
                  <Button onClick={handleSubmitPayment} disabled={createPayment.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {createPayment.isPending ? "Menyimpan..." : "Simpan Pembayaran"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Rincian Transaksi</DialogTitle>
              <DialogDescription>
                Detail item transaksi untuk Invoice {selectedDetailId ? formatInvoiceNumber(selectedDetailId) : ''}
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetail ? (
              <div className="py-8 flex justify-center items-center text-slate-500">
                Memuat rincian...
              </div>
            ) : detailTransaction ? (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Pelanggan</p>
                    <p className="font-medium text-slate-900 dark:text-white">{detailTransaction.customers?.name || detailTransaction.customer?.name || detailTransaction.customer_name || 'Umum'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Sales</p>
                    <p className="font-medium text-slate-900 dark:text-white">{detailTransaction.cashier_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Tgl Transaksi</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatSimpleDate(detailTransaction.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Jatuh Tempo</p>
                    <p className="font-medium text-slate-900 dark:text-white">{detailTransaction.due_date ? formatSimpleDate(detailTransaction.due_date) : '-'}</p>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800">
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailTransaction.transaction_items?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right">{formatRupiah(item.price)}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right font-medium">{formatRupiah(item.price * item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-slate-500">
                    <p className="text-sm">Subtotal: {formatRupiah(detailTransaction.subtotal)}</p>
                    {detailTransaction.tax > 0 && <p className="text-sm">Pajak: {formatRupiah(detailTransaction.tax)}</p>}
                    {detailTransaction.discount > 0 && <p className="text-sm">Diskon: -{formatRupiah(detailTransaction.discount)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Total Transaksi</p>
                    <p className="text-xl font-bold text-primary">{formatRupiah((detailTransaction.subtotal || 0) + (detailTransaction.tax || 0) - (detailTransaction.discount || 0))}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                Gagal memuat detail transaksi.
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Sidebar>
  );
}
