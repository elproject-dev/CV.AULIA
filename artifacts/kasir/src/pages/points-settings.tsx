import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CircleDollarSign, Save, Building2, Users, Trash2, Edit, Plus, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useListOutlets, useListStaff, useListPointsSettings, useSavePointsSettings, useDeletePointsSettings } from "@/mocks/api-client-react";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/formatters";

export default function PointsSettingsPage() {
  const { toast } = useToast();

  // Filter state
  const [filterOutlet, setFilterOutlet] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");

  // Fetch outlets & staff list for filter
  const { data: outlets } = useListOutlets();
  const { data: filterStaffList } = useListStaff({ outletId: filterOutlet });
  const { data: allStaff, isLoading: isLoadingAllStaff } = useListStaff({ outletId: "all" });

  // Reset staff filter if selected outlet changes
  useEffect(() => {
    if (filterOutlet !== "all" && filterStaff !== "all" && filterStaffList && filterStaffList.length > 0) {
      const staffExistsInOutlet = filterStaffList.some((s: any) => s.email === filterStaff);
      if (!staffExistsInOutlet) {
        setFilterStaff("all");
      }
    }
  }, [filterOutlet, filterStaffList]);

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPointDetail, setSelectedPointDetail] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOutlet, setFormOutlet] = useState("all");
  const [formStaff, setFormStaff] = useState("all");
  const [enablePoints, setEnablePoints] = useState(true);
  const [pointsValue, setPointsValue] = useState("1000");
  const [pointsBaseType, setPointsBaseType] = useState("10000");
  const [pointsBaseCustom, setPointsBaseCustom] = useState("5000");
  const [pointsEarnRate, setPointsEarnRate] = useState("1");
  const [maxPointsPerTransaction, setMaxPointsPerTransaction] = useState("1000");

  const handleFormatChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    setter(rawValue);
  };

  const formatWithDots = (val: string) => {
    if (!val) return '';
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const { data: formStaffList } = useListStaff({ outletId: formOutlet });

  useEffect(() => {
    if (formOutlet !== "all" && formStaff !== "all" && formStaffList && formStaffList.length > 0) {
      const staffExistsInOutlet = formStaffList.some((s: any) => s.email === formStaff);
      if (!staffExistsInOutlet) {
        setFormStaff("all");
      }
    }
  }, [formOutlet, formStaffList]);

  // Supabase Hooks
  const { data: savedConfigsData, isLoading: isLoadingConfigs, refetch: refetchConfigs } = useListPointsSettings();
  const { mutate: saveSettings, isPending: isSaving } = useSavePointsSettings();
  const { mutate: deleteSettings, isPending: isDeleting } = useDeletePointsSettings();

  const filteredConfigs = savedConfigsData?.filter(config => {
    if (filterOutlet !== "all" && (config.outletId ? config.outletId.toString() : "all") !== filterOutlet) return false;
    if (filterStaff !== "all" && (config.staffEmail ? config.staffEmail : "all") !== filterStaff) return false;
    return true;
  });

  const handleDeleteConfig = (id: number) => {
    if (confirm("Hapus pengaturan poin ini?")) {
      deleteSettings(id, {
        onSuccess: () => {
          toast({
            title: "Sukses",
            description: "Pengaturan poin berhasil dihapus",
          });
          refetchConfigs();
          window.dispatchEvent(new Event('pointsSettingsChanged'));
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: "Gagal menghapus pengaturan poin",
            variant: "destructive"
          });
        }
      });
    }
  };

  const handleEditConfig = (config: any) => {
    setEditingId(config.id);
    setFormOutlet(config.outletId ? config.outletId.toString() : "all");
    setFormStaff(config.staffEmail ? config.staffEmail : "all");
    setEnablePoints(config.enablePoints);
    setPointsValue(config.pointsValue);
    setPointsBaseType(config.pointsBaseType);
    setPointsBaseCustom(config.pointsBaseCustom);
    setPointsEarnRate(config.pointsEarnRate);
    setMaxPointsPerTransaction(config.maxPointsPerTransaction);
    setIsDialogOpen(true);
  };

  const handleAddConfig = () => {
    setEditingId(null);
    setFormOutlet("all");
    setFormStaff("all");
    setEnablePoints(true);
    setPointsValue("1000");
    setPointsBaseType("10000");
    setPointsBaseCustom("5000");
    setPointsEarnRate("1");
    setMaxPointsPerTransaction("1000");
    setIsDialogOpen(true);
  };

  const formatRupiah = (val: string | number) => {
    const num = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(num)) return val.toString();
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const handleSave = () => {
    const payload = {
      outletId: formOutlet,
      staffEmail: formStaff,
      enablePoints,
      pointsValue,
      pointsBaseType,
      pointsBaseCustom,
      pointsEarnRate,
      maxPointsPerTransaction
    };

    saveSettings(payload, {
      onSuccess: () => {
        toast({
          title: "Sukses",
          description: `Pengaturan poin berhasil disimpan`,
        });

        // Dispatch global event for instant reactivity
        window.dispatchEvent(new Event('pointsSettingsChanged'));
        refetchConfigs();
        setIsDialogOpen(false);
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: "Gagal menyimpan pengaturan poin",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header - Consistent with products.tsx */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CircleDollarSign className="w-6 h-6 text-primary animate-pulse" />
            Pengaturan Poin
          </h1>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleAddConfig} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Tambah Pengaturan
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          {/* Filters - Inline style consistent with products.tsx */}
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
                const displayStaffName = staffInfo ? staffInfo.name : (config.staffName || "Semua Staff");

                return (
                  <div
                    key={config.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/20 hover:shadow-md active:bg-primary/5 transition-all duration-200"
                    onClick={() => setSelectedPointDetail(config)}
                  >
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                            {config.outletName || "Semua Outlet"}
                          </h3>
                          <div className="mt-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              {displayStaffName}
                            </p>
                          </div>
                        </div>
                        {config.enablePoints ? (
                          <Badge className="bg-green-500 dark:bg-green-600 whitespace-nowrap text-xs">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">Nonaktif</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mt-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Nilai Per Poin</span>
                          <span className="font-semibold">{formatRupiah(config.pointsValue)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 text-[11px] block">Kelipatan Transaksi</span>
                          <span className="font-semibold">{formatRupiah(config.pointsBaseType === 'custom' ? config.pointsBaseCustom : config.pointsBaseType)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Laju Poin</span>
                          <span className="font-semibold">{config.pointsEarnRate} Poin</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 text-[11px] block">Maks Poin/Trx</span>
                          <span className="font-semibold">{parseInt(config.maxPointsPerTransaction).toLocaleString('id-ID')}</span>
                        </div></div>
                    </div>

                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditConfig(config); }}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.id); }} disabled={isDeleting} className="text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
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
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Nilai Poin</TableHead>
                    <TableHead className="text-right">Kelipatan</TableHead>
                    <TableHead className="text-right">Laju Poin</TableHead>
                    <TableHead className="text-right">Maks Poin</TableHead>
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
                      const displayStaffName = staffInfo ? staffInfo.name : (config.staffName || "Semua Staff");
                      return (
                        <TableRow
                          key={config.id}
                          className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer"
                          onClick={() => setSelectedPointDetail(config)}
                        >
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-white">{config.outletName || "Semua Outlet"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-white">{displayStaffName}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {config.enablePoints ? (
                              <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Nonaktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatRupiah(config.pointsValue)}</TableCell>
                          <TableCell className="text-right font-medium">{formatRupiah(config.pointsBaseType === 'custom' ? config.pointsBaseCustom : config.pointsBaseType)}</TableCell>
                          <TableCell className="text-right font-medium">{config.pointsEarnRate} Poin</TableCell>
                          <TableCell className="text-right font-medium">{parseInt(config.maxPointsPerTransaction).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditConfig(config); }} className="h-8 w-8 sm:h-9 sm:w-9">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.id); }} disabled={isDeleting} className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50">
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
        <DialogContent className="sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Pengaturan Poin" : "Tambah Pengaturan Poin"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Target Setup */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Outlet Target</label>
              <Select value={formOutlet} onValueChange={setFormOutlet}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih outlet" />
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Kasir Target</label>
              <Select value={formStaff} onValueChange={setFormStaff}>
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

            {/* Enable Points */}
            <div className="flex items-center space-x-2 pt-2 pb-2">
              <Switch id="enablePoints" checked={enablePoints} onCheckedChange={setEnablePoints} />
              <label htmlFor="enablePoints" className="text-sm font-medium">Aktifkan Sistem Poin</label>
            </div>

            {enablePoints && (
              <>
                {/* Nilai Poin */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nilai Per Poin (Rupiah)</label>
                  <Input
                    type="text"
                    value={formatWithDots(pointsValue)}
                    onChange={handleFormatChange(setPointsValue)}
                    placeholder="1000"
                  />
                </div>

                {/* Kelipatan Transaksi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kelipatan Transaksi</label>
                  <Select value={pointsBaseType} onValueChange={setPointsBaseType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5000">Rp 5.000</SelectItem>
                      <SelectItem value="10000">Rp 10.000</SelectItem>
                      <SelectItem value="25000">Rp 25.000</SelectItem>
                      <SelectItem value="custom">Custom (Nominal Sendiri)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {pointsBaseType === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nominal Custom</label>
                    <Input
                      type="text"
                      value={formatWithDots(pointsBaseCustom)}
                      onChange={handleFormatChange(setPointsBaseCustom)}
                      placeholder="5000"
                    />
                  </div>
                )}

                {/* Jumlah Poin Diperoleh */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jumlah Poin Diperoleh</label>
                  <Input
                    type="text"
                    value={formatWithDots(pointsEarnRate)}
                    onChange={handleFormatChange(setPointsEarnRate)}
                  />
                </div>

                {/* Maks Poin per Transaksi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Maks. Poin per Transaksi</label>
                  <Input
                    type="text"
                    value={formatWithDots(maxPointsPerTransaction)}
                    onChange={handleFormatChange(setMaxPointsPerTransaction)}
                    placeholder="1000"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Poin Dialog */}
      <Dialog open={!!selectedPointDetail} onOpenChange={(open) => !open && setSelectedPointDetail(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-primary" />
              Detail Pengaturan Poin
            </DialogTitle>
          </DialogHeader>

          {selectedPointDetail && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Outlet</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{selectedPointDetail.outletName || "Semua Outlet"}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 text-right w-full">Status</p>
                    {selectedPointDetail.enablePoints ? (
                      <Badge className="bg-green-500 dark:bg-green-600 text-[10px] h-5 px-2">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] h-5 px-2">Nonaktif</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Staff</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {allStaff?.find((s: any) => s.email === selectedPointDetail.staffEmail)?.name || selectedPointDetail.staffName || "Semua Staff"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Nilai Per Poin</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatRupiah(selectedPointDetail.pointsValue)}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 text-right w-full">Laju Poin</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedPointDetail.pointsEarnRate} Poin</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Kelipatan Transaksi</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatRupiah(selectedPointDetail.pointsBaseType === 'custom' ? selectedPointDetail.pointsBaseCustom : selectedPointDetail.pointsBaseType)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 text-right w-full">Maks Poin/Trx</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {parseInt(selectedPointDetail.maxPointsPerTransaction).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <Button onClick={() => setSelectedPointDetail(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
