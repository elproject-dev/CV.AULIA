import { useState, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { 
  useListLoadingSessions, 
  useCreateLoadingSession, 
  useCreateLoadingItem,
  useCreateStockMovement,
  getListLoadingSessionsQueryKey,
  useListProducts
} from "@/mocks/api-client-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, ArrowRightLeft, User, Calendar, CheckCircle2, ChevronRight, PackageOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function TransferStockPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const { data: sessions, isLoading: isLoadingSessions } = useListLoadingSessions();
  const { data: products } = useListProducts();
  const [staffList, setStaffList] = useState<any[]>([]);

  // Fetch staff
  useMemo(() => {
    supabase.from('staff').select('*').eq('role', 'kasir').then(({ data }) => {
      if (data) setStaffList(data);
    });
  }, []);

  const createSession = useCreateLoadingSession();
  const createItem = useCreateLoadingItem();
  const createMovement = useCreateStockMovement();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    salesId: "",
    notes: ""
  });
  const [selectedItems, setSelectedItems] = useState<{ productId: string, quantity: number }[]>([]);

  const handleOpenDialog = () => {
    setFormData({ salesId: "", notes: "" });
    setSelectedItems([]);
    setIsDialogOpen(true);
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { productId: "", quantity: 1 }]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSelectedItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...selectedItems];
    newItems.splice(index, 1);
    setSelectedItems(newItems);
  };

  const handleSubmit = async () => {
    if (!formData.salesId) {
      toast({ title: "Error", description: "Pilih Sales/Kasir", variant: "destructive" });
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: "Error", description: "Tambahkan minimal 1 produk", variant: "destructive" });
      return;
    }

    // Validate quantities and stock
    for (let item of selectedItems) {
      if (!item.productId || item.quantity <= 0) {
        toast({ title: "Error", description: "Produk dan kuantitas tidak valid", variant: "destructive" });
        return;
      }
      const prod = products?.find((p: any) => p.id.toString() === item.productId);
      if (!prod || (prod.stock_quantity || 0) < item.quantity) {
        toast({ title: "Error", description: `Stok Gudang untuk ${prod?.name || 'Produk'} tidak mencukupi. (Sisa: ${prod?.stock_quantity || 0})`, variant: "destructive" });
        return;
      }
    }

    try {
      // 1. Create Session
      const { data: sessionData, error: sessionError } = await supabase
        .from('loading_sessions')
        .insert([{
          sales_id: parseInt(formData.salesId),
          status: 'active',
          notes: formData.notes
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      const sessionId = sessionData.id;

      // 2. Create Items & Movements
      for (let item of selectedItems) {
        // Create loading item
        await supabase.from('loading_items').insert([{
          loading_session_id: sessionId,
          product_id: parseInt(item.productId),
          quantity_loaded: item.quantity,
          quantity_sold: 0,
          quantity_returned: 0
        }]);

        // Create stock movement (deduct from warehouse)
        await supabase.from('stock_movements').insert([{
          product_id: parseInt(item.productId),
          quantity: -item.quantity, // Negative means OUT
          type: 'transfer_to_sales',
          reference_id: sessionId,
          note: `Transfer to Sales ID ${formData.salesId}`
        }]);

        // Deduct products.stock_quantity
        const prod = products?.find((p: any) => p.id.toString() === item.productId);
        const currentStock = prod?.stock_quantity || 0;
        await supabase.from('products').update({ stock_quantity: currentStock - item.quantity }).eq('id', parseInt(item.productId));
      }

      toast({ title: "Sukses", description: "Transfer stock berhasil disimpan" });
      queryClient.invalidateQueries({ queryKey: getListLoadingSessionsQueryKey() });
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Gagal menyimpan transfer stock", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'active': return <Badge className="bg-blue-500">Aktif (Di Jalan)</Badge>;
      case 'closed': return <Badge className="bg-green-500">Selesai (Closed)</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            Transfer Stock ke Sales
          </h1>
          <Button onClick={handleOpenDialog}>
            <Plus className="w-4 h-4 mr-2" /> Transfer Baru
          </Button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Sales / Kasir</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSessions ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Memuat...</TableCell></TableRow>
                ) : sessions?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Belum ada data transfer stock</TableCell></TableRow>
                ) : (
                  sessions?.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(session.created_at).toLocaleDateString('id-ID')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          {session.staff?.name || 'Unknown Sales'}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">{session.notes || '-'}</TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="w-4 h-4" /> Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Transfer Stock Baru</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Sales / Kasir</label>
                <Select value={formData.salesId} onValueChange={(v) => setFormData({ ...formData, salesId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Sales" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>{staff.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan</label>
                <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Opsional" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <PackageOpen className="w-4 h-4 text-slate-500" />
                  Daftar Produk yang Dibawa
                </h3>
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="w-4 h-4 mr-2" /> Tambah Produk
                </Button>
              </div>

              {selectedItems.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
                  Belum ada produk yang ditambahkan
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex items-end gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-slate-500">Produk</label>
                        <Select value={item.productId} onValueChange={(v) => handleUpdateItem(index, 'productId', v)}>
                          <SelectTrigger className="bg-white dark:bg-slate-950">
                            <SelectValue placeholder="Pilih Produk" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} (Stok: {p.stock_quantity || 0})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-32 space-y-1">
                        <label className="text-xs font-medium text-slate-500">Kuantitas (Qty)</label>
                        <Input 
                          type="number" 
                          min={1} 
                          className="bg-white dark:bg-slate-950"
                          value={item.quantity} 
                          onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)} 
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveItem(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit}>Simpan Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
