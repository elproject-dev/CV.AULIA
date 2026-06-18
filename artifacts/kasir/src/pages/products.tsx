import { useState, useRef, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, getListProductsQueryKey, getListCategoriesQueryKey, useListOutlets } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { uploadProductImage, deleteProductImage, deleteProductImageByName, getProductImageUrl } from "@/lib/supabase-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Package, FolderPlus, Upload, X, Image as ImageIcon, Store, Tag, AlertTriangle, Filter, ArrowUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const formatNumberWithDots = (value: string): string => {
  const cleanValue = value.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (!cleanValue) return '';
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseNumberFromDots = (value: string): number => {
  return parseInt(value.replace(/\./g, '')) || 0;
};

export default function ProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user is admin (only sbagiamu.pos@gmail.com)
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [search, setSearch] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState<string>(() => {
    // Admin with assigned outlet should filter to their outlet, not see all
    if (isAdmin && user?.outletId && user.outletId !== "all") {
      return user.outletId;
    }
    return isAdmin ? "all" : (user?.outletId || "all");
  });

  // Force outlet to always match user assignment
  useEffect(() => {
    if (!isAdmin) {
      setSelectedOutlet(user?.outletId || "all");
    } else if (user?.outletId && user.outletId !== "all") {
      // Admin with assigned outlet should use their outlet, not "all"
      setSelectedOutlet(user.outletId);
    }
  }, [isAdmin, user?.outletId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: outlets } = useListOutlets();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  const { data: products, isLoading } = useListProducts({
    search: search.length > 2 ? search : undefined,
    outletId: selectedOutlet,
    categoryId: selectedCategory === "all" ? undefined : selectedCategory
  });

  const sortedProducts = useMemo(() => {
    if (!products) return [];
    const sorted = [...products];
    
    if (sortOrder === "nameAsc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === "nameDesc") {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      sorted.sort((a, b) => b.id - a.id);
    }
    
    return sorted;
  }, [products, sortOrder]);

  const { data: categories } = useListCategories({ outletId: selectedOutlet });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOutlets, setNewCategoryOutlets] = useState<string[]>(["all"]);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [showCategoryOutlets, setShowCategoryOutlets] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    categoryId: "none",
    allowedOutlets: ["all"] as string[],
    imageUrl: "",
    isActive: true
  });

  // Handle price input with auto-formatting dots
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formattedValue = formatNumberWithDots(rawValue);
    setFormData(prev => ({ ...prev, price: formattedValue }));
    setHasChanges(true);
  };

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      const storedImageUrl = product.image_url || "";
      const storedAllowedOutlets = product.allowed_outlets || (product.outlet_id ? [product.outlet_id.toString()] : ["all"]);
      const initialData = {
        name: product.name,
        price: formatNumberWithDots(product.price?.toString() || ""),
        categoryId: product.categoryId?.toString() || product.category_id?.toString() || "none",
        allowedOutlets: storedAllowedOutlets,
        imageUrl: storedImageUrl,
        isActive: product.isActive
      };
      setFormData(initialData);
      setOriginalData(initialData);
      setHasChanges(false);
      if (storedImageUrl) {
        setImagePreview(getProductImageUrl(storedImageUrl));
      } else {
        setImagePreview("");
      }
      setImageFile(null);
    } else {
      setEditingProduct(null);
      setFormData({ name: "", price: "", categoryId: "none", allowedOutlets: ["all"], imageUrl: "", isActive: true });
      setOriginalData(null);
      setHasChanges(false);
      setImagePreview("");
      setImageFile(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setImagePreview("");
    setImageFile(null);
    setIsUploading(false);
    setFormData({ name: "", price: "", categoryId: "none", allowedOutlets: ["all"], imageUrl: "", isActive: true });
    setOriginalData(null);
    setHasChanges(false);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      const isValidImage = file.type.startsWith("image/") || allowedExts.includes(ext);

      if (!isValidImage) {
        toast({ title: "Error", description: "Hanya file JPG, PNG, atau WebP yang diizinkan", variant: "destructive" });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "Ukuran file maksimal 5MB", variant: "destructive" });
        return;
      }

      setImageFile(file);
      setHasChanges(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      toast({ title: "Foto dipilih", description: file.name, duration: 2000 });
    }
  };

  const handleRemoveImage = () => {
    if (formData.imageUrl) {
      deleteProductImage(formData.imageUrl);
    }
    setImageFile(null);
    setImagePreview("");
    setFormData(prev => ({ ...prev, imageUrl: "" }));
    setHasChanges(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Nama produk harus diisi", variant: "destructive" });
      return;
    }

    const priceValue = parseNumberFromDots(formData.price);
    if (!formData.price || priceValue <= 0) {
      toast({ title: "Error", description: "Harga harus diisi dengan angka valid", variant: "destructive" });
      return;
    }

    const isUpdate = !!editingProduct;
    const hasDataChanges = hasChanges;
    const hasNewImage = !!imageFile;

    if (isUpdate && !hasDataChanges && !hasNewImage) {
      toast({ title: "Info", description: "Tidak ada perubahan untuk disimpan" });
      return;
    }

    setIsUploading(true);

    try {
      // --- Duplicate Product Check Removed ---
      let finalImageUrl = formData.imageUrl;

      if (imageFile) {
        const productName = formData.name.trim();
        const uploadResult = await uploadProductImage(imageFile, productName);

        if (!uploadResult.success) {
          toast({ title: "Error", description: uploadResult.error || "Gagal upload gambar", variant: "destructive" });
          setIsUploading(false);
          return;
        }

        finalImageUrl = uploadResult.filePath || "";
      }

      const payload = {
        name: formData.name,
        price: priceValue,
        categoryId: formData.categoryId === "none" ? null : parseInt(formData.categoryId),
        allowedOutlets: formData.allowedOutlets,
        imageUrl: finalImageUrl,
        isActive: formData.isActive
      };

      if (isUpdate) {
        updateProduct.mutate({ id: editingProduct.id, data: payload }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Sukses", description: "Produk diperbarui" });
            handleCloseDialog();
          },
          onError: (error: any) => {
            toast({ title: "Error", description: error?.message || "Gagal memperbarui produk", variant: "destructive" });
            setIsUploading(false);
          }
        });
      } else {
        createProduct.mutate({ data: payload }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Sukses", description: "Produk ditambahkan" });
            handleCloseDialog();
          },
          onError: (error: any) => {
            toast({ title: "Error", description: error?.message || "Gagal menambahkan produk", variant: "destructive" });
            setIsUploading(false);
          }
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Terjadi kesalahan", variant: "destructive" });
      setIsUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Hapus produk ini?")) {
      const product = products?.find((p: any) => p.id === id);
      const imageUrl = product?.image_url;
      const productName = product?.name;

      deleteProduct.mutate({ id }, {
        onSuccess: async () => {
          if (imageUrl) {
            await deleteProductImage(imageUrl);
          }
          if (productName) {
            await deleteProductImageByName(productName);
          }
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Sukses", description: "Produk dihapus" });
        },
        onError: () => {
          toast({ title: "Error", description: "Gagal menghapus produk", variant: "destructive" });
        }
      });
    }
  };

  const resetCategoryForm = () => {
    setNewCategoryName("");
    setNewCategoryOutlets(["all"]);
    setEditingCategoryId(null);
    setShowCategoryOutlets(false);
  };

  const handleSaveCategory = () => {
    if (!newCategoryName.trim()) return;

    if (isAdmin && !editingCategoryId && !showCategoryOutlets) {
      setShowCategoryOutlets(true);
      return;
    }

    if (editingCategoryId) {
      updateCategory.mutate({
        id: editingCategoryId,
        data: {
          name: newCategoryName,
          allowedOutlets: isAdmin ? newCategoryOutlets : ["all"]
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Sukses", description: "Kategori diperbarui" });
          resetCategoryForm();
        }
      });
    } else {
      createCategory.mutate({
        data: {
          name: newCategoryName,
          allowedOutlets: isAdmin ? newCategoryOutlets : ["all"]
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Sukses", description: "Kategori ditambahkan" });
          resetCategoryForm();
        }
      });
    }
  };

  const handleEditCategory = (cat: any) => {
    setEditingCategoryId(cat.id);
    setNewCategoryName(cat.name);
    setNewCategoryOutlets(cat.allowed_outlets || ["all"]);
  };

  const handleDeleteCategory = (id: number) => {
    if (confirm("Hapus kategori ini?")) {
      deleteCategory.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Sukses", description: "Kategori dihapus" });
        }
      });
    }
  };

  const getCategoryName = (product: any) => {
    return product.category?.name || product.categoryName || "Tanpa Kategori";
  };

  const getProductImage = (product: any): string | null => {
    const imageUrl = product.image_url;
    if (!imageUrl) return null;
    return getProductImageUrl(imageUrl);
  };

  const getOutletName = (product: any): string => {
    const allowedOutlets = product.allowed_outlets;

    if (!allowedOutlets || allowedOutlets.includes("all")) {
      return "Semua Outlet";
    }

    const outletNames = allowedOutlets.map((idStr: string) => {
      const outlet = outlets?.find((o: any) => o.id.toString() === idStr);
      return outlet?.name || "Outlet #" + idStr;
    });

    return outletNames.join(", ");
  };

  const getOutletNamesArray = (product: any): string[] => {
    const allowedOutlets = product.allowed_outlets;

    if (!allowedOutlets || allowedOutlets.includes("all")) {
      return ["Semua Outlet"];
    }

    return allowedOutlets.map((idStr: string) => {
      const outlet = outlets?.find((o: any) => o.id.toString() === idStr);
      return outlet?.name || "Outlet #" + idStr;
    });
  };

  const getOutletCountText = (product: any): string => {
    const allowedOutlets = product.allowed_outlets;

    if (!allowedOutlets || allowedOutlets.includes("all")) {
      return "Semua Outlet";
    }

    return `${allowedOutlets.length} Outlet`;
  };

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
              Akun Kasir Anda belum terhubung dengan Outlet (Cabang) manapun. Silakan hubungi Admin atau Pemilik untuk mengatur penugasan Outlet Anda agar dapat melihat data produk.
            </p>
          </div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="w-6 h-6 text-primary animate-pulse" />
            Manajemen Produk
          </h1>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} className="w-full sm:w-auto">
                  <FolderPlus className="w-4 h-4 mr-2" /> Kategori
                </Button>
                <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Produk
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          {/* Filters */}
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter & Urutkan</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <ArrowUpDown className="w-3 h-3" /> Urutkan Berdasarkan
                    </label>
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Urutkan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Terbaru</SelectItem>
                        <SelectItem value="nameAsc">Nama (A-Z)</SelectItem>
                        <SelectItem value="nameDesc">Nama (Z-A)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Tag className="w-3 h-3" /> Kategori
                    </label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Semua Kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories?.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdmin && (!user?.outletId || user.outletId === "all") && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Store className="w-3 h-3" /> Outlet
                      </label>
                      <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                        <SelectTrigger>
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
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Mobile Card List */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Memuat...</div>
            ) : sortedProducts?.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada data</div>
            ) : (
              sortedProducts?.map((product: any) => {
                const categoryName = getCategoryName(product);
                const productImage = getProductImage(product);

                return (
                  <div key={product.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/20 hover:shadow-md active:bg-primary/5 transition-all duration-200" onClick={() => { setDetailProduct(product); setIsDetailDialogOpen(true); }}>
                    <div className="flex gap-3 p-3">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                          {productImage ? (
                            <img src={productImage} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2">{product.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{categoryName}</p>
                            {isAdmin && (
                              <div className="mt-1.5">
                                <Badge className="bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap text-xs">
                                  {getOutletCountText(product)}
                                </Badge>
                              </div>
                            )}
                          </div>
                          {product.isActive ? (
                            <Badge className="bg-green-500 dark:bg-green-600 whitespace-nowrap text-xs">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">Nonaktif</Badge>
                          )}
                        </div>
                        <div className="font-bold text-primary text-sm mt-auto">{formatRupiah(product.price)}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 px-3" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(product)}>
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="w-4 h-4 mr-1" /> Hapus
                          </Button>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="w-16 text-center">Foto</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Harga</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kategori</TableHead>
                    {isAdmin && <TableHead className="text-right whitespace-nowrap">Outlet</TableHead>}
                    <TableHead className="text-center whitespace-nowrap">Status</TableHead>
                    {isAdmin && <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-slate-500 dark:text-slate-400">Memuat...</TableCell></TableRow>
                  ) : sortedProducts?.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-slate-500 dark:text-slate-400">Tidak ada data</TableCell></TableRow>
                  ) : (
                    sortedProducts?.map((product: any) => {
                      const categoryName = getCategoryName(product);
                      const productImage = getProductImage(product);

                      return (
                        <TableRow key={product.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer" onClick={() => { setDetailProduct(product); setIsDetailDialogOpen(true); }}>
                          <TableCell className="text-center">
                            <div className="w-14 h-14 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 mx-auto">
                              {productImage ? (
                                <img src={productImage} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <Package className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 dark:text-white">{product.name}</TableCell>
                          <TableCell className="text-right font-bold text-primary whitespace-nowrap">{formatRupiah(product.price)}</TableCell>
                          <TableCell className="text-center whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{categoryName}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right whitespace-nowrap">
                              <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
                                {getOutletCountText(product)}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-center whitespace-nowrap">
                            {product.isActive ? (
                              <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Nonaktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {isAdmin && (
                              <div className="flex items-center justify-end gap-1 sm:gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)} className="h-8 w-8 sm:h-9 sm:w-9">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 dark:hover:text-red-400">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
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

      {/* Add/Edit Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Foto Produk</label>
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={handleRemoveImage} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 dark:text-slate-500">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-xs">Belum ada foto</span>
                    </div>
                  )}
                </div>

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleImageSelect} className="hidden" id="image-upload" />
                <label htmlFor="image-upload" className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  {imageFile || formData.imageUrl ? "Ganti Foto" : "Pilih Foto"}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Format: JPG, PNG, WebP. Maks: 5MB</p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Produk</label>
              <Input placeholder="Masukkan nama produk" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Harga</label>
              <Input placeholder="Masukkan harga" value={formData.price} onChange={handlePriceChange} />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori</label>
              <Select value={formData.categoryId} onValueChange={(value) => handleFormChange('categoryId', value)}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Kategori</SelectItem>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Outlet */}
            {isAdmin && (
              <div className="space-y-3 border border-slate-200 dark:border-slate-800 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <label className="text-sm font-medium">Outlet yang Diizinkan</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-hide">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="outlet-all"
                      checked={formData.allowedOutlets.includes("all")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleFormChange('allowedOutlets', ["all"]);
                        } else {
                          handleFormChange('allowedOutlets', []);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="outlet-all" className="text-sm font-medium cursor-pointer">Semua Outlet (Umum)</label>
                  </div>
                  {outlets?.map((outlet: any) => (
                    <div key={outlet.id} className="flex items-center space-x-2 pl-6">
                      <input
                        type="checkbox"
                        id={`outlet-${outlet.id}`}
                        checked={formData.allowedOutlets.includes(outlet.id.toString()) && !formData.allowedOutlets.includes("all")}
                        disabled={formData.allowedOutlets.includes("all")}
                        onChange={(e) => {
                          let newOutlets = [...formData.allowedOutlets.filter(id => id !== "all")];
                          if (e.target.checked) {
                            newOutlets.push(outlet.id.toString());
                          } else {
                            newOutlets = newOutlets.filter(id => id !== outlet.id.toString());
                          }
                          handleFormChange('allowedOutlets', newOutlets);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
                      />
                      <label htmlFor={`outlet-${outlet.id}`} className={`text-sm font-medium cursor-pointer ${formData.allowedOutlets.includes("all") ? "text-slate-400" : ""}`}>
                        {outlet.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active */}
            <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Produk Aktif</label>
              <Switch id="isActive" checked={formData.isActive} onCheckedChange={(checked) => handleFormChange('isActive', checked)} />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 italic text-center mt-2">
              *Tips: Rekomendasi selesaikan tugas kategori dahulu.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Batal</Button>
            <Button onClick={handleSubmit} disabled={isUploading || createProduct.isPending || updateProduct.isPending}>
              {isUploading || createProduct.isPending || updateProduct.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog
        open={isCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open);
          if (!open) resetCategoryForm();
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Kategori Produk</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input placeholder="Nama kategori baru" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()} />
              <Button onClick={handleSaveCategory} disabled={createCategory.isPending || updateCategory.isPending}>
                {editingCategoryId ? (
                  <>Simpan Perubahan</>
                ) : showCategoryOutlets ? (
                  <>Simpan Kategori</>
                ) : (
                  <><Plus className="w-4 h-4 mr-1" /> Tambah</>
                )}
              </Button>
            </div>
            {editingCategoryId && (
              <div className="flex justify-end -mt-2">
                <Button variant="link" size="sm" onClick={resetCategoryForm} className="text-slate-500 h-auto p-0">
                  Batal Edit
                </Button>
              </div>
            )}

            {isAdmin && (showCategoryOutlets || editingCategoryId) && (
              <div className="space-y-3 border border-slate-200 dark:border-slate-800 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <label className="text-sm font-medium">Tersedia di Outlet (Kategori)</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-hide">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="cat-outlet-all"
                      checked={newCategoryOutlets.includes("all")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewCategoryOutlets(["all"]);
                        } else {
                          setNewCategoryOutlets([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                    />
                    <label htmlFor="cat-outlet-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                      Semua Outlet
                    </label>
                  </div>

                  {outlets?.map((outlet: any) => (
                    <div key={outlet.id} className="flex items-center space-x-2 ml-6">
                      <input
                        type="checkbox"
                        id={`cat-outlet-${outlet.id}`}
                        disabled={newCategoryOutlets.includes("all")}
                        checked={!newCategoryOutlets.includes("all") && newCategoryOutlets.includes(outlet.id.toString())}
                        onChange={(e) => {
                          const val = outlet.id.toString();
                          if (e.target.checked) {
                            setNewCategoryOutlets(prev => [...prev.filter(id => id !== "all"), val]);
                          } else {
                            setNewCategoryOutlets(prev => prev.filter(id => id !== val));
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <label htmlFor={`cat-outlet-${outlet.id}`} className="text-sm leading-none cursor-pointer text-slate-700 dark:text-slate-300 peer-disabled:opacity-50">
                        {outlet.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide pr-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {categories?.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Belum ada kategori</p>
              ) : (
                categories?.map((cat: any) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{cat.name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        {getOutletName(cat)}
                      </span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <Button variant="ghost" size="sm" onClick={() => handleEditCategory(cat)} className="text-slate-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 h-8 w-8 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCategoryDialogOpen(false);
              resetCategoryForm();
            }}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-sm sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Detail Produk</DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
                  {getProductImage(detailProduct) ? (
                    <img src={getProductImage(detailProduct)!} alt={detailProduct.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{detailProduct.name}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{getCategoryName(detailProduct)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Status Produk</label>
                  {detailProduct.isActive ? (
                    <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                  )}
                </div>
                <div className="text-right">
                  <label className="text-xs text-slate-500 block mb-1">Harga</label>
                  <div className="font-bold text-primary text-base">{formatRupiah(detailProduct.price)}</div>
                </div>
              </div>

              {isAdmin && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                  <label className="text-xs text-slate-500 block mb-2">Outlet yang Diizinkan</label>
                  <ul className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl leading-relaxed shadow-sm space-y-2">
                    {getOutletNamesArray(detailProduct).map((name, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                        <span>{name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}