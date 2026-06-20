import { useState, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Users, Store, Building2, UserCog, SquarePen } from "lucide-react";
import { isTenantSuperAdmin } from "@/lib/tenant";
import { useListOutlets, useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from "@/mocks/api-client-react";
import { supabase } from "@/lib/supabase";

interface Staff {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  outlet_id: number | null;
  outlets?: { name: string } | null;
  avatar_url?: string | null;
}

export default function StaffPage() {
  const { toast } = useToast();

  // Data hooks
  const { data: outlets, refetch: refetchOutlets } = useListOutlets();
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>("all");
  const { data: staffList, isLoading, refetch } = useListStaff({ outletId: selectedOutletFilter });
  const { mutate: createStaff, isPending: isCreating } = useCreateStaff();
  const { mutate: updateStaff, isPending: isUpdating } = useUpdateStaff();
  const { mutate: deleteStaff } = useDeleteStaff();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<Staff | null>(null);

  // Outlet states
  const [isOutletDialogOpen, setIsOutletDialogOpen] = useState(false);
  const [newOutletName, setNewOutletName] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newOutletAddress, setNewOutletAddress] = useState('');
  const [newOutletPhone, setNewOutletPhone] = useState('');
  const [newOutletFooter1, setNewOutletFooter1] = useState('');
  const [newOutletFooter2, setNewOutletFooter2] = useState('');
  const [newOutletFooter3, setNewOutletFooter3] = useState('');
  const [isCreatingOutlet, setIsCreatingOutlet] = useState(false);
  const [editingOutletId, setEditingOutletId] = useState<number | null>(null);

  const isAdmin = useMemo(() => isTenantSuperAdmin(), []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "kasir",
    status: "active",
    outlet_id: "all",
  });

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  const filteredStaff = staffList.filter((staff) => {
    const matchesSearch = search === "" ||
      staff.name.toLowerCase().includes(search.toLowerCase()) ||
      staff.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = selectedRoleFilter === "all" || staff.role.toLowerCase() === selectedRoleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    const rolePriority: Record<string, number> = {
      developer: 1,
      admin: 2,
      kasir: 3
    };

    const priorityA = rolePriority[a.role.toLowerCase()] || 99;
    const priorityB = rolePriority[b.role.toLowerCase()] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.name.localeCompare(b.name);
  });

  const handleOpenDialog = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        name: staff.name,
        email: staff.email,
        phone: staff.phone || "",
        role: staff.role,
        status: staff.status || "active",
        outlet_id: staff.outlet_id ? staff.outlet_id.toString() : "all",
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "kasir",
        status: "active",
        outlet_id: "all",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.role) {
      toast({ title: "Error", description: "Nama, email, dan peran wajib diisi", variant: "destructive" });
      return;
    }

    const payload = {
      ...formData,
      outlet_id: formData.outlet_id === "all" ? null : parseInt(formData.outlet_id),
    };

    if (editingStaff) {
      updateStaff(
        { id: editingStaff.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Sukses", description: "Data staff berhasil diperbarui" });
            setIsDialogOpen(false);
            refetch();
          },
          onError: () => {
            toast({ title: "Error", description: "Gagal memperbarui data staff", variant: "destructive" });
          }
        }
      );
    } else {
      createStaff(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Sukses", description: "Staff berhasil ditambahkan" });
            setIsDialogOpen(false);
            refetch();
          },
          onError: () => {
            toast({ title: "Error", description: "Gagal menambahkan staff", variant: "destructive" });
          }
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Hapus staff ini?")) return;

    deleteStaff(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Sukses", description: "Staff berhasil dihapus" });
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Gagal menghapus staff", variant: "destructive" });
        }
      }
    );
  };

  const handleSaveOutlet = async () => {
    if (!newOutletName.trim()) {
      toast({ title: "Error", description: "Nama outlet harus diisi", variant: "destructive" });
      return;
    }

    setIsCreatingOutlet(true);
    try {
      let error;
      if (editingOutletId) {
        const result = await supabase
          .from('outlets')
          .update({
            name: newOutletName.trim(),
            store_name: newStoreName.trim(),
            address: newOutletAddress.trim(),
            phone: newOutletPhone.trim(),
            footer_message: newOutletFooter1.trim() || null,
            footer_message2: newOutletFooter2.trim() || null,
            footer_message3: newOutletFooter3.trim() || null,
          })
          .eq('id', editingOutletId);
        error = result.error;
      } else {
        const result = await supabase
          .from('outlets')
          .insert([{
            name: newOutletName.trim(),
            store_name: newStoreName.trim(),
            address: newOutletAddress.trim(),
            phone: newOutletPhone.trim(),
            footer_message: newOutletFooter1.trim() || null,
            footer_message2: newOutletFooter2.trim() || null,
            footer_message3: newOutletFooter3.trim() || null,
            is_active: true
          }]);
        error = result.error;
      }

      if (error) {
        toast({ title: "Error", description: "Gagal menyimpan outlet", variant: "destructive" });
      } else {
        toast({ title: "Sukses", description: editingOutletId ? "Outlet diperbarui" : "Outlet ditambahkan" });
      }

      setNewOutletName('');
      setNewStoreName('');
      setNewOutletAddress('');
      setNewOutletPhone('');
      setEditingOutletId(null);
      refetchOutlets();
    } catch (error) {
      toast({ title: "Error", description: "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setIsCreatingOutlet(false);
    }
  };

  const handleEditOutlet = (outlet: any) => {
    setEditingOutletId(outlet.id);
    setNewOutletName(outlet.name);
    setNewStoreName(outlet.store_name || '');
    setNewOutletAddress(outlet.address || '');
    setNewOutletPhone(outlet.phone || '');
    setNewOutletFooter1(outlet.footer_message || '');
    setNewOutletFooter2(outlet.footer_message2 || '');
    setNewOutletFooter3(outlet.footer_message3 || '');
  };

  const handleDeleteOutlet = async (id: number) => {
    if (!confirm("Hapus outlet ini?")) return;

    try {
      const { error } = await supabase.from('outlets').delete().eq('id', id);
      if (error) {
        toast({ title: "Error", description: "Gagal menghapus outlet (mungkin masih ada data terkait)", variant: "destructive" });
      } else {
        toast({ title: "Sukses", description: "Outlet dihapus" });
        refetchOutlets();
      }
    } catch (error) {
      toast({ title: "Error", description: "Terjadi kesalahan", variant: "destructive" });
    }
  };

  const resetOutletForm = () => {
    setNewOutletName('');
    setNewStoreName('');
    setNewOutletAddress('');
    setNewOutletPhone('');
    setNewOutletFooter1('');
    setNewOutletFooter2('');
    setNewOutletFooter3('');
    setEditingOutletId(null);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "developer": return "Developer";
      case "supervisor": return "Supervisor";
      case "kasir": return "Sales";
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-purple-600 dark:bg-purple-700 text-white";
      case "developer": return "bg-[hsl(0,72%,51%)] text-white font-bold";
      case "supervisor": return "bg-blue-600 dark:bg-blue-700 text-white";
      case "kasir": return "bg-[hsl(188,72%,51%)] text-white font-bold";
      default: return "bg-slate-500 dark:bg-slate-600 text-white";
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <UserCog className="w-6 h-6 text-primary animate-pulse" />
                Manajemen Staff
              </h1>
            </div>
            {isAdmin && (
              <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto mt-3 sm:mt-0">

                <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Staff
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex-1 overflow-auto">
          {/* Filters */}
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 mb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Cari staff berdasarkan nama atau email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </div>


            </div>
          </div>

          {/* Table (Desktop) */}
          <div className="hidden md:block rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                Daftar Staff Terdaftar
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableHead className="w-16 text-center font-semibold">Foto</TableHead>
                  <TableHead className="font-semibold">Nama & Email</TableHead>
                  <TableHead className="font-semibold">Telepon</TableHead>
                  <TableHead className="font-semibold">Peran</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>

                  {isAdmin && <TableHead className="text-right w-28 font-semibold">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                        <p>Memuat data staff...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-300">Belum ada data staff</p>
                          <p className="text-sm text-slate-400 mt-1">Tambahkan staff untuk mengatur akses login</p>
                        </div>
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => handleOpenDialog()} className="mt-2">
                            <Plus className="w-4 h-4 mr-2" />
                            Tambah Staff
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((staff) => (
                    <TableRow
                      key={staff.id}
                      className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                      onClick={() => setSelectedStaffDetail(staff)}
                    >
                      <TableCell className="w-16">
                        <div className="flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {staff.avatar_url ? (
                              <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                {staff.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{staff.name}</p>
                          <p className="text-sm text-slate-500">{staff.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {staff.phone || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(staff.role)}>
                          {getRoleLabel(staff.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {staff.status === 'active' ? (
                          <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                        ) : (
                          <Badge variant="destructive">Nonaktif</Badge>
                        )}
                      </TableCell>

                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(staff);
                              }}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                            >
                              <SquarePen className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(staff.id);
                              }}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List (Smartphone) */}
          <div className="md:hidden space-y-3 mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm">Memuat data staff...</p>
                </div>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Belum ada data staff</p>
                </div>
              </div>
            ) : (
              filteredStaff.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 shadow-sm relative hover:shadow transition-all"
                  onClick={() => setSelectedStaffDetail(staff)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600 overflow-hidden">
                        {staff.avatar_url ? (
                          <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                            {staff.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{staff.name}</p>
                        <p className="text-xs text-slate-500 truncate">{staff.email}</p>
                      </div>
                    </div>
                    <Badge className={getRoleColor(staff.role)}>
                      {getRoleLabel(staff.role)}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase">Status</span>
                    <span className={staff.status === 'active' ? "text-green-600 dark:text-green-400 font-medium" : "text-red-500 font-medium"}>
                      {staff.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(staff);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2 border border-slate-200 dark:border-slate-700 min-h-8 rounded-md px-3 text-xs"
                      >
                        <SquarePen className="w-4 h-4 mr-1" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(staff.id);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2 border border-slate-200 dark:border-slate-700 min-h-8 rounded-md px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>



      {/* Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              {editingStaff ? "Edit Staff" : "Tambah Staff Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Nama Lengkap</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama lengkap"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email (Untuk Login)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Masukkan alamat email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Nomor Telepon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Masukkan nomor telepon"
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium">Peran</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger id="role" className="h-11">
                    <SelectValue placeholder="Pilih peran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kasir">Sales</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    {isAdmin && <SelectItem value="developer">Developer</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status" className="h-11">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11">
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              className="h-11 px-6"
              disabled={isCreating || isUpdating}
            >
              {isCreating || isUpdating ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                editingStaff ? "Simpan Perubahan" : "Tambahkan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Staff Dialog */}
      <Dialog open={!!selectedStaffDetail} onOpenChange={(open) => !open && setSelectedStaffDetail(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              Detail Staff
            </DialogTitle>
            <DialogDescription className="sr-only">
              Informasi detail mengenai staff ini
            </DialogDescription>
          </DialogHeader>

          {selectedStaffDetail && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</p>
                    <p className="font-semibold text-slate-900 dark:text-white text-lg truncate">{selectedStaffDetail.name}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    {selectedStaffDetail.avatar_url ? (
                      <img src={selectedStaffDetail.avatar_url} alt={selectedStaffDetail.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-slate-500 dark:text-slate-400">
                        {selectedStaffDetail.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Email</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={selectedStaffDetail.email}>{selectedStaffDetail.email}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 text-right w-full">Status</p>
                    {selectedStaffDetail.status === 'active' ? (
                      <Badge className="bg-green-500 dark:bg-green-600 text-[10px] h-5 px-2">Aktif</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] h-5 px-2">Nonaktif</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Telepon</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{selectedStaffDetail.phone || "-"}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 text-right w-full">Peran / Role</p>
                    <Badge className={getRoleColor(selectedStaffDetail.role) + " text-[10px] h-5 px-2"}>
                      {getRoleLabel(selectedStaffDetail.role)}
                    </Badge>
                  </div>
                </div>


              </div>
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <Button onClick={() => setSelectedStaffDetail(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
