import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Phone, Award, Users, Download, Store, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/auth";
import { exportToExcel } from "@/components/excel-export/excel-export";
import { useListOutlets } from "@/mocks/api-client-react";

export default function CustomersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const { data: customers, isLoading } = useListCustomers();
  const { data: outlets } = useListOutlets();
  const [outletFilter, setOutletFilter] = useState<string>(() => {
    return localStorage.getItem('selectedOutletId') || "all";
  });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLookupDialogOpen, setIsLookupDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: "", phone: "", membershipType: "member", outlet_id: "all" });
  const [isLookupPending, setIsLookupPending] = useState(false);

  // Check if user is admin (only sbagiamu.pos@gmail.com)
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const getMembershipStatus = (customer: any) => {
    const membershipType = customer.membership_type || customer.membershipType || customer.membership;
    if (membershipType === "member" || membershipType === "Member" || membershipType === "MEMBER") return "member";
    return "non_member";
  };

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ 
        name: customer.name, 
        phone: customer.phone || "", 
        membershipType: getMembershipStatus(customer),
        outlet_id: customer.outlet_id ? customer.outlet_id.toString() : "all"
      });
    } else {
      setEditingCustomer(null);
      const currentOutletIdStr = localStorage.getItem('selectedOutletId') || "all";
      setFormData({ 
        name: "", 
        phone: "", 
        membershipType: "member",
        outlet_id: (!isAdmin && user?.outletId) ? user.outletId : currentOutletIdStr
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload: any = { name: formData.name, phone: formData.phone || null, membership_type: formData.membershipType };

    if (isAdmin && formData.outlet_id && formData.outlet_id !== "all") {
      payload.outlet_id = parseInt(formData.outlet_id);
    } else {
      payload.outlet_id = null;
    }

    if (editingCustomer) {
      updateCustomer.mutate({ id: editingCustomer.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Sukses", description: "Pelanggan diperbarui" });
          setIsDialogOpen(false);
        },
        onError: () => toast({ title: "Error", description: "Gagal memperbarui pelanggan", variant: "destructive" })
      });
    } else {
      createCustomer.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Sukses", description: "Pelanggan ditambahkan" });
          setIsDialogOpen(false);
        },
        onError: () => toast({ title: "Error", description: "Gagal menambahkan pelanggan", variant: "destructive" })
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Hapus pelanggan ini?")) {
      deleteCustomer.mutate({ id }, {
        onSuccess: () => toast({ title: "Sukses", description: "Pelanggan dihapus" }),
        onError: () => toast({ title: "Error", description: "Gagal menghapus pelanggan", variant: "destructive" })
      });
    }
  };

  const handleLookup = () => {
    if (!lookupPhone) return;
    setIsLookupPending(true);
    const found = customers?.find((c: any) => c.phone === lookupPhone || c.phone_number === lookupPhone);
    setIsLookupPending(false);
    if (found) {
      setLookupResult(found);
      toast({ title: "Ditemukan", description: found.name });
    } else {
      setLookupResult(null);
      toast({ title: "Tidak ditemukan", description: "Pelanggan tidak ditemukan", variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    if (!customers || customers.length === 0) {
      toast({ title: "Kosong", description: "Tidak ada data pelanggan untuk di-download", variant: "destructive" });
      return;
    }

    const columns = [
      { header: "No", key: "No", width: 5 },
      { header: "Nama Pelanggan", key: "Nama Pelanggan", width: 30 },
      { header: "No. Telepon", key: "No. Telepon", width: 15 },
      { header: "Status", key: "Status", width: 12 },
      { header: "Poin", key: "Poin", width: 8 },
      { header: "Total Belanja", key: "Total Belanja", width: 20 },
      { header: "Bergabung Sejak", key: "Bergabung Sejak", width: 18 },
    ];

    const data = customers.map((c: any, index: number) => {
      const date = new Date(c.created_at);
      const formattedDate = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      
      return {
        "No": index + 1,
        "Nama Pelanggan": c.name || "-",
        "No. Telepon": c.phone || "-",
        "Status": getMembershipStatus(c) === "member" ? "MEMBER" : "REGULER",
        "Poin": c.points || 0,
        "Total Belanja": c.total_spent || 0,
        "Bergabung Sejak": formattedDate
      };
    });

    try {
      toast({ title: "Memproses", description: "Sedang menyiapkan file Excel..." });
      await exportToExcel({
        title: "Laporan Data Pelanggan",
        filename: `Data_Pelanggan_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: "Pelanggan",
        columns,
        data,
        rowStripes: []
      });
      toast({ title: "Berhasil", description: "File Excel berhasil didownload" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Gagal mendownload Excel", variant: "destructive" });
    }
  };

  const activeOutletId = isAdmin 
    ? (outletFilter && outletFilter !== "all" ? parseInt(outletFilter) : null)
    : null;

  const filteredCustomers = customers?.filter((customer: any) => {
    // Filter by outlet (Hide if customer belongs to a DIFFERENT specific outlet)
    if (activeOutletId !== null) {
      if (customer.outlet_id != null && customer.outlet_id !== activeOutletId) {
        return false;
      }
    }

    if (!search || search.length < 3) return true;
    const s = search.toLowerCase();
    return customer.name?.toLowerCase().includes(s) || (customer.phone || "").toLowerCase().includes(s);
  });

  if (!isAdmin && (!user?.outletId || user?.outletId === "all")) {
    return (
      <Sidebar>
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 h-full min-h-[calc(100vh-4rem)]">
          <div className="max-w-md w-full p-8 text-center flex flex-col items-center bg-white dark:bg-slate-800 shadow-lg border border-red-200 dark:border-red-900/50 rounded-2xl">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-200/50 dark:border-red-800/50">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-3">Akses Ditolak</h2>
            <p className="text-red-700 dark:text-red-300 mb-6 leading-relaxed">
              Akun Kasir Anda belum terhubung dengan Outlet (Cabang) manapun. Silakan hubungi Admin atau Pemilik untuk mengatur penugasan Outlet Anda agar dapat melihat data pelanggan.
            </p>
          </div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-primary animate-pulse" />
            Manajemen Pelanggan
          </h1>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={handleExportExcel} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" /> Download Excel
                </Button>
                <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Tambah
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <Input placeholder="Cari pelanggan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isAdmin && (
              <Select value={outletFilter} onValueChange={(val) => { setOutletFilter(val); localStorage.setItem('selectedOutletId', val); }}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Semua Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Outlet</SelectItem>
                  {outlets?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Mobile Card List */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Memuat...</div>
            ) : filteredCustomers?.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada data</div>
            ) : (
              filteredCustomers?.map((customer: any) => {
                const status = getMembershipStatus(customer);
                return (
                  <div 
                    key={customer.id} 
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/20 hover:shadow-md active:bg-primary/5 transition-all duration-200"
                    onClick={() => setSelectedCustomerDetail(customer)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 dark:text-white mb-1.5">{customer.name}</div>
                        <div className="flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {customer.phone || "-"}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            {outlets?.find((o: any) => o.id === customer.outlet_id)?.name || 
                             (!isAdmin && user?.outletId && user.outletId !== "all" 
                              ? (outlets?.find((o: any) => o.id === parseInt(user.outletId || "0"))?.name || "Semua Outlet")
                              : "Semua Outlet")}
                          </div>
                        </div>
                      </div>
                      {status === "member" ? (
                        <Badge className="bg-amber-500 dark:bg-amber-600 flex items-center gap-1 whitespace-nowrap">
                          <Award className="w-3 h-3" /> MEMBER
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          REGULER
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Poin</span>
                        <div className="font-bold text-amber-600 dark:text-amber-400">{(customer.points || 0).toLocaleString('id-ID')}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Belanja</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{formatRupiah(customer.total_spent || 0)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {isAdmin && (
                        <>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDialog(customer); }} className="flex-1">Edit</Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }} className="text-red-500 hover:text-red-600 dark:text-red-400">Hapus</Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Poin</TableHead>
                  <TableHead className="text-left">Outlet</TableHead>
                  <TableHead className="text-right">Total Belanja</TableHead>
                  {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-500 dark:text-slate-400">Memuat...</TableCell></TableRow>
                ) : filteredCustomers?.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-500 dark:text-slate-400">Tidak ada data</TableCell></TableRow>
                ) : (
                  filteredCustomers?.map((customer: any) => {
                    const status = getMembershipStatus(customer);
                    return (
                      <TableRow 
                        key={customer.id} 
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                        onClick={() => setSelectedCustomerDetail(customer)}
                      >
                        <TableCell className="font-medium text-slate-900 dark:text-white whitespace-nowrap">{customer.name}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{customer.phone || "-"}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {status === "member" ? (
                            <Badge className="bg-amber-500 dark:bg-amber-600">
                              <Award className="w-3 h-3 mr-1" /> MEMBER
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">REGULER</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">{(customer.points || 0).toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {outlets?.find((o: any) => o.id === customer.outlet_id)?.name || "Semua Outlet"}
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatRupiah(customer.total_spent || 0)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenDialog(customer); }} className="h-8 w-8 sm:h-9 sm:w-9"><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }} className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}</DialogTitle>
            <DialogDescription>{editingCustomer ? "Edit informasi pelanggan" : "Isi formulir untuk menambah pelanggan baru"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Lengkap</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama lengkap" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nomor HP</label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Digunakan untuk login di kasir</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipe Keanggotaan</label>
              <Select value={formData.membershipType} onValueChange={(v: any) => setFormData({ ...formData, membershipType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="non_member">Reguler (Non-Member)</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              {formData.membershipType === "member" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Award className="w-3 h-3" /> Member mendapatkan poin dari setiap pembelian
                </p>
              )}
            </div>
            
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Outlet (Cabang)</label>
                <Select value={formData.outlet_id} onValueChange={(v: string) => setFormData({ ...formData, outlet_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Outlet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Outlet (Global)</SelectItem>
                    {outlets?.map((outlet: any) => (
                      <SelectItem key={outlet.id} value={outlet.id.toString()}>{outlet.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pilih "Semua Outlet" jika pelanggan ini bisa diakses semua cabang</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || createCustomer.isPending || updateCustomer.isPending}>
              {createCustomer.isPending || updateCustomer.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lookup Dialog */}
      <Dialog open={isLookupDialogOpen} onOpenChange={setIsLookupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cari Pelanggan</DialogTitle>
            <DialogDescription>Masukkan nomor HP pelanggan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input placeholder="Nomor HP" value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLookup()} className="flex-1" />
              <Button onClick={handleLookup} disabled={isLookupPending}><Search className="w-4 h-4 mr-2" /> Cari</Button>
            </div>
            {lookupResult && (
              <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-slate-50 dark:from-amber-950/50 dark:to-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-lg text-slate-900 dark:text-white">{lookupResult.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{lookupResult.phone}</div>
                  </div>
                  {getMembershipStatus(lookupResult) === "member" ? (
                    <Badge className="bg-amber-500 dark:bg-amber-600"><Award className="w-3 h-3 mr-1" /> MEMBER</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">REGULER</Badge>
                  )}
                </div>
                <div className="flex gap-4 pt-2 border-t border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span className="font-bold text-amber-600 dark:text-amber-400">{(lookupResult.points || 0).toLocaleString('id-ID')} Poin</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">Total: {formatRupiah(lookupResult.total_spent || 0)}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsLookupDialogOpen(false); setLookupPhone(""); setLookupResult(null); }}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Customer Dialog */}
      <Dialog open={!!selectedCustomerDetail} onOpenChange={(open) => !open && setSelectedCustomerDetail(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Detail Pelanggan
            </DialogTitle>
            <DialogDescription className="sr-only">
              Informasi detail mengenai pelanggan ini
            </DialogDescription>
          </DialogHeader>

          {selectedCustomerDetail && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</p>
                  <p className="font-semibold text-slate-900 dark:text-white text-lg">{selectedCustomerDetail.name}</p>
                </div>
                
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Telepon</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{selectedCustomerDetail.phone || "-"}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tipe Member</p>
                    {getMembershipStatus(selectedCustomerDetail) === "member" ? (
                      <Badge className="bg-amber-500 dark:bg-amber-600 flex w-fit items-center gap-1">
                        <Award className="w-3 h-3" /> MEMBER
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        REGULER
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Poin</p>
                    <p className="font-bold text-amber-600 dark:text-amber-400 text-lg">
                      {(selectedCustomerDetail.points || 0).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Belanja</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatRupiah(selectedCustomerDetail.total_spent || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <Button onClick={() => setSelectedCustomerDetail(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}