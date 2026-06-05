import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useLookupCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function CustomersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  
  const { data: customers, isLoading } = useListCustomers({ search: search.length > 2 ? search : undefined });
  const { data: lookupResult, refetch: refetchLookup } = useLookupCustomer(
    { phone: lookupPhone },
    { query: { enabled: false, retry: false } }
  );
  
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLookupDialogOpen, setIsLookupDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    membershipType: "non_member" as "member" | "non_member",
  });

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || "",
        email: customer.email || "",
        membershipType: customer.membershipType,
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "",
        phone: "",
        email: "",
        membershipType: "non_member",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      membershipType: formData.membershipType
    };

    if (editingCustomer) {
      updateCustomer.mutate({ id: editingCustomer.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Sukses", description: "Pelanggan diperbarui" });
          setIsDialogOpen(false);
        }
      });
    } else {
      createCustomer.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Sukses", description: "Pelanggan ditambahkan" });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if(confirm("Hapus pelanggan ini?")) {
      deleteCustomer.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Sukses", description: "Pelanggan dihapus" });
        }
      });
    }
  };

  const handleLookup = async () => {
    if (!lookupPhone) return;
    try {
      const { data } = await refetchLookup();
      if (!data) {
        toast({ title: "Info", description: "Pelanggan tidak ditemukan" });
      }
    } catch (e) {
      toast({ title: "Info", description: "Pelanggan tidak ditemukan" });
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Pelanggan</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsLookupDialogOpen(true)}>
              <Phone className="w-4 h-4 mr-2" /> Cari by HP
            </Button>
            <Button onClick={() => handleOpenDialog()} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Tambah Pelanggan
            </Button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input 
                  placeholder="Cari pelanggan..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead className="text-right">Total Belanja</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell></TableRow>
                ) : customers?.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{customer.phone || "-"}</div>
                        <div className="text-slate-500 text-xs">{customer.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.membershipType === "member" ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600">MEMBER</Badge>
                      ) : (
                        <Badge variant="secondary">REGULER</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-600">
                      {customer.points}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {formatRupiah(customer.totalSpent || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(customer)}>
                        <Edit className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama</label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nomor HP</label>
              <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipe Keanggotaan</label>
              <Select value={formData.membershipType} onValueChange={(v: any) => setFormData({...formData, membershipType: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="non_member">Reguler</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={createCustomer.isPending || updateCustomer.isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLookupDialogOpen} onOpenChange={setIsLookupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cari Pelanggan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Masukkan Nomor HP" 
                value={lookupPhone} 
                onChange={(e) => setLookupPhone(e.target.value)} 
              />
              <Button onClick={handleLookup}><Search className="w-4 h-4" /></Button>
            </div>
            
            {lookupResult && (
              <div className="mt-4 p-4 bg-slate-50 border rounded-lg space-y-2">
                <div className="font-bold text-lg">{lookupResult.name}</div>
                <div className="text-slate-600">{lookupResult.phone}</div>
                <div className="flex gap-4 mt-2">
                  <Badge variant={lookupResult.membershipType === "member" ? "default" : "secondary"}>
                    {lookupResult.membershipType === "member" ? "MEMBER" : "REGULER"}
                  </Badge>
                  <div className="font-bold text-amber-600">{lookupResult.points} Poin</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsLookupDialogOpen(false);
              setLookupPhone("");
            }}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
