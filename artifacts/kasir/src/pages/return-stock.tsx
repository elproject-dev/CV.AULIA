import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListLoadingSessions, useListLoadingItems, useCloseLoadingSession } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { PackageOpen, Save, AlertCircle, ArrowLeft, CheckCircle2, History } from "lucide-react";

export default function ReturnStockPage() {
  const { toast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [returnItems, setReturnItems] = useState<Record<number, number>>({}); // loading_item_id -> actual_return
  const [notes, setNotes] = useState("");

  const { data: activeSessions, isLoading: isLoadingSessions } = useListLoadingSessions({ status: 'active' });
  const { data: loadingItems, isLoading: isLoadingItems } = useListLoadingItems(selectedSessionId || undefined);
  
  const closeSession = useCloseLoadingSession();

  // Initialize returnItems when loadingItems changes
  useEffect(() => {
    if (loadingItems && loadingItems.length > 0) {
      const initialReturns: Record<number, number> = {};
      loadingItems.forEach((item: any) => {
        const expectedReturn = Math.max(0, item.quantity_loaded - item.quantity_sold - item.quantity_returned);
        initialReturns[item.id] = expectedReturn;
      });
      setReturnItems(initialReturns);
    } else {
      setReturnItems({});
    }
  }, [loadingItems]);

  const handleReturnChange = (itemId: number, value: string) => {
    const val = parseInt(value) || 0;
    setReturnItems(prev => ({
      ...prev,
      [itemId]: Math.max(0, val)
    }));
  };

  const handleCloseSession = () => {
    if (!selectedSessionId) return;

    if (!confirm("Apakah Anda yakin ingin menutup sesi loading ini dan mengembalikan sisa stok ke Gudang?")) {
      return;
    }

    const itemsToProcess = loadingItems?.map((item: any) => ({
      loading_item_id: item.id,
      product_id: item.product_id,
      actual_return: returnItems[item.id] || 0
    })) || [];

    closeSession.mutate({
      sessionId: selectedSessionId,
      items: itemsToProcess,
      notes: notes
    }, {
      onSuccess: () => {
        toast({
          title: "Sukses",
          description: "Sesi loading berhasil ditutup dan stok dikembalikan ke Gudang.",
          variant: "success"
        });
        setSelectedSessionId("");
        setNotes("");
      },
      onError: (err: any) => {
        toast({
          title: "Gagal",
          description: err.message || "Gagal menutup sesi loading.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <PackageOpen className="w-8 h-8 text-indigo-500" />
              Return Stock Sales (Closing)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Tutup sesi loading dan kembalikan sisa barang dari Sales ke Gudang
            </p>
          </div>
        </div>

        <Card className="border-indigo-100 dark:border-indigo-900/30 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
              Pilih Sesi Loading Aktif
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="max-w-md">
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Pilih Sesi Loading --" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSessions ? (
                    <SelectItem value="loading" disabled>Loading data...</SelectItem>
                  ) : activeSessions?.length === 0 ? (
                    <SelectItem value="empty" disabled>Tidak ada sesi loading aktif</SelectItem>
                  ) : (
                    activeSessions?.map((session: any) => (
                      <SelectItem key={session.id} value={session.id}>
                        {new Date(session.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })} - {session.staff?.name || 'Sales Tidak Diketahui'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedSessionId && (
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg">Detail Barang Bawaan</CardTitle>
              <CardDescription>
                Sesuaikan jumlah aktual barang yang dikembalikan. Sistem secara otomatis menghitung Sisa Stok (Dibawa - Terjual).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingItems ? (
                <div className="p-8 text-center text-slate-500">Memuat data barang...</div>
              ) : loadingItems?.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Sesi ini tidak memiliki barang bawaan.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      <tr>
                        <th className="px-6 py-4">Produk</th>
                        <th className="px-6 py-4 text-center">Bawa (Awal)</th>
                        <th className="px-6 py-4 text-center">Terjual (POS)</th>
                        <th className="px-6 py-4 text-center">Sisa (Sistem)</th>
                        <th className="px-6 py-4 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">Kembali (Aktual)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loadingItems?.map((item: any) => {
                        const expectedReturn = Math.max(0, item.quantity_loaded - item.quantity_sold - item.quantity_returned);
                        const actualReturn = returnItems[item.id] ?? expectedReturn;
                        const difference = actualReturn - expectedReturn;
                        
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {item.products?.name || 'Produk Dihapus'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400">
                              {item.quantity_loaded}
                            </td>
                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400">
                              {item.quantity_sold}
                            </td>
                            <td className="px-6 py-4 text-center font-medium">
                              {expectedReturn}
                            </td>
                            <td className="px-6 py-4 bg-indigo-50/30 dark:bg-indigo-900/10">
                              <div className="flex flex-col items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  className={`w-24 text-center font-bold ${difference !== 0 ? 'border-orange-400 focus-visible:ring-orange-400 text-orange-600' : 'border-slate-200'}`}
                                  value={actualReturn}
                                  onChange={(e) => handleReturnChange(item.id, e.target.value)}
                                />
                                {difference !== 0 && (
                                  <span className="text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Selisih {difference > 0 ? `+${difference}` : difference}
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
            <CardFooter className="bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col items-stretch gap-4">
              <div className="w-full">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Catatan Closing (Opsional)
                </label>
                <Input 
                  placeholder="Tambahkan catatan closing jika ada selisih barang, dsb..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-3 w-full pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="outline" onClick={() => setSelectedSessionId("")}>
                  Batal
                </Button>
                <Button 
                  onClick={handleCloseSession} 
                  disabled={closeSession.isPending || !loadingItems || loadingItems.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                >
                  <Save className="w-4 h-4" />
                  {closeSession.isPending ? "Menyimpan..." : "Tutup Sesi & Kembalikan Stok"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </Sidebar>
  );
}
