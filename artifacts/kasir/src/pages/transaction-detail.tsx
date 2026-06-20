import { Sidebar } from "@/components/layout/Sidebar";
import { useDeleteTransaction, useGetTransaction } from "@workspace/api-client-react";
import { formatRupiah, formatDate, formatInvoiceNumber } from "@/lib/formatters";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Receipt, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/auth";
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

  const enablePoints = getVal('enablePoints', 'true') === 'true';
  const pointsValue = parseInt(getVal('pointsValue', '1000'));
  return { enablePoints, pointsValue };
};

export default function TransactionDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const id = parseInt(params.id || "0");
  const [storeInfo, setStoreInfo] = useState(() => ({
    name: localStorage.getItem('storeName') || 'Sbagiamu',
    address: localStorage.getItem('storeAddress') || 'Jl. Contoh Outlet No. 123, Jakarta'
  }));
  const [enablePPN, setEnablePPN] = useState(() => {
    return localStorage.getItem('enablePPN') === 'true';
  });

  // Check if user is admin (only sbagiamu.pos@gmail.com)
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  
  const { data: trx, isLoading } = useGetTransaction(id);
  const deleteTransaction = useDeleteTransaction();
  const [isPrinting, setIsPrinting] = useState(false);

  const displayedStoreName = trx?.outlets?.store_name || trx?.outlets?.name || storeInfo.name;
  const displayedAddress = trx?.outlets?.address || storeInfo.address;
  const displayedPhone = trx?.outlets?.phone || '';

  const handlePrintReceipt = async () => {
    if (!trx) return;

    if (!isBluetoothAvailable()) {
      console.error('Bluetooth plugin not available');
      void showPrinterNotConnectedNotification('Plugin Bluetooth tidak tersedia di perangkat ini.');
      return;
    }

    const printerMac = getBluetoothPrinterMac();
    if (!printerMac) {
      console.error('Printer MAC not set');
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

      const { pointsValue } = getPointsSettingsForUser(user);
      const pointsDiscount = (trx.points_used || 0) * pointsValue;
      const finalCustomerPoints = isMemberTransaction
        ? Math.max(0, (trx.customers?.points || 0))
        : 0;

      const total = (trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0) - pointsDiscount;

      const showFooter = localStorage.getItem('showFooter') !== 'false';
      const printData = {
        ...trx,
        cashierName: trx.cashier_name,
        items,
        tax: trx.tax || 0,
        ppnPercentage: 11,
        discount: trx.discount || 0,
        discountNote: trx.discount_note || '',
        pointsRedeemed: trx.points_used || 0,
        pointsDiscount,
        earnedPoints: trx.points_earned || 0,
        finalCustomerPoints,
        pointsValue,
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

      console.log('Connecting to printer...', printerMac);
      const connectionResult = await connectToPrinter(printerMac);
      if (!connectionResult.success) {
        console.error('Connection failed:', connectionResult.message);
        void showPrinterNotConnectedNotification(connectionResult.message);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Printing receipt...', printData);
      
      const printed = await printReceipt(printData);
      if (!printed) {
        console.error('Print failed');
        void showPrinterNotConnectedNotification('Gagal mencetak struk. Pastikan printer menyala dan terhubung.');
      } else {
        const total = (trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0) - pointsDiscount;
        void showPrintSuccessNotification(total, formatInvoiceNumber(trx.id));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      await disconnectPrinter();
    } catch (error) {
      console.error('Print error:', error);
      void showPrinterNotConnectedNotification(
        error instanceof Error ? error.message : 'Terjadi kesalahan saat mencetak struk.'
      );
      try {
        await disconnectPrinter();
      } catch (disconnectError) {
        console.error('Error during disconnect:', disconnectError);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    const syncStoreInfo = () => {
      setStoreInfo({
        name: localStorage.getItem('storeName') || 'Sbagiamu',
        address: localStorage.getItem('storeAddress') || 'Jl. Contoh Outlet No. 123, Jakarta'
      });
      setEnablePPN(localStorage.getItem('enablePPN') === 'true');
    };

    syncStoreInfo();
    window.addEventListener('storage', syncStoreInfo);
    window.addEventListener('storeSettingsChanged', syncStoreInfo);

    return () => {
      window.removeEventListener('storage', syncStoreInfo);
      window.removeEventListener('storeSettingsChanged', syncStoreInfo);
    };
  }, []);

  if (isLoading) return <Sidebar><div className="p-4 sm:p-8">Memuat...</div></Sidebar>;
  if (!trx) return <Sidebar><div className="p-4 sm:p-8">Transaksi tidak ditemukan</div></Sidebar>;

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


  const { enablePoints, pointsValue } = getPointsSettingsForUser(user);
  const displayedTax = trx.tax || 0;
  const pointsDiscount = (trx.points_used || 0) * pointsValue;
  const total = (trx.subtotal || 0) + displayedTax - (trx.discount || 0) - pointsDiscount;

  const handleDelete = () => {
    if (!confirm(`Hapus transaksi ${formatInvoiceNumber(trx.id)}? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }

    deleteTransaction.mutate(
      { id: trx.id },
      {
        onSuccess: () => {
          toast({ title: "Transaksi dihapus", description: "Data transaksi berhasil dihapus." });
          setLocation("/transactions");
        },
        onError: (error: any) => {
          toast({
            title: "Gagal menghapus transaksi",
            description: error?.message || "Periksa izin delete pada Supabase.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/transactions">
              <Button variant="outline" size="icon" className="rounded-full h-9 w-9 sm:h-10 sm:w-10">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
              Invoice {formatInvoiceNumber(trx.id)}
            </h1>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handlePrintReceipt}
              disabled={isPrinting}
              className="w-full sm:w-auto"
            >
              {isPrinting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  Mencetak...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" /> Cetak Struk
                </>
              )}
            </Button>
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteTransaction.isPending}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteTransaction.isPending ? "Menghapus..." : "Hapus"}
              </Button>
            )}
          </div>
        </div>
        
        {/* Receipt Card */}
        <div className="p-4 sm:p-6 flex-1 overflow-auto flex justify-center">
          <Card className="w-full max-w-lg shadow-lg border-slate-200 my-2 sm:my-4 h-max printable-receipt">
            <CardContent className="p-4 sm:p-8">
              {/* Header */}
              <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b-2 border-dashed border-slate-200">
                {/* Store Name - Centered */}
                <div className="text-center mb-4">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">{displayedStoreName}</h2>
                  <p className="text-xs text-slate-500 mt-1">{displayedAddress}</p>
                  {displayedPhone && (
                    <p className="text-xs text-slate-400 mt-0.5">{displayedPhone}</p>
                  )}
                </div>
                {/* Date/Time - Invoice Row */}
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

              {/* Transaction Info */}
              <div className="space-y-3 mb-4 sm:mb-6">
                {/* Status - Above Customer */}
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

              {/* Items */}
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

              {/* Summary */}
              <div className="space-y-2 py-4 sm:py-6 font-mono text-xs sm:text-sm border-b-2 border-dashed border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(trx.subtotal)}</span>
                </div>
                {trx.tax && trx.tax > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak (11%)</span>
                    <span>{formatRupiah(trx.tax)}</span>
                  </div>
                ) : null}
                {trx.discount && trx.discount > 0 ? (
                  <div className="flex justify-between text-destructive">
                    <span>Diskon</span>
                    <span>-{formatRupiah(trx.discount)}</span>
                  </div>
                ) : null}
                {trx.points_used && trx.points_used > 0 ? (
                  <div className="flex justify-between text-amber-600">
                    <span>Poin Ditukar</span>
                    <span>{trx.points_used} Pts = {formatRupiah(pointsDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-sm sm:text-lg pt-3 sm:pt-4">
                  <span className="text-slate-900">TOTAL</span>
                  <span className="text-primary">{formatRupiah(total)}</span>
                </div>
              </div>

              {/* Cash Payment */}
              {trx.payment_method === 'cash' && (
                <div className="space-y-2 py-4 sm:py-6 font-mono text-xs sm:text-sm">
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

              {/* Member Info */}
              {trx.customers?.membership_type === "member" && (
                <div className="py-4 sm:py-6 border-t-2 border-dashed border-slate-200 font-mono text-xs sm:text-sm space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Status</span>
                    <span className="font-bold text-amber-700">MEMBER</span>
                  </div>
                  {trx.points_earned && trx.points_earned > 0 ? (
                    <div className="flex justify-between text-amber-600">
                      <span>Poin Didapat</span>
                      <span className="font-bold">{(trx.points_earned || 0).toLocaleString('id-ID')} Pts</span>
                    </div>
                  ) : null}
                  {trx.points_used && trx.points_used > 0 ? (
                    <div className="flex justify-between text-amber-600">
                      <span>Poin Ditukar</span>
                      <span className="font-bold">{(trx.points_used || 0).toLocaleString('id-ID')} Pts</span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Points Earned Alert */}
              {trx.points_earned > 0 && (
                <div className="mt-4 sm:mt-6 bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                  <p className="text-amber-700 text-xs sm:text-sm font-medium">
                    Mendapatkan <span className="font-bold">{trx.points_earned} Poin</span> dari transaksi ini
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 sm:mt-8 text-center text-slate-400 text-xs">
                <p>Terima kasih atas kunjungan Anda</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}