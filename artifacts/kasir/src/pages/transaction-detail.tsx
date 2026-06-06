import { Sidebar } from "@/components/layout/Sidebar";
import { useGetTransaction } from "@workspace/api-client-react";
import { formatRupiah, formatDate, formatInvoiceNumber } from "@/lib/formatters";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export default function TransactionDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [storeInfo, setStoreInfo] = useState(() => ({
    name: localStorage.getItem('storeName') || 'Sbagiamu',
    address: localStorage.getItem('storeAddress') || 'Jl. Contoh Outlet No. 123, Jakarta'
  }));
  const [enablePPN, setEnablePPN] = useState(() => {
    return localStorage.getItem('enablePPN') === 'true';
  });
  
  const { data: trx, isLoading } = useGetTransaction(id);

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

  if (isLoading) return <Sidebar><div className="p-8">Memuat...</div></Sidebar>;
  if (!trx) return <Sidebar><div className="p-8">Transaksi tidak ditemukan</div></Sidebar>;

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

  // Get points settings for calculating points value
  const getPointsSettings = () => {
    const enablePoints = localStorage.getItem('enablePoints') === 'true';
    const pointsValue = parseInt(localStorage.getItem('pointsValue') || '1000');
    return { enablePoints, pointsValue };
  };

  const { enablePoints, pointsValue } = getPointsSettings();
  const displayedTax = enablePPN ? trx.tax || 0 : 0;
  const pointsDiscount = (trx.points_used || 0) * pointsValue;
  const total = (trx.subtotal || 0) + displayedTax - (trx.discount || 0) - pointsDiscount;

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/transactions">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Detail Transaksi {formatInvoiceNumber(trx.id)}</h1>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Cetak Struk
          </Button>
        </div>
        
        <div className="p-6 flex-1 overflow-auto flex justify-center">
          <Card className="w-full max-w-lg shadow-lg border-slate-200 my-4 h-max printable-receipt">
            <CardContent className="p-8">
              <div className="text-center mb-8 pb-6 border-b-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                  <Receipt className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{storeInfo.name}</h2>
                <p className="text-sm text-slate-500 mt-1">{storeInfo.address}</p>
                <p className="text-xs text-slate-600 font-mono mt-2">Invoice: {formatInvoiceNumber(trx.id)}</p>
                <div className="flex justify-between items-center mt-4 text-sm text-slate-600 font-mono">
                  <span>{formatDate(trx.created_at)}</span>
                  <span>Op: {trx.cashier_name}</span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Pelanggan</span>
                  <span className="font-medium">{trx.customers?.name || "Umum"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <Badge variant={trx.status === "completed" ? "default" : "destructive"}>
                    {trx.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Metode</span>
                  <span className="font-medium">{getPaymentLabel(trx.payment_method)}</span>
                </div>
              </div>

              <div className="py-4 border-y-2 border-dashed border-slate-200 space-y-4 font-mono text-sm">
                {trx.transaction_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <div className="pr-4">
                      <p className="font-medium text-slate-900">{item.product_name}</p>
                      <p className="text-slate-500 mt-0.5">{item.quantity} x {formatRupiah(item.price)}</p>
                    </div>
                    <p className="font-bold text-slate-900">{formatRupiah(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 py-6 font-mono text-sm border-b-2 border-dashed border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(trx.subtotal)}</span>
                </div>
                {enablePPN && (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak (11%)</span>
                    <span>{formatRupiah(trx.tax)}</span>
                  </div>
                )}
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
                <div className="flex justify-between font-bold text-lg pt-4">
                  <span className="text-slate-900">TOTAL</span>
                  <span className="text-primary">{formatRupiah(total)}</span>
                </div>
              </div>

              {trx.payment_method === 'cash' && (
                <div className="space-y-2 py-6 font-mono text-sm">
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
                <div className="py-6 border-t-2 border-dashed border-slate-200 font-mono text-sm space-y-2">
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

              {trx.points_earned > 0 && (
                <div className="mt-6 bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                  <p className="text-amber-700 text-sm font-medium">
                    Mendapatkan <span className="font-bold">{trx.points_earned} Poin</span> dari transaksi ini
                  </p>
                </div>
              )}

              <div className="mt-8 text-center text-slate-400 text-xs">
                <p>Terima kasih atas kunjungan Anda!</p>
                <p className="mt-1">Barang yang sudah dibeli tidak dapat ditukar</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}
