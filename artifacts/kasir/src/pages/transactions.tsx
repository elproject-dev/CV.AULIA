import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListTransactions, useListOutlets, useGetTransaction, useDeleteTransaction } from "@workspace/api-client-react";
import { formatRupiah, formatInvoiceNumber } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, CreditCard, Banknote, QrCode, User, History, SlidersHorizontal, Printer, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAIL } from "@/lib/auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import {
  connectToPrinter,
  disconnectPrinter,
  printReceipt,
  getBluetoothPrinterMac,
  isBluetoothAvailable
} from "@/lib/bluetooth-printer";
import {
  showPrinterNotConnectedNotification,
  showPrintSuccessNotification
} from "@/lib/android-notifications";

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

function TransactionReceiptDialog({ 
  transaction: trx, 
  onClose,
  onDeleted
}: { 
  transaction: any | null, 
  onClose: () => void,
  onDeleted: () => void
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [storeInfo, setStoreInfo] = useState(() => ({
    name: localStorage.getItem('storeName') || 'Sbagiamu',
    address: localStorage.getItem('storeAddress') || 'Jl. Contoh Outlet No. 123, Jakarta'
  }));


  const deleteTransaction = useDeleteTransaction();
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const syncStoreInfo = () => {
      setStoreInfo({
        name: localStorage.getItem('storeName') || 'Sbagiamu',
        address: localStorage.getItem('storeAddress') || 'Jl. Contoh Outlet No. 123, Jakarta'
      });
    };
    syncStoreInfo();
    window.addEventListener('storage', syncStoreInfo);
    window.addEventListener('storeSettingsChanged', syncStoreInfo);
    return () => {
      window.removeEventListener('storage', syncStoreInfo);
      window.removeEventListener('storeSettingsChanged', syncStoreInfo);
    };
  }, []);

  const displayedStoreName = trx?.outlets?.store_name || trx?.outlets?.name || storeInfo.name;
  const displayedAddress = trx?.outlets?.address || storeInfo.address;
  const displayedPhone = trx?.outlets?.phone || '';

  const handlePrintReceipt = async () => {
    if (!trx) return;

    if (!isBluetoothAvailable()) {
      void showPrinterNotConnectedNotification('Plugin Bluetooth tidak tersedia di perangkat ini.');
      return;
    }

    const printerMac = getBluetoothPrinterMac();
    if (!printerMac) {
      void showPrinterNotConnectedNotification('Alamat MAC printer belum diatur di pengaturan.');
      return;
    }

    setIsPrinting(true);
    try {
      const isMemberTransaction = trx.customers?.membership_type === "member" || trx.customer_type === "member";
      const receiptCustomerName = trx.customers?.name || trx.customerName || trx.customer_name || "Umum";

      const items = trx.transaction_items?.map((item: any) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: item.price
      })) || [];

      const total = (trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0);
      const showFooter = localStorage.getItem('showFooter') !== 'false';

      const printData = {
        ...trx,
        cashierName: trx.cashier_name,
        items,
        tax: trx.tax || 0,
        ppnPercentage: 11,
        discount: trx.discount || 0,
        discountNote: trx.discount_note || '',
        customerName: receiptCustomerName,
        customerType: trx.customer_type || (isMemberTransaction ? "member" : "regular"),
        total: total,
        amountPaid: trx.amount_paid || 0,
        change: trx.change || 0,
        paymentMethod: trx.payment_method || 'cash',
        storeName: displayedStoreName,
        storeAddress: displayedAddress,
        storePhone: displayedPhone,
        footerMessage: showFooter ? (trx?.outlets?.footer_message || localStorage.getItem('footerMessage') || 'Terima kasih atas kunjungan Anda') : '',
        footerMessage2: showFooter ? (trx?.outlets?.footer_message2 || localStorage.getItem('footerMessage2') || 'Real Brew, Real Bean, Real Coffee') : '',
        footerMessage3: showFooter ? (trx?.outlets?.footer_message3 || localStorage.getItem('footerMessage3') || 'Powered by Tembus Digital') : '',
      };

      const connectionResult = await connectToPrinter(printerMac);
      if (!connectionResult.success) {
        void showPrinterNotConnectedNotification(connectionResult.message);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      const printed = await printReceipt(printData);
      
      if (!printed) {
        void showPrinterNotConnectedNotification('Gagal mencetak struk. Pastikan printer menyala dan terhubung.');
      } else {
        void showPrintSuccessNotification(total, formatInvoiceNumber(trx.id));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      await disconnectPrinter();
    } catch (error) {
      void showPrinterNotConnectedNotification(
        error instanceof Error ? error.message : 'Terjadi kesalahan saat mencetak struk.'
      );
      try {
        await disconnectPrinter();
      } catch (e) {}
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDelete = () => {
    if (!trx) return;
    if (!confirm(`Hapus transaksi ${formatInvoiceNumber(trx.id)}? Tindakan ini tidak bisa dibatalkan.`)) return;

    deleteTransaction.mutate({ id: trx.id }, {
      onSuccess: () => {
        toast({ title: "Transaksi dihapus", description: "Data transaksi berhasil dihapus." });
        onDeleted();
        onClose();
      },
      onError: (error: any) => {
        toast({
          title: "Gagal menghapus transaksi",
          description: error?.message || "Periksa izin delete pada Supabase.",
          variant: "destructive"
        });
      }
    });
  };

  const getPaymentLabel = (method?: string) => {
    switch (method) {
      case 'cash': return 'Tunai';
      case 'qris': return 'QRIS';
      case 'transfer':
      case 'e_wallet':
        return 'Transfer';
      case 'debit_card': return 'Debit';
      case 'credit_card': return 'Kredit';
      default: return method?.replace('_', ' ') || '-';
    }
  };

  return (
    <Dialog open={!!trx} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-50">
        {!trx ? (
          <div className="p-8 text-center text-slate-500">Memuat detail struk...</div>
        ) : (
          <div className="flex flex-col h-full max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-center items-center shrink-0">
              <h2 className="font-bold text-lg">Detail Transaksi</h2>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto bg-white m-4 rounded-xl shadow-sm border border-slate-200 printable-receipt [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b-2 border-dashed border-slate-200">
                <div className="text-center mb-4">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">{displayedStoreName}</h2>
                  <p className="text-xs text-slate-500 mt-1">{displayedAddress}</p>
                  {displayedPhone && <p className="text-xs text-slate-400 mt-0.5">{displayedPhone}</p>}
                </div>
                <div className="flex justify-between items-start">
                  <div className="text-left">
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">
                      {new Date(trx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm text-slate-600 font-medium font-mono">{formatInvoiceNumber(trx.id)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{trx.cashier_name}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4 sm:mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-slate-500">Status</span>
                  <Badge variant={trx.status === "completed" ? "default" : "destructive"} className="text-xs">
                    {trx.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-500">Pelanggan</span>
                  <span className="font-medium text-right">{trx.customers?.name || "Umum"}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-500">Metode</span>
                  <span className="font-medium">{getPaymentLabel(trx.payment_method)}</span>
                </div>
              </div>

              <div className="py-3 sm:py-4 border-y-2 border-dashed border-slate-200 space-y-3 sm:space-y-4 font-mono text-xs sm:text-sm">
                {trx.transaction_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 break-words">{item.product_name}</p>
                      <p className="text-slate-500 mt-0.5 text-xs">{item.quantity} x {formatRupiah(item.price)}</p>
                    </div>
                    <p className="font-bold text-slate-900 whitespace-nowrap text-right">{formatRupiah(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 py-4 sm:py-6 font-mono text-xs sm:text-sm border-b-2 border-dashed border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(trx.subtotal)}</span>
                </div>
                {trx.tax && trx.tax > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak</span>
                    <span>{formatRupiah(trx.tax)}</span>
                  </div>
                ) : null}
                {trx.discount && trx.discount > 0 ? (
                  <div className="flex justify-between text-destructive">
                    <span>Diskon</span>
                    <span>-{formatRupiah(trx.discount)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between font-bold text-sm sm:text-lg pt-3 sm:pt-4">
                  <span className="text-slate-900">TOTAL</span>
                  <span className="text-primary">{formatRupiah((trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0))}</span>
                </div>
              </div>

              {trx.payment_method === 'cash' && (
                <div className="space-y-2 py-4 sm:py-6 font-mono text-xs sm:text-sm border-b-2 border-dashed border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Tunai</span>
                    <span>{formatRupiah(trx.amount_paid || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Kembali</span>
                    <span>{formatRupiah(trx.change || 0)}</span>
                  </div>
                </div>
              )}

              {trx.customers?.membership_type === "member" && (
                <div className="py-4 sm:py-6 border-b-2 border-dashed border-slate-200 font-mono text-xs sm:text-sm space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Status</span>
                    <span className="font-bold text-amber-700">MEMBER</span>
                  </div>
                </div>
              )}

              <div className="mt-6 sm:mt-8 text-center text-slate-400 text-xs">
                <p>Terima kasih atas kunjungan Anda</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex gap-3 shrink-0">
              <Button className="flex-1" variant="outline" onClick={handlePrintReceipt} disabled={isPrinting}>
                <Printer className="w-4 h-4 mr-2" />
                {isPrinting ? "Mencetak..." : "Cetak Struk"}
              </Button>
              {isAdmin && (
                <Button className="flex-1" variant="destructive" onClick={handleDelete} disabled={deleteTransaction.isPending}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionsPage() {
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [outletFilter, setOutletFilter] = useState<string>("all");
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [cashiers, setCashiers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  const { user } = useAuth();
  const isAdminSuper = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const { data: outlets } = useListOutlets();

  const { data: transactions, isLoading, refetch } = useListTransactions({
    paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
    outletFilter: outletFilter === "all" ? undefined : outletFilter,
    cashierFilter: cashierFilter === "all" ? undefined : cashierFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 30,
    offset: (page - 1) * ITEMS_PER_PAGE
  });

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
    return subtotal + tax - discount;
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
                      {/* Cashier Filter */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Sales</label>
                        <Select value={cashierFilter} onValueChange={(v) => { setCashierFilter(v); setPage(1); }}>
                          <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                            <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <SelectValue placeholder="Semua Sales" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Sales</SelectItem>
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
                  const customerName = trx.customers?.membership_type && trx.customers.membership_type !== 'non_member'
                    ? trx.customers.name
                    : "Umum";

                  return (
                    <div 
                      key={trx.id} 
                      onClick={() => setSelectedTransaction(trx)}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/20 hover:shadow-md active:bg-primary/5 transition-all duration-200"
                    >
                      {/* Row 1: Invoice + Total */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-base">
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
                          </span>
                          <span className="text-xs text-slate-400">
                            {trx.cashier_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-700 whitespace-nowrap">
                          {getPaymentIcon(trx.payment_method)}
                          {getPaymentLabel(trx.payment_method)}
                        </div>
                      </div>
                    </div>
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

                  <TableHead className="text-center">Sales</TableHead>
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

                  return (
                    <TableRow
                      key={trx.id}
                      className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                      onClick={() => setSelectedTransaction(trx)}
                    >
                      <TableCell>
                        <div className="font-bold text-slate-900 dark:text-white">{formatInvoiceNumber(trx.id)}</div>
                        <div className="text-xs text-slate-500">{formatTransactionHistoryDate(trx.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {trx.customers?.membership_type && trx.customers.membership_type !== 'non_member'
                            ? trx.customers.name
                            : "Umum"}
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
      
      {/* Transaction Detail Pop-up */}
      {selectedTransaction && (
        <TransactionReceiptDialog 
          transaction={selectedTransaction} 
          onClose={() => setSelectedTransaction(null)}
          onDeleted={() => {
            setSelectedTransaction(null);
            refetch();
          }}
        />
      )}
    </Sidebar>
  );
}
