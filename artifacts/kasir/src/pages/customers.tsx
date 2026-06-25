import { useState, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Phone, Award, Users, Download, Store, AlertTriangle, Copy, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useAuthUserName } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/auth";
import { exportToExcel } from "@/components/excel-export/excel-export";
import { useListOutlets } from "@/mocks/api-client-react";

export default function CustomersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [salesFilter, setSalesFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
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
  const salesName = useAuthUserName();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLookupDialogOpen, setIsLookupDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: "", phone: "", outlet_id: "all", address: "", district: "", city: "" });
  const [isLookupPending, setIsLookupPending] = useState(false);

  // Check if user is admin (only cvauliausaha@gmail.com)
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();



  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || "",
        outlet_id: customer.outlet_id ? customer.outlet_id.toString() : "all",
        address: customer.address || "",
        district: customer.district || "",
        city: customer.city || ""
      });
    } else {
      setEditingCustomer(null);
      const currentOutletIdStr = localStorage.getItem('selectedOutletId') || "all";
      setFormData({
        name: "",
        phone: "",
        outlet_id: (!isAdmin && user?.outletId) ? user.outletId : currentOutletIdStr,
        address: "",
        district: "",
        city: ""
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload: any = {
      name: formData.name,
      phone: formData.phone || null,
      address: formData.address || null,
      district: formData.district || null,
      city: formData.city || null
    };

    if (isAdmin && formData.outlet_id && formData.outlet_id !== "all") {
      payload.outlet_id = parseInt(formData.outlet_id);
    } else {
      payload.outlet_id = null;
    }

    if (!editingCustomer) {
      payload.sales_name = salesName;
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
      { header: "ID Pelanggan", key: "ID Pelanggan", width: 20 },
      { header: "Nama Pelanggan", key: "Nama Pelanggan", width: 30 },
      { header: "No. Telepon", key: "No. Telepon", width: 15 },
      { header: "Alamat", key: "Alamat", width: 40 },
      { header: "Kecamatan", key: "Kecamatan", width: 20 },
      { header: "Kabupaten", key: "Kabupaten", width: 20 },
      { header: "Total Belanja", key: "Total Belanja", width: 20 },
      { header: "Bergabung Sejak", key: "Bergabung Sejak", width: 18 },
    ];

    const data = customers.map((c: any, index: number) => {
      const date = new Date(c.created_at);
      const formattedDate = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

      return {
        "No": index + 1,
        "ID Pelanggan": c.customer_id_manual || "-",
        "Nama Pelanggan": c.name || "-",
        "No. Telepon": c.phone || "-",
        "Alamat": c.address || "-",
        "Kecamatan": c.district || "-",
        "Kabupaten": c.city || "-",
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

  const activeOutletId = null;

  const uniqueSalesNames = useMemo(() => {
    if (!customers) return [];
    const names = customers.map(c => c.sales_name).filter(Boolean);
    return Array.from(new Set(names));
  }, [customers]);

  const filteredCustomers = customers?.filter((customer: any) => {
    if (salesFilter !== "all" && customer.sales_name !== salesFilter) {
      return false;
    }
    // Filter by outlet (Hide if customer belongs to a DIFFERENT specific outlet)
    if (activeOutletId !== null) {
      if (customer.outlet_id != null && customer.outlet_id !== activeOutletId) {
        return false;
      }
    }

    if (!search || search.length < 3) return true;
    const s = search.toLowerCase();
    return customer.name?.toLowerCase().includes(s) || (customer.phone || "").toLowerCase().includes(s);
  }).sort((a: any, b: any) => {
    if (sortBy === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (sortBy === "id_asc") {
      const idA = a.customer_id_manual || "";
      const idB = b.customer_id_manual || "";
      return idA.localeCompare(idB);
    }
    if (sortBy === "id_desc") {
      const idA = a.customer_id_manual || "";
      const idB = b.customer_id_manual || "";
      return idB.localeCompare(idA);
    }
    return 0;
  });

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
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-[160px]">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Terbaru</SelectItem>
                    <SelectItem value="oldest">Terlama</SelectItem>
                    <SelectItem value="id_asc">ID (A-Z)</SelectItem>
                    <SelectItem value="id_desc">ID (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[160px]">
                <Select value={salesFilter} onValueChange={setSalesFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Semua Sales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Sales</SelectItem>
                    {uniqueSalesNames.map((name: any) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Memuat...</div>
            ) : filteredCustomers?.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada data</div>
            ) : (
              filteredCustomers?.map((customer: any) => (
                  <div key={customer.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm relative hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCustomerDetail(customer)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 dark:text-white mb-1.5">{customer.name}</div>
                        <div className="flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-primary" />
                            {customer.phone || "-"}
                          </div>
                          {(customer.address || customer.district || customer.city) && (
                            <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                              <div className="flex flex-col">
                                <span>{customer.address || "-"}</span>
                                {(customer.district || customer.city) && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                                    {customer.district ? `Kec. ${customer.district}` : ""}
                                    {customer.district && customer.city ? ", " : ""}
                                    {customer.city ? `Kab. ${customer.city}` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-left">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Pelanggan dari</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{customer.sales_name || "-"}</div>
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
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
             <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="w-[140px]">ID Pelanggan</TableHead>
                  <TableHead>Nama Pelanggan</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Pelanggan dari</TableHead>
                  <TableHead className="text-right">Total Belanja</TableHead>
                  {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-500 dark:text-slate-400">Memuat...</TableCell></TableRow>
                ) : filteredCustomers?.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-500 dark:text-slate-400">Tidak ada data</TableCell></TableRow>
                ) : (
                  filteredCustomers?.map((customer: any) => {
                    return (
                      <TableRow
                        key={customer.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                        onClick={() => setSelectedCustomerDetail(customer)}
                      >
                        <TableCell className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{customer.customer_id_manual || "-"}</TableCell>
                        <TableCell className="font-medium text-slate-900 dark:text-white whitespace-nowrap">{customer.name}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{customer.phone || "-"}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {customer.sales_name || "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary whitespace-nowrap">{formatRupiah(customer.total_spent || 0)}</TableCell>
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
              <label className="text-sm font-medium">Alamat Lengkap</label>
              <Input value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Jl. Raya No. 123" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kecamatan</label>
                <Input value={formData.district || ""} onChange={(e) => setFormData({ ...formData, district: e.target.value })} placeholder="Kecamatan" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Kabupaten</label>
                <Input value={formData.city || ""} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Kabupaten" />
              </div>
            </div>

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
                </div>
                <div className="flex gap-4 pt-2 border-t border-amber-200 dark:border-amber-800">
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
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">ID Pelanggan</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-slate-900 dark:text-white text-lg">{selectedCustomerDetail.customer_id_manual || "-"}</p>
                    {selectedCustomerDetail.customer_id_manual && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedCustomerDetail.customer_id_manual);
                          toast({ title: "Tersalin", description: "ID Pelanggan berhasil disalin ke clipboard" });
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</p>
                  <p className="font-semibold text-slate-900 dark:text-white text-lg">{selectedCustomerDetail.name}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Telepon</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{selectedCustomerDetail.phone || "-"}</p>
                </div>



                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Belanja</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatRupiah(selectedCustomerDetail.total_spent || 0)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Bergabung Sejak</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedCustomerDetail.created_at
                        ? new Date(selectedCustomerDetail.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        : "-"}
                    </p>
                  </div>
                </div>

                {(selectedCustomerDetail.address || selectedCustomerDetail.district || selectedCustomerDetail.city) && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Alamat</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedCustomerDetail.address ? `${selectedCustomerDetail.address}` : "-"}
                    </p>
                    {(selectedCustomerDetail.district || selectedCustomerDetail.city) && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedCustomerDetail.district ? `Kec. ${selectedCustomerDetail.district}` : ""}
                        {selectedCustomerDetail.district && selectedCustomerDetail.city ? ", " : ""}
                        {selectedCustomerDetail.city ? `Kab. ${selectedCustomerDetail.city}` : ""}
                      </p>
                    )}
                  </div>
                )}
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