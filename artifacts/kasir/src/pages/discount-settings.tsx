import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tag, Plus, Trash2, Edit, Building2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useListOutlets,
  useListStaff,
  useListDiscountSettings,
  useSaveDiscountSettings,
  useDeleteDiscountSettings,
  useListDiscountCategories,
  useSaveDiscountCategory,
  useDeleteDiscountCategory
} from "@/mocks/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function DiscountSettingsPage() {
  const { toast } = useToast();

  // Filter state
  const [filterOutlet, setFilterOutlet] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");

  // Fetch data
  const { data: outlets } = useListOutlets();
  const { data: filterStaffList } = useListStaff({ outletId: filterOutlet });
  const { data: allStaff, isLoading: isLoadingAllStaff } = useListStaff({ outletId: "all" });

  const { data: savedConfigsData, isLoading: isLoadingConfigs, refetch: refetchConfigs } = useListDiscountSettings();
  const { mutate: saveConfig, isPending: isSavingConfig } = useSaveDiscountSettings();
  const { mutate: deleteConfig, isPending: isDeletingConfig } = useDeleteDiscountSettings();

  const { data: globalDiscountNotesData, refetch: refetchNotes } = useListDiscountCategories();
  const { mutate: saveNote, isPending: isSavingNote } = useSaveDiscountCategory();
  const { mutate: deleteNote, isPending: isDeletingNote } = useDeleteDiscountCategory();

  // Filter Reset
  useEffect(() => {
    if (filterOutlet !== "all" && filterStaff !== "all" && filterStaffList && filterStaffList.length > 0) {
      const staffExistsInOutlet = filterStaffList.some((s: any) => s.email === filterStaff);
      if (!staffExistsInOutlet) {
        setFilterStaff("all");
      }
    }
  }, [filterOutlet, filterStaffList]);

  // Global Notes State
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newDiscountNote, setNewDiscountNote] = useState('');

  // Detail State
  const [detailConfig, setDetailConfig] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOutlet, setFormOutlet] = useState("all");
  const [formStaff, setFormStaff] = useState("all");
  const [enableDiscount, setEnableDiscount] = useState(true);
  const [defaultDiscountPrice, setDefaultDiscountPrice] = useState("0");
  const [enablePPN, setEnablePPN] = useState(false);
  const [ppnPercentage, setPpnPercentage] = useState("11");
  const [allowedPromos, setAllowedPromos] = useState<string[]>([]);

  const { data: formStaffList } = useListStaff({ outletId: formOutlet });

  useEffect(() => {
    if (formOutlet !== "all" && formStaff !== "all" && formStaffList && formStaffList.length > 0) {
      const staffExistsInOutlet = formStaffList.some((s: any) => s.email === formStaff);
      if (!staffExistsInOutlet) {
        setFormStaff("all");
      }
    }
  }, [formOutlet, formStaffList]);

  const savedConfigs = [...(savedConfigsData || [])];

  const filteredConfigs = savedConfigs.filter(config => {
    if (filterOutlet !== "all" && config.outletId !== filterOutlet) return false;
    if (filterStaff !== "all" && config.staffEmail !== filterStaff) return false;
    return true;
  });

  const handleDeleteConfig = (id: number) => {
    if (confirm("Hapus pengaturan diskon ini?")) {
      deleteConfig(id, {
        onSuccess: () => {
          toast({ title: "Sukses", description: "Pengaturan berhasil dihapus" });
          refetchConfigs();
        },
        onError: () => {
          toast({ title: "Error", description: "Gagal menghapus pengaturan", variant: "destructive" });
        }
      });
    }
  };

  const handleEditConfig = (config: any) => {
    setEditingId(config.id === 'default_global' ? 'default_global' : config.id.toString());
    setFormOutlet(config.outletId);
    setFormStaff(config.staffEmail);
    setEnableDiscount(config.enableDiscount);
    setDefaultDiscountPrice(config.defaultDiscountPrice?.toString() || "0");
    setEnablePPN(config.enablePPN);
    setPpnPercentage(config.ppnPercentage?.toString() || "11");
    setAllowedPromos(config.allowedPromos || []);
    setIsDialogOpen(true);
  };

  const handleAddConfig = () => {
    setEditingId(null);
    setFormOutlet(outlets && outlets.length > 0 ? outlets[0].id.toString() : "");
    setFormStaff("all");
    setEnableDiscount(true);
    setDefaultDiscountPrice("0");
    setEnablePPN(true);
    setPpnPercentage("11");
    setAllowedPromos([]);
    setIsDialogOpen(true);
  };

  const addGlobalDiscountNote = () => {
    if (newDiscountNote.trim()) {
      saveNote(newDiscountNote.trim(), {
        onSuccess: () => {
          setNewDiscountNote('');
          refetchNotes();
          toast({ title: "Sukses", description: "Kategori diskon berhasil ditambahkan" });
        },
        onError: () => {
          toast({ title: "Error", description: "Gagal menambahkan kategori diskon", variant: "destructive" });
        }
      });
    }
  };

  const removeGlobalDiscountNote = (id: number) => {
    deleteNote(id, {
      onSuccess: () => {
        refetchNotes();
      },
      onError: () => {
        toast({ title: "Error", description: "Gagal menghapus kategori diskon", variant: "destructive" });
      }
    });
  };

  const handleSave = () => {
    saveConfig({
      outletId: formOutlet,
      staffEmail: formStaff,
      enableDiscount,
      defaultDiscountPrice,
      enablePPN,
      ppnPercentage,
      allowedPromos
    }, {
      onSuccess: () => {
        toast({ title: "Sukses", description: "Pengaturan berhasil disimpan" });
        setIsDialogOpen(false);
        refetchConfigs();
      },
      onError: () => {
        toast({ title: "Error", description: "Gagal menyimpan pengaturan", variant: "destructive" });
      }
    });
  };

  const formatRupiah = (val: string | number) => {
    const num = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(num)) return val.toString();
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const formatNumberInput = (val: string) => {
    if (!val || val === '0') return '';
    const num = parseInt(val);
    if (isNaN(num)) return '';
    return num.toLocaleString('id-ID');
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Tag className="w-6 h-6 text-primary animate-pulse" />
            Pengaturan Diskon & Pajak
          </h1>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={() => setIsCategoryDialogOpen(true)} variant="outline" className="w-full sm:w-auto border-slate-300 dark:border-slate-700">
              <Tag className="w-4 h-4 mr-2" /> Kategori Diskon
            </Button>
            <Button onClick={handleAddConfig} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Tambah Pengaturan
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto scrollbar-hide">
          {/* Filters */}
          <div className="mb-4 flex flex-col sm:flex-row sm:justify-end gap-3">
            <div className="w-full sm:w-[200px]">
              <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                <SelectTrigger>
                  <Building2 className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <SelectValue placeholder="Semua Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Outlet</SelectItem>
                  {outlets?.map((outlet: any) => (
                    <SelectItem key={outlet.id} value={outlet.id.toString()}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[200px]">
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger>
                  <Users className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Semua Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Staff</SelectItem>
                  {filterStaffList?.map((staff: any) => (
                    <SelectItem key={staff.id} value={staff.email}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoadingConfigs || isLoadingAllStaff ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Memuat...</div>
            ) : (!filteredConfigs || filteredConfigs.length === 0) ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada pengaturan</div>
            ) : (
              filteredConfigs.map((config) => {
                const staffInfo = allStaff?.find((s: any) => s.email === config.staffEmail);
                const displayStaffName = config.staffEmail === "all" ? "Semua Staff" : (staffInfo?.name || config.staffEmail);
                const outletInfo = outlets?.find((o: any) => o.id.toString() === config.outletId);
                const displayOutletName = config.outletId === "all" ? "Semua Outlet" : (outletInfo?.name || `Outlet #${config.outletId}`);
                const isGlobal = config.outletId === 'all' && config.staffEmail === 'all';

                return (
                  <div 
                    key={config.id} 
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/20 hover:shadow-md active:bg-primary/5 transition-all duration-200"
                    onClick={() => { setDetailConfig(config); setIsDetailDialogOpen(true); }}
                  >
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                            {displayOutletName}
                          </h3>
                          <div className="mt-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              {displayStaffName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mt-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div>
                          <span className="text-slate-500 text-[11px] block mb-1">Status Diskon</span>
                          {config.enableDiscount ? (
                            <Badge className="bg-green-500 dark:bg-green-600 whitespace-nowrap text-xs">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">Nonaktif</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 text-[11px] block">Diskon Default</span>
                          <span className="font-semibold">{formatRupiah(config.defaultDiscountPrice)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block mb-1">Status PPN</span>
                          {config.enablePPN ? (
                            <Badge className="bg-blue-500 dark:bg-blue-600 whitespace-nowrap text-xs">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">Nonaktif</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 text-[11px] block">PPN</span>
                          <span className="font-semibold">{config.ppnPercentage}%</span>
                        </div>
                      </div>

                      {config.enableDiscount && (
                        <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2 pb-1">
                          <span className="text-slate-500 text-[11px] block mb-1">Total Promo</span>
                          <Badge className="bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-700 text-white whitespace-nowrap border-0">{config.allowedPromos?.length || 0} Promo</Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleEditConfig(config)}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteConfig(config.id)}
                        disabled={isGlobal || isDeletingConfig}
                        className="text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Hapus
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead>Outlet</TableHead>
                    <TableHead>Nama Staff</TableHead>
                    <TableHead className="text-center">Diskon</TableHead>
                    <TableHead className="text-center">Promo</TableHead>
                    <TableHead className="text-right">Diskon Default</TableHead>
                    <TableHead className="text-center">PPN</TableHead>
                    <TableHead className="text-right">Nilai PPN</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingConfigs || isLoadingAllStaff ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">Memuat...</TableCell></TableRow>
                  ) : (!filteredConfigs || filteredConfigs.length === 0) ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">Tidak ada pengaturan</TableCell></TableRow>
                  ) : (
                    filteredConfigs.map((config) => {
                      const staffInfo = allStaff?.find((s: any) => s.email === config.staffEmail);
                      const displayStaffName = config.staffEmail === "all" ? "Semua Staff" : (staffInfo?.name || config.staffEmail);
                      const outletInfo = outlets?.find((o: any) => o.id.toString() === config.outletId);
                      const displayOutletName = config.outletId === "all" ? "Semua Outlet" : (outletInfo?.name || `Outlet #${config.outletId}`);
                      const isGlobal = config.outletId === 'all' && config.staffEmail === 'all';

                      return (
                        <TableRow 
                          key={config.id} 
                          className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                          onClick={() => { setDetailConfig(config); setIsDetailDialogOpen(true); }}
                        >
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-white">{displayOutletName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-white">{displayStaffName}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {config.enableDiscount ? (
                              <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Nonaktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {config.enableDiscount ? (
                              <Badge className="bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-700 text-white whitespace-nowrap border-0">{config.allowedPromos?.length || 0} Promo</Badge>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatRupiah(config.defaultDiscountPrice)}</TableCell>
                          <TableCell className="text-center">
                            {config.enablePPN ? (
                              <Badge className="bg-blue-500 dark:bg-blue-600">Aktif</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Nonaktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{config.ppnPercentage}%</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEditConfig(config)} className="h-8 w-8 sm:h-9 sm:w-9">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteConfig(config.id)}
                                disabled={isGlobal || isDeletingConfig}
                                className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Pengaturan Diskon" : "Tambah Pengaturan Diskon"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Target Setup */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Outlet Target</label>
              <Select value={formOutlet} onValueChange={setFormOutlet} disabled={editingId === 'default_global'}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets?.map((outlet: any) => (
                    <SelectItem key={outlet.id} value={outlet.id.toString()}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kasir Target</label>
              <Select value={formStaff} onValueChange={setFormStaff} disabled={editingId === 'default_global'}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kasir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kasir</SelectItem>
                  {formStaffList?.map((staff: any) => (
                    <SelectItem key={staff.id} value={staff.email}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enable Discount */}
            <div className="flex items-center space-x-2 pt-2 pb-2">
              <Switch id="enableDiscount" checked={enableDiscount} onCheckedChange={setEnableDiscount} />
              <label htmlFor="enableDiscount" className="text-sm font-medium">Aktifkan Fitur Diskon</label>
            </div>

            {enableDiscount && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Diskon Default (Rupiah)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(defaultDiscountPrice)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setDefaultDiscountPrice(raw);
                    }}
                    onBlur={() => {
                      if (defaultDiscountPrice && defaultDiscountPrice !== '0') {
                        setDefaultDiscountPrice(defaultDiscountPrice.replace(/^0+/, '') || '0');
                      }
                    }}
                    className="text-left pl-3"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-sm font-medium">Kategori Promo yang Diizinkan</label>

                  <div className="grid gap-2 border rounded-md p-3 max-h-[150px] overflow-y-auto scrollbar-hide">
                    {globalDiscountNotesData?.map((cat) => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`promo-${cat.id}`}
                          checked={allowedPromos.includes(cat.note)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAllowedPromos([...allowedPromos, cat.note]);
                            } else {
                              setAllowedPromos(allowedPromos.filter(p => p !== cat.note));
                            }
                          }}
                        />
                        <label htmlFor={`promo-${cat.id}`} className="text-sm font-medium leading-none cursor-pointer">
                          {cat.note}
                        </label>
                      </div>
                    ))}
                    {(!globalDiscountNotesData || globalDiscountNotesData.length === 0) && (
                      <div className="text-sm text-slate-500">Belum ada kategori promo global.</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Enable Tax */}
            <div className="flex items-center space-x-2 pt-4 pb-2 border-t border-slate-100 dark:border-slate-800">
              <Switch id="enablePPN" checked={enablePPN} onCheckedChange={setEnablePPN} />
              <label htmlFor="enablePPN" className="text-sm font-medium">Aktifkan Pajak (PPN)</label>
            </div>

            {enablePPN && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Persentase PPN (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={ppnPercentage}
                  onChange={(e) => setPpnPercentage(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSavingConfig}>Batal</Button>
            <Button onClick={handleSave} disabled={isSavingConfig}>
              {isSavingConfig ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Kategori Keterangan Diskon</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">


            <div className="space-y-3">
              <Label className="text-sm font-semibold">Daftar Kategori</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tambah kategori baru..."
                  value={newDiscountNote}
                  onChange={(e) => setNewDiscountNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addGlobalDiscountNote();
                  }}
                  disabled={isSavingNote}
                />
                <Button onClick={addGlobalDiscountNote} variant="secondary" disabled={isSavingNote}>Tambah</Button>
              </div>

              <div className="flex flex-col gap-2 mt-4 max-h-[300px] overflow-y-auto scrollbar-hide pr-2">
                {!globalDiscountNotesData || globalDiscountNotesData.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4">Belum ada kategori diskon</p>
                ) : (
                  globalDiscountNotesData.map((noteObj: any) => (
                    <div key={noteObj.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2 px-3 rounded-md border border-slate-100 dark:border-slate-800">
                      <span className="text-sm font-medium">{noteObj.note}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => removeGlobalDiscountNote(noteObj.id)}
                        disabled={isDeletingNote}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsCategoryDialogOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-sm sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Detail Pengaturan Diskon</DialogTitle>
          </DialogHeader>
          {detailConfig && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Outlet Target</label>
                  <div className="font-medium text-sm">
                    {detailConfig.outletId === "all" ? "Semua Outlet" : (outlets?.find((o: any) => o.id.toString() === detailConfig.outletId)?.name || `Outlet #${detailConfig.outletId}`)}
                  </div>
                </div>
                <div className="text-right">
                  <label className="text-xs text-slate-500 block mb-1">Staff Target</label>
                  <div className="font-medium text-sm">
                    {detailConfig.staffEmail === "all" ? "Semua Staff" : (allStaff?.find((s: any) => s.email === detailConfig.staffEmail)?.name || detailConfig.staffEmail)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Status Diskon</label>
                  {detailConfig.enableDiscount ? (
                    <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                  )}
                </div>
                <div className="text-right">
                  <label className="text-xs text-slate-500 block mb-1">Diskon Default</label>
                  <div className="font-medium text-sm">{formatRupiah(detailConfig.defaultDiscountPrice)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Status PPN</label>
                  {detailConfig.enablePPN ? (
                    <Badge className="bg-blue-500 dark:bg-blue-600">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                  )}
                </div>
                <div className="text-right">
                  <label className="text-xs text-slate-500 block mb-1">Nilai PPN</label>
                  <div className="font-medium text-sm">{detailConfig.ppnPercentage}%</div>
                </div>
              </div>

              {detailConfig.enableDiscount && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <label className="text-xs text-slate-500 block mb-2">Promo yang Diizinkan</label>
                  {detailConfig.allowedPromos && detailConfig.allowedPromos.length > 0 ? (
                    <ul className="flex flex-col gap-2 mt-1">
                      {detailConfig.allowedPromos.map((promo: string, i: number) => (
                        <li key={i} className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mr-2.5 shrink-0" />
                          {promo}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Tidak ada promo</span>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
