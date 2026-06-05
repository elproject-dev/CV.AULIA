import { Sidebar } from "@/components/layout/Sidebar";
import { useGetTransaction, getGetTransactionQueryKey } from "@workspace/api-client-react";
import { formatRupiah, formatDate } from "@/lib/formatters";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TransactionDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: trx, isLoading } = useGetTransaction(id, {
    query: { enabled: !!id, queryKey: getGetTransactionQueryKey(id) }
  });

  if (isLoading) return <Sidebar><div className="p-8">Memuat...</div></Sidebar>;
  if (!trx) return <Sidebar><div className="p-8">Transaksi tidak ditemukan</div></Sidebar>;

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
            <h1 className="text-2xl font-bold text-slate-900">Detail Transaksi #{trx.id}</h1>
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
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">KASIR PRO</h2>
                <p className="text-sm text-slate-500 mt-1">Jl. Contoh Outlet No. 123, Jakarta</p>
                <div className="flex justify-between items-center mt-6 text-sm text-slate-600 font-mono">
                  <span>{formatDate(trx.createdAt)}</span>
                  <span>Op: {trx.cashierName}</span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Pelanggan</span>
                  <span className="font-medium">{trx.customerName || "Umum"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <Badge variant={trx.status === "completed" ? "default" : "destructive"}>
                    {trx.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Metode</span>
                  <span className="font-medium uppercase">{trx.paymentMethod.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="py-4 border-y-2 border-dashed border-slate-200 space-y-4 font-mono text-sm">
                {trx.items?.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div className="pr-4">
                      <p className="font-medium text-slate-900">{item.productName}</p>
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
                <div className="flex justify-between text-slate-600">
                  <span>Pajak (11%)</span>
                  <span>{formatRupiah(trx.tax)}</span>
                </div>
                {trx.discount && trx.discount > 0 ? (
                  <div className="flex justify-between text-destructive">
                    <span>Diskon</span>
                    <span>-{formatRupiah(trx.discount)}</span>
                  </div>
                ) : null}
                {trx.pointsUsed && trx.pointsUsed > 0 ? (
                  <div className="flex justify-between text-amber-600">
                    <span>Poin Digunakan</span>
                    <span>-{trx.pointsUsed} Pts</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-lg pt-4">
                  <span className="text-slate-900">TOTAL</span>
                  <span className="text-primary">{formatRupiah(trx.total)}</span>
                </div>
              </div>

              {trx.paymentMethod === 'cash' && (
                <div className="space-y-2 py-6 font-mono text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Tunai</span>
                    <span>{formatRupiah(trx.amountPaid || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Kembali</span>
                    <span>{formatRupiah(trx.change || 0)}</span>
                  </div>
                </div>
              )}

              {trx.pointsEarned > 0 && (
                <div className="mt-6 bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                  <p className="text-amber-700 text-sm font-medium">
                    Mendapatkan <span className="font-bold">{trx.pointsEarned} Poin</span> dari transaksi ini
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
