import { useState, useRef, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, getListProductsQueryKey, getListCategoriesQueryKey, useListOutlets, useCreateStockMovement, useListStockMovements, useDeleteStockMovement, useDeleteAllStockMovements, useBulkSaveProductUoms } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { uploadProductImage, deleteProductImage, deleteProductImageByName, getProductImageUrl } from "@/lib/supabase-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Package, FolderPlus, Upload, X, Image as ImageIcon, Store, Tag, AlertTriangle, SlidersHorizontal, ArrowUpDown, Clock, Layers, Archive, CheckCircle, Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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

  // Check if user is admin (only cvauliausaha@gmail.com)
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

  const { data: products, isLoading, refetch: refetchProducts } = useListProducts({
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
  const { data: categories, refetch: refetchCategories } = useListCategories({ outletId: selectedOutlet });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [restockItems, setRestockItems] = useState<{ productId: string, quantity: number }[]>([{ productId: "", quantity: 1 }]);
  const createStockMovement = useCreateStockMovement();
  const bulkSaveUoms = useBulkSaveProductUoms();

  // UOM State for Add/Edit Dialog
  const [uomRows, setUomRows] = useState<any[]>([]);
  // Quick Restock UOM
  const [quickRestockUnit, setQuickRestockUnit] = useState<string>('pcs');
  const [quickRestockConversion, setQuickRestockConversion] = useState<number>(1);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOutlets, setNewCategoryOutlets] = useState<string[]>(["all"]);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [showCategoryOutlets, setShowCategoryOutlets] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Tab & Stock Management States
  const [activeTab, setActiveTab] = useState<'products' | 'stock' | 'discounts' | 'history'>('products');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'out' | 'low' | 'available'>('all');
  const [quickRestockProduct, setQuickRestockProduct] = useState<any>(null);
  const [quickRestockQty, setQuickRestockQty] = useState<number>(10);
  const [quickRestockNote, setQuickRestockNote] = useState<string>("Restock Manual Cepat");

  // Discount Modal State
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountProduct, setDiscountProduct] = useState<any>(null);
  const [discountHpp, setDiscountHpp] = useState<string>(""); // HPP input for discount dialog

  // Stock stats calculation from currently loaded products list
  const stockStats = useMemo(() => {
    if (!products) return { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 };
    let totalStock = 0;
    let outOfStock = 0;
    let lowStock = 0;

    products.forEach((p: any) => {
      const stock = p.stock_quantity || 0;
      totalStock += stock;
      if (stock <= 0) {
        outOfStock++;
      } else if (stock < 20) {
        lowStock++;
      }
    });

    return {
      totalItems: products.length,
      totalStock,
      outOfStock,
      lowStock
    };
  }, [products]);

  // Filtered products list for the stock table
  const filteredStockProducts = useMemo(() => {
    if (!sortedProducts) return [];
    return sortedProducts.filter((product: any) => {
      const stock = product.stock_quantity || 0;
      if (stockStatusFilter === 'out') return stock <= 0;
      if (stockStatusFilter === 'low') return stock > 0 && stock < 20;
      if (stockStatusFilter === 'available') return stock >= 20;
      return true;
    });
  }, [sortedProducts, stockStatusFilter]);

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
    isActive: true,
    stockQuantity: ""
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
        isActive: product.isActive,
        stockQuantity: product.stock_quantity ? formatNumberWithDots(product.stock_quantity.toString()) : ""
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
      // UOM logic moved to discount dialog
    } else {
      setEditingProduct(null);
      setFormData({ name: "", price: "", categoryId: "none", allowedOutlets: ["all"], imageUrl: "", isActive: true, stockQuantity: "" });
      setOriginalData(null);
      setHasChanges(false);
      setImagePreview("");
      setImageFile(null);
      setUomRows([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setImagePreview("");
    setImageFile(null);
    setIsUploading(false);
    setFormData({ name: "", price: "", categoryId: "none", allowedOutlets: ["all"], imageUrl: "", isActive: true, stockQuantity: "" });
    setOriginalData(null);
    setHasChanges(false);
    setUomRows([]);
  };

  const handleOpenDiscountDialog = (product: any) => {
    setDiscountProduct(product);
    const existingUoms = (product.uoms || []).filter((u: any) => u.unit_name !== 'pcs');

    // Group existing UOMs by unit_name
    const groups: { [key: string]: any } = {};
    existingUoms.forEach((u: any) => {
      const name = u.unit_name.toLowerCase().trim();
      if (!groups[name]) {
        groups[name] = {
          unit_name: u.unit_name,
          conversion_factor: u.conversion_factor,
          price: u.price ? formatNumberWithDots(Math.round(Number(u.price)).toString()) : '',
          is_default: u.is_default || false,
          tiers: []
        };
      }
      groups[name].tiers.push({
        discount_type: u.discount_type || 'none',
        discount_value: u.discount_value ? formatNumberWithDots(Math.round(Number(u.discount_value)).toString()) : '',
        min_qty: u.min_qty || 1,
        label: u.label || ''
      });
    });

    const groupedRows = Object.values(groups).map((group: any) => {
      if (group.tiers.length === 0) {
        group.tiers.push({
          discount_type: 'none',
          discount_value: '',
          min_qty: 1,
          label: ''
        });
      }
      // Sort to keep tiers in order of min_qty ascending
      group.tiers.sort((a: any, b: any) => Number(a.min_qty) - Number(b.min_qty));
      return group;
    });

    setUomRows(groupedRows);
    setHasChanges(false);
    // Load existing HPP from product data
    setDiscountHpp(product.hpp ? formatNumberWithDots(Math.round(Number(product.hpp)).toString()) : '');
    setIsDiscountDialogOpen(true);
  };

  const handleCloseDiscountDialog = () => {
    setIsDiscountDialogOpen(false);
    setDiscountProduct(null);
    setUomRows([]);
    setDiscountHpp("");
    setHasChanges(false);
  };

  const handleSaveDiscounts = async () => {
    if (!discountProduct) return;

    const uomsToSave: any[] = [
      { unit_name: 'pcs', conversion_factor: 1, price: null, is_default: uomRows.length === 0 }
    ];

    uomRows.forEach((group: any) => {
      group.tiers.forEach((tier: any) => {
        uomsToSave.push({
          unit_name: group.unit_name.toLowerCase().trim(),
          conversion_factor: Number(group.conversion_factor) || 1,
          price: group.price ? parseNumberFromDots(group.price) : null,
          is_default: group.is_default,
          discount_type: (tier.discount_value && parseNumberFromDots(tier.discount_value) > 0) ? 'amount' : 'none',
          discount_value: tier.discount_value ? parseNumberFromDots(tier.discount_value) : 0,
          min_qty: Number(tier.min_qty) || 1,
          label: tier.discount_type === 'none' ? null : (tier.label || null)
        });
      });
    });

    const hppValue = parseNumberFromDots(discountHpp);

    try {
      // Save HPP to product record
      await new Promise<void>((resolve, reject) => {
        updateProduct.mutate({
          id: discountProduct.id,
          data: {
            name: discountProduct.name,
            price: discountProduct.price,
            isActive: discountProduct.isActive ?? discountProduct.is_active ?? true,
            allowedOutlets: discountProduct.allowed_outlets || ['all'],
            hpp: hppValue > 0 ? hppValue : null,
          }
        }, {
          onSuccess: () => resolve(),
          onError: (err: any) => reject(err)
        });
      });

      // Save UOMs
      bulkSaveUoms.mutate({ productId: discountProduct.id, uoms: uomsToSave }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          refetchProducts();
          toast({ title: "Sukses", description: "Pengaturan HPP, satuan & diskon disimpan" });
          handleCloseDiscountDialog();
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error?.message || "Gagal menyimpan pengaturan", variant: "destructive" });
        }
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Gagal menyimpan HPP", variant: "destructive" });
    }
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
        isActive: formData.isActive,
        stockQuantity: parseNumberFromDots(formData.stockQuantity || '0') || 0
      };

      // UOM logic moved to its own dialog

      if (isUpdate) {
        updateProduct.mutate({ id: editingProduct.id, data: payload }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            refetchProducts();
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
          onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            refetchProducts();
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
          refetchProducts();
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

    if (editingCategoryId) {
      updateCategory.mutate({
        id: editingCategoryId,
        data: {
          name: newCategoryName,
          allowedOutlets: ["all"]
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          refetchCategories();
          toast({ title: "Sukses", description: "Kategori diperbarui" });
          resetCategoryForm();
        }
      });
    } else {
      createCategory.mutate({
        data: {
          name: newCategoryName,
          allowedOutlets: ["all"]
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          refetchCategories();
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
          refetchCategories();
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

  // Helper: format stock in multi-unit display
  const formatMultiUnitStock = (product: any) => {
    const stock = product.stock_quantity || 0;
    const uoms = (product.uoms || []).filter((u: any, index: number, self: any[]) => 
      u.unit_name !== 'pcs' && u.conversion_factor > 1 && self.findIndex((t: any) => t.unit_name === u.unit_name) === index
    );
    if (uoms.length === 0) return `${stock} pcs`;
    // Sort by conversion factor descending
    const sorted = [...uoms].sort((a: any, b: any) => b.conversion_factor - a.conversion_factor);
    let remaining = stock;
    const parts: string[] = [];
    sorted.forEach((u: any) => {
      const count = Math.floor(remaining / u.conversion_factor);
      if (count > 0) {
        parts.push(`${count} ${u.unit_name}`);
        remaining = remaining % u.conversion_factor;
      }
    });
    if (remaining > 0) parts.push(`${remaining} pcs`);
    return parts.length > 0 ? parts.join(', ') : `${stock} pcs`;
  };

  // Helper: get UOM options for a product (for selects)
  const getProductUomOptions = (product: any) => {
    const uoms = product?.uoms || [];
    if (uoms.length === 0) return [{ unit_name: 'pcs', conversion_factor: 1 }];
    return uoms;
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

  const handleRestockSubmit = async () => {
    const validItems = restockItems.filter(item => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Minimal masukkan 1 produk dengan kuantitas > 0", variant: "destructive" });
      return;
    }

    try {
      for (const item of validItems) {
        await createStockMovement.mutateAsync({
          data: {
            product_id: parseInt(item.productId),
            quantity: item.quantity,
            type: 'restock',
            note: 'Manual Restock Gudang'
          }
        });
      }
      toast({ title: "Sukses", description: "Restock gudang berhasil" });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setIsRestockDialogOpen(false);
      setRestockItems([{ productId: "", quantity: 1 }]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal melakukan restock", variant: "destructive" });
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="w-6 h-6 text-primary animate-pulse" />
            Manajemen Produk
          </h1>
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} className="flex-1 sm:flex-initial w-full sm:w-auto">
                  <FolderPlus className="w-4 h-4 mr-2" /> Kategori
                </Button>
                <Button onClick={() => handleOpenDialog()} className="flex-1 sm:flex-initial w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Produk
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between sm:justify-start sm:gap-6 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('products')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'products'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Package className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Daftar Produk</span>
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('stock')}
                className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'stock'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Layers className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Stok Barang</span>
                {stockStats.outOfStock > 0 && (
                  <span className="absolute sm:relative top-2 right-1/4 sm:top-0 sm:right-0 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 animate-bounce" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('discounts')}
                className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'discounts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Tag className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Diskon & Satuan</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Clock className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Riwayat Aksi</span>
              </button>
            </>
          )}
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          {activeTab === 'products' ? (
            <>
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
                    <Button variant="outline" className="flex items-center gap-2 shrink-0">
                      <SlidersHorizontal className="w-4 h-4" />
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


                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Mobile Card List */}
              <div className="flex flex-col gap-3 md:hidden">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500 dark:text-slate-400">
                    <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-xs font-medium">Memuat...</p>
                  </div>
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
                              </div>
                              {product.isActive ? (
                                <Badge className="bg-green-500 dark:bg-green-600 whitespace-nowrap text-xs">Aktif</Badge>
                              ) : (
                                <Badge className="bg-slate-500 hover:bg-slate-600 text-white whitespace-nowrap text-xs border-0">Nonaktif</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-1">
                              <div className="font-bold text-primary text-sm">{formatRupiah(product.price)}</div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${(product.stock_quantity || 0) <= 0
                                ? "bg-red-500 text-white"
                                : (product.stock_quantity || 0) < 20
                                  ? "bg-amber-500 text-white"
                                  : "bg-blue-500 text-white"
                                }`}>
                                Stok: {(product.stock_quantity || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
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
                        <TableHead className="text-center whitespace-nowrap">Stok Gudang</TableHead>
                        <TableHead className="text-center whitespace-nowrap">Kategori</TableHead>

                        <TableHead className="text-center whitespace-nowrap">Status</TableHead>
                        {isAdmin && <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 8 : 6} className="py-12">
                            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                              <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                              <p className="text-xs font-medium">Memuat...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : sortedProducts?.length === 0 ? (
                        <TableRow><TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-slate-500 dark:text-slate-400">Tidak ada data</TableCell></TableRow>
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
                              <TableCell className="text-center whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${(product.stock_quantity || 0) <= 0
                                  ? "bg-red-500 text-white"
                                  : (product.stock_quantity || 0) < 20
                                    ? "bg-amber-500 text-white"
                                    : "bg-blue-500 text-white"
                                  }`}>
                                  {(product.stock_quantity || 0).toLocaleString('id-ID')}
                                </span>
                              </TableCell>
                              <TableCell className="text-center whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{categoryName}</TableCell>

                              <TableCell className="text-center whitespace-nowrap">
                                {product.isActive ? (
                                  <Badge className="bg-green-500 dark:bg-green-600 border-0">Aktif</Badge>
                                ) : (
                                  <Badge className="bg-slate-500 hover:bg-slate-600 text-white border-0">Nonaktif</Badge>
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
            </>
          ) : activeTab === 'stock' ? (
            <>
              {/* Stock Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-5 items-stretch">
                {/* Total Jenis Barang */}
                <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Jenis Barang</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {stockStats.totalItems}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Package className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-blue-200">Produk Terdaftar</p>
                  </div>
                </div>

                {/* Total Stok Gudang */}
                <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-purple-100 text-xs sm:text-sm font-medium">Total Stok Gudang</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {stockStats.totalStock}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Archive className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-purple-200">Pcs Terhitung</p>
                  </div>
                </div>

                {/* Stok Habis */}
                <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-red-100 text-xs sm:text-sm font-medium">Stok Habis</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {stockStats.outOfStock}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-red-200">Perlu Restock Segera</p>
                  </div>
                </div>

                {/* Stok Menipis */}
                <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-lg h-full">
                  <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-amber-100 text-xs sm:text-sm font-medium">Stok Menipis</p>
                        <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                          {stockStats.lowStock}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-white animate-pulse" />
                      </div>
                    </div>
                    <p className="text-xs mt-3 text-amber-200">Batas Kritis Low</p>
                  </div>
                </div>
              </div>

              {/* Stock Filters */}
              <div className="mb-4 flex flex-row items-center gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                  <Input
                    placeholder="Cari stok barang..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex gap-2 shrink-0">
                  <Select
                    value={stockStatusFilter}
                    onValueChange={(val: any) => setStockStatusFilter(val)}
                  >
                    <SelectTrigger className="w-[130px] sm:w-[180px] bg-white dark:bg-slate-900 text-xs">
                      <SelectValue placeholder="Filter Stok" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Stok</SelectItem>
                      <SelectItem value="out">Stok Habis (0)</SelectItem>
                      <SelectItem value="low">Stok Menipis (1-19)</SelectItem>
                      <SelectItem value="available">Tersedia (&gt;=20)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mobile Stock Cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500 dark:text-slate-400">
                    <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-xs font-medium">Memuat...</p>
                  </div>
                ) : filteredStockProducts.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada data stok</div>
                ) : (
                  filteredStockProducts.map((product: any) => {
                    const categoryName = getCategoryName(product);
                    const productImage = getProductImage(product);
                    const stock = product.stock_quantity || 0;

                    return (
                      <div key={product.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 flex flex-col gap-3">
                        <div className="flex gap-3 relative">
                          <div className="w-12 h-12 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {productImage ? (
                              <img src={productImage} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <Package className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-14">
                            <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{product.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{categoryName}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Stok: {stock.toLocaleString('id-ID')}</span>
                              {(product.uoms || []).filter((u: any) => u.unit_name !== 'pcs' && u.conversion_factor > 1).length > 0 && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">({formatMultiUnitStock(product)})</span>
                              )}
                            </div>
                          </div>
                          <div className="absolute top-0 right-0">
                            {stock <= 0 ? (
                              <Badge variant="destructive" className="bg-red-500 text-white text-[10px] py-0.5 px-2 font-semibold border-0 shadow-none">Habis</Badge>
                            ) : stock < 20 ? (
                              <Badge className="bg-amber-500 text-white text-[10px] py-0.5 px-2 font-semibold border-0 shadow-none">Menipis</Badge>
                            ) : (
                              <Badge className="bg-green-500 text-white text-[10px] py-0.5 px-2 font-semibold border-0 shadow-none">Tersedia</Badge>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs py-1 h-8"
                              onClick={() => {
                                setQuickRestockProduct(product);
                                setQuickRestockQty(10);
                                setQuickRestockNote("Restock Manual Cepat");
                              }}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Restock Cepat
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Stock Table */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                        <TableHead className="w-16 text-center">Foto</TableHead>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead className="text-center">Kategori</TableHead>
                        <TableHead className="text-center">Stok Gudang</TableHead>
                        <TableHead className="text-center">Status Stok</TableHead>
                        <TableHead className="text-right">Terakhir Diupdate</TableHead>
                        {isAdmin && <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 7 : 6} className="py-12">
                            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                              <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                              <p className="text-xs font-medium">Memuat...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredStockProducts.length === 0 ? (
                        <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-500 dark:text-slate-400">Tidak ada data stok yang cocok</TableCell></TableRow>
                      ) : (
                        filteredStockProducts.map((product: any) => {
                          const categoryName = getCategoryName(product);
                          const productImage = getProductImage(product);
                          const stock = product.stock_quantity || 0;

                          return (
                            <TableRow key={product.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200">
                              <TableCell className="text-center">
                                <div className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 mx-auto">
                                  {productImage ? (
                                    <img src={productImage} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ) : (
                                    <Package className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900 dark:text-white">{product.name}</TableCell>
                              <TableCell className="text-center text-sm text-slate-600 dark:text-slate-400">{categoryName}</TableCell>
                              <TableCell className="text-center font-bold text-base">
                                <div>{stock.toLocaleString('id-ID')}</div>
                                {(product.uoms || []).filter((u: any) => u.unit_name !== 'pcs' && u.conversion_factor > 1).length > 0 && (
                                  <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                    {formatMultiUnitStock(product)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {stock <= 0 ? (
                                  <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white font-semibold">Habis</Badge>
                                ) : stock < 20 ? (
                                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">Menipis</Badge>
                                ) : (
                                  <Badge className="bg-green-500 hover:bg-green-600 text-white font-semibold">Tersedia</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-500 dark:text-slate-400">
                                {product.updated_at ? new Date(product.updated_at).toLocaleString('id-ID', {
                                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                }) : '-'}
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setQuickRestockProduct(product);
                                        setQuickRestockQty(10);
                                        setQuickRestockNote("Restock Manual Cepat");
                                      }}
                                      className="text-xs py-1 h-8"
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1" /> Restock
                                    </Button>
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
            </>
          ) : activeTab === 'discounts' ? (
            <>
              <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Satuan & Diskon Grosir</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola varian satuan (dus, pack) dan promo grosiran</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                  <Input
                    placeholder="Cari produk..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Mobile Discount Cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
                    <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-xs font-medium">Memuat data produk...</p>
                  </div>
                ) : sortedProducts?.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">Tidak ada produk ditemukan.</div>
                ) : (
                  sortedProducts?.map((product: any) => {
                    const uoms = product.uoms || [];
                    const hasDiscount = uoms.some((u: any) => u.discount_type !== 'none' && (Number(u.discount_value) > 0));
                    const additionalUoms = uoms.filter((u: any, index: number, self: any[]) => 
                      u.unit_name !== 'pcs' && self.findIndex((t: any) => t.unit_name === u.unit_name) === index
                    );
                    return (
                      <div key={product.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-3">
                        <div className="flex gap-3 relative">
                          <div className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {getProductImage(product) ? (
                              <img src={getProductImage(product)!} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-14">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{categories?.find((c: any) => c.id === product.category_id || c.id === product.categoryId)?.name || "Tanpa Kategori"}</div>
                            <div className="mt-1 font-medium text-slate-700 dark:text-slate-300 text-sm">{formatRupiah(product.price)} / pcs</div>
                          </div>
                          {hasDiscount && (
                            <div className="absolute top-0 right-0">
                              <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] py-0.5 px-2 font-semibold border-0 shadow-none">Promo</Badge>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge className="text-[10px] bg-slate-500 text-white border-0">pcs</Badge>
                          {additionalUoms.map((u: any, idx: number) => (
                            <Badge key={idx} className={`text-[10px] border-0 ${u.discount_type !== 'none' && Number(u.discount_value) > 0 ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}`}>
                              {u.unit_name}
                            </Badge>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <Button size="sm" variant="outline" onClick={() => handleOpenDiscountDialog(product)} className="w-full text-xs h-8">
                            <Tag className="w-3.5 h-3.5 mr-1.5" /> Atur Satuan & Diskon
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Discount Table */}
              <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow className="border-slate-200 dark:border-slate-800">
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Produk</TableHead>
                        <TableHead className="text-center font-semibold text-slate-700 dark:text-slate-300">Harga/Items</TableHead>
                        <TableHead className="text-center font-semibold text-slate-700 dark:text-slate-300">Varian Satuan</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-12">
                            <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                              <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                              <p className="text-xs font-medium">Memuat data produk...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : sortedProducts?.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8">Tidak ada produk ditemukan.</TableCell></TableRow>
                      ) : (
                        sortedProducts?.map((product: any) => {
                          const uoms = product.uoms || [];
                          const hasDiscount = uoms.some((u: any) => u.discount_type !== 'none' && (Number(u.discount_value) > 0));
                          const additionalUoms = uoms.filter((u: any, index: number, self: any[]) => 
                            u.unit_name !== 'pcs' && self.findIndex((t: any) => t.unit_name === u.unit_name) === index
                          );
                          return (
                            <TableRow key={product.id} className="border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {getProductImage(product) ? (
                                      <img src={getProductImage(product)!} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    ) : (
                                      <ImageIcon className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                      {product.name}
                                      {hasDiscount && (
                                        <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 px-1.5 py-0 h-4 text-[9px] leading-none">Promo Aktif</Badge>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{categories.find(c => c.id === product.category_id || c.id === product.categoryId)?.name || "Tanpa Kategori"}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center whitespace-nowrap">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{formatRupiah(product.price)}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  <Badge className="text-[10px] bg-slate-500 hover:bg-slate-600 text-white border-0">pcs</Badge>
                                  {additionalUoms.map((u: any, idx: number) => (
                                    <Badge key={idx} className={`text-[10px] border-0 ${u.discount_type !== 'none' && Number(u.discount_value) > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white'}`}>
                                      {u.unit_name}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => handleOpenDiscountDialog(product)} className="h-8 text-xs font-medium">
                                  <Tag className="w-3.5 h-3.5 mr-1.5" /> Atur Satuan & Diskon
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : activeTab === 'history' ? (
            <HistoryTabContent isAdmin={isAdmin} />
          ) : null}
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

            {/* Stock Quantity (pcs) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Stok Gudang Utama (pcs)</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Masukkan jumlah stok awal"
                value={formData.stockQuantity}
                onChange={(e) => {
                  const formatted = formatNumberWithDots(e.target.value);
                  handleFormChange('stockQuantity', formatted);
                }}
              />
            </div>

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

      {/* Discount & UOM Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="sm:max-w-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Atur Satuan & Diskon Grosir</DialogTitle>
            <DialogDescription className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {discountProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* HPP & Margin Section */}
            {(() => {
              const hargaJual = Number(discountProduct?.price) || 0;
              const hppValue = parseNumberFromDots(discountHpp);
              const margin = hargaJual > 0 && hppValue > 0
                ? ((hargaJual - hppValue) / hargaJual) * 100
                : null;
              const marginNominal = hargaJual > 0 && hppValue > 0
                ? hargaJual - hppValue
                : null;
              const isMarginNegative = margin !== null && margin < 0;

              return (
                <div className="space-y-3 border border-slate-200 dark:border-slate-800 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="text-slate-500">💰</span>
                    HPP &amp; Margin
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-500">Harga Jual (pcs)</label>
                      <div className="h-8 px-3 flex items-center text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-400 font-medium">
                        {hargaJual > 0 ? formatNumberWithDots(hargaJual.toString()) : '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-500">HPP / Modal (Rp)</label>
                      <Input
                        placeholder="Masukkan HPP"
                        value={discountHpp}
                        onChange={(e) => {
                          setDiscountHpp(formatNumberWithDots(e.target.value));
                          setHasChanges(true);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {hppValue > 0 && hargaJual > 0 && (
                    <div className={`p-2.5 rounded-md border text-xs flex flex-wrap gap-x-4 gap-y-1 ${
                      isMarginNegative
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    }`}>
                      <span className={isMarginNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                        Margin: <strong>{margin !== null ? margin.toFixed(2) : 0}%</strong>
                      </span>
                      <span className={isMarginNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                        Laba: <strong>{marginNominal !== null ? formatNumberWithDots(Math.round(marginNominal).toString()) : '-'}</strong>
                      </span>
                      {isMarginNegative && (
                        <span className="text-red-600 dark:text-red-400 font-semibold w-full">⚠️ HPP melebihi harga jual!</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-3 border border-slate-200 dark:border-slate-800 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <label className="text-sm font-medium flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-500" />
                Satuan Ukur &amp; Diskon
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                Satuan dasar (pcs) otomatis ditambahkan.
              </p>

              {uomRows.length > 0 && (
                <div className="space-y-2">
                  {uomRows.map((row, idx) => (
                    <div key={idx} className="flex flex-col gap-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex flex-wrap sm:flex-nowrap items-end gap-2 sm:gap-3">
                        <div className="w-full sm:flex-1 space-y-1">
                          <label className="text-[10px] font-medium text-slate-500">Nama Satuan</label>
                          <Input
                            placeholder="box, dus, pack..."
                            value={row.unit_name}
                            onChange={(e) => {
                              const newRows = [...uomRows];
                              newRows[idx] = { ...newRows[idx], unit_name: e.target.value.toLowerCase().trim() };
                              setUomRows(newRows);
                              setHasChanges(true);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex-1 sm:w-20 space-y-1">
                          <label className="text-[10px] font-medium text-slate-500">Isi (pcs)</label>
                          <Input
                            type="text"
                            placeholder="12"
                            value={row.conversion_factor}
                            onChange={(e) => {
                              const rawVal = e.target.value.replace(/[^0-9]/g, '');
                              const val = rawVal === '' ? '' : parseInt(rawVal);
                              const newRows = [...uomRows];

                              let newPrice = row.price;
                              if (discountProduct?.price && val !== '') {
                                newPrice = formatNumberWithDots(Math.round((val as number) * Number(discountProduct.price)).toString());
                              } else if (val === '') {
                                newPrice = '';
                              }

                              newRows[idx] = { ...newRows[idx], conversion_factor: val, price: newPrice };
                              setUomRows(newRows);
                              setHasChanges(true);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex-1 sm:w-28 space-y-1">
                          <label className="text-[10px] font-medium text-slate-500">Harga Jual</label>
                          <Input
                            placeholder="Auto"
                            value={row.price}
                            onChange={(e) => {
                              const newRows = [...uomRows];
                              newRows[idx] = { ...newRows[idx], price: formatNumberWithDots(e.target.value) };
                              setUomRows(newRows);
                              setHasChanges(true);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0 mb-[1px]"
                          onClick={() => {
                            const newRows = [...uomRows];
                            newRows.splice(idx, 1);
                            setUomRows(newRows);
                            setHasChanges(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Margin Info per Satuan */}
                      {(() => {
                        const hppPcs = parseNumberFromDots(discountHpp);
                        const convFactor = Number(row.conversion_factor) || 0;
                        const hargaJualSatuan = parseNumberFromDots(row.price || '0');
                        const hppSatuan = hppPcs * convFactor;
                        const labelSatuan = row.unit_name || 'satuan';

                        if (hppPcs <= 0 || convFactor <= 0 || hargaJualSatuan <= 0) return null;

                        const laba = hargaJualSatuan - hppSatuan;
                        const marginPct = (laba / hargaJualSatuan) * 100;
                        const isNegative = laba < 0;

                        return (
                          <div className={`mt-1.5 px-2.5 py-1.5 rounded text-[10px] flex flex-wrap gap-x-3 gap-y-0.5 border ${
                            isNegative
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            <span>HPP {labelSatuan}: <strong>{formatNumberWithDots(Math.round(hppSatuan).toString())}</strong></span>
                            <span>Margin: <strong>{marginPct.toFixed(1)}%</strong></span>
                            <span>Laba: <strong>{formatNumberWithDots(Math.round(laba).toString())}</strong></span>
                            {isNegative && <span className="font-semibold w-full">⚠️ Harga jual di bawah modal!</span>}
                          </div>
                        );
                      })()}
                      {/* Tiers List */}
                      {row.tiers && row.tiers.map((tier: any, tierIdx: number) => {
                        const unitPrice = parseNumberFromDots(row.price || "0");
                        const minQty = tier.min_qty || 1;
                        const discVal = parseNumberFromDots(tier.discount_value || "0");
                        const totalBeforeDisc = unitPrice * minQty;
                        const totalAfterDisc = Math.max(0, totalBeforeDisc - discVal);

                        return (
                        <div key={tierIdx} className="flex flex-col border-t border-slate-100 dark:border-slate-800 pt-3 mt-2">
                          <div className="flex flex-wrap sm:flex-nowrap items-end gap-2 sm:gap-3">
                            <div className="flex-1 sm:w-16 space-y-1">
                              <label className="text-[10px] font-medium text-slate-500">Min. Beli</label>
                              <Input
                                type="text"
                                placeholder="1"
                                value={tier.min_qty}
                                onChange={(e) => {
                                  const rawVal = e.target.value.replace(/[^0-9]/g, '');
                                  const val = rawVal === '' ? '' : parseInt(rawVal);
                                  const newRows = [...uomRows];
                                  const updatedTiers = [...newRows[idx].tiers];
                                  updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], min_qty: val };
                                  newRows[idx] = { ...newRows[idx], tiers: updatedTiers };
                                  setUomRows(newRows);
                                  setHasChanges(true);
                                }}
                                className="h-8 text-sm text-center"
                              />
                            </div>
                            <div className="flex-1 sm:w-24 space-y-1">
                              <label className="text-[10px] font-medium text-slate-500">Nilai Diskon (Rp)</label>
                              <Input
                                placeholder="5.000"
                                value={tier.discount_value}
                                onChange={(e) => {
                                  const newRows = [...uomRows];
                                  const updatedTiers = [...newRows[idx].tiers];
                                  updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], discount_value: formatNumberWithDots(e.target.value) };
                                  newRows[idx] = { ...newRows[idx], tiers: updatedTiers };
                                  setUomRows(newRows);
                                  setHasChanges(true);
                                }}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="w-full sm:flex-1 space-y-1">
                              <label className="text-[10px] font-medium text-slate-500">Label Keterangan</label>
                              <Input
                                placeholder="Grosir 5 box..."
                                value={tier.label}
                                onChange={(e) => {
                                  const newRows = [...uomRows];
                                  const updatedTiers = [...newRows[idx].tiers];
                                  updatedTiers[tierIdx] = { ...updatedTiers[tierIdx], label: e.target.value };
                                  newRows[idx] = { ...newRows[idx], tiers: updatedTiers };
                                  setUomRows(newRows);
                                  setHasChanges(true);
                                }}
                                className="h-8 text-sm"
                              />
                            </div>

                            {row.tiers.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0 mb-[1px]"
                                onClick={() => {
                                  const newRows = [...uomRows];
                                  const updatedTiers = [...newRows[idx].tiers];
                                  updatedTiers.splice(tierIdx, 1);
                                  newRows[idx] = { ...newRows[idx], tiers: updatedTiers };
                                  setUomRows(newRows);
                                  setHasChanges(true);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          
                          {/* Summary Display */}
                          {discVal > 0 && minQty > 0 && (
                            <div className="mt-2 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded text-xs flex items-center flex-wrap gap-1">
                              <span className="text-slate-600 dark:text-slate-400">
                                Total ({minQty} {row.unit_name || 'satuan'}): <span className="line-through">{formatRupiah(totalBeforeDisc)}</span>
                              </span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {formatRupiah(totalAfterDisc)}
                              </span>
                            </div>
                          )}
                        </div>
                        );
                      })}

                      {/* Add Tier Button */}
                      <div className="flex justify-start mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            const newRows = [...uomRows];
                            const updatedTiers = [...newRows[idx].tiers, { discount_type: 'amount', discount_value: '', min_qty: 1, label: '' }];
                            newRows[idx] = { ...newRows[idx], tiers: updatedTiers };
                            setUomRows(newRows);
                            setHasChanges(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Tingkat Diskon
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const defaultConv = 12;
                  const defaultPrice = discountProduct?.price ? formatNumberWithDots(Math.round(defaultConv * Number(discountProduct.price)).toString()) : '';
                  setUomRows([...uomRows, {
                    unit_name: '',
                    conversion_factor: defaultConv,
                    price: defaultPrice,
                    is_default: false,
                    tiers: [{ discount_type: 'none', discount_value: '', min_qty: 1, label: '' }]
                  }]);
                  setHasChanges(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Satuan
              </Button>

              {uomRows.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="font-medium">Preview:</span> 1 pcs = 1 pcs
                  {uomRows.filter(r => r.unit_name).map((r, i) => (
                    <span key={i}> • 1 {r.unit_name} = {r.conversion_factor} pcs</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDiscountDialog}>Batal</Button>
            <Button onClick={handleSaveDiscounts} disabled={bulkSaveUoms.isPending || !hasChanges}>
              {bulkSaveUoms.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
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



            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide pr-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {categories?.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Belum ada kategori</p>
              ) : (
                categories?.map((cat: any) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{cat.name}</span>
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

              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Status</label>
                  {detailProduct.isActive ? (
                    <Badge className="bg-green-500 dark:bg-green-600">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                  )}
                </div>
                <div className="text-center">
                  <label className="text-xs text-slate-500 block mb-1">Stok Gudang</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${(detailProduct.stock_quantity || 0) <= 0
                    ? "bg-red-500 text-white"
                    : (detailProduct.stock_quantity || 0) < 20
                      ? "bg-amber-500 text-white"
                      : "bg-blue-500 text-white"
                    }`}>
                    {(detailProduct.stock_quantity || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="text-right">
                  <label className="text-xs text-slate-500 block mb-1">Harga</label>
                  <div className="font-bold text-primary text-sm sm:text-base whitespace-nowrap">{formatRupiah(detailProduct.price)}</div>
                </div>
              </div>


            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Restock Gudang Utama</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {restockItems.map((item, index) => (
              <div key={index} className="flex items-end gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-500">Produk</label>
                  <Select
                    value={item.productId}
                    onValueChange={(v) => {
                      const newItems = [...restockItems];
                      newItems[index].productId = v;
                      setRestockItems(newItems);
                    }}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-950">
                      <SelectValue placeholder="Pilih Produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} (Stok Saat Ini: {(p.stock_quantity || 0).toLocaleString('id-ID')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs font-medium text-slate-500">Tambah (Qty)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    className="bg-white dark:bg-slate-950"
                    value={item.quantity === 0 ? "" : formatNumberWithDots(String(item.quantity))}
                    onChange={(e) => {
                      const val = parseNumberFromDots(e.target.value);
                      const newItems = [...restockItems];
                      newItems[index].quantity = val;
                      setRestockItems(newItems);
                    }}
                  />
                </div>
                {restockItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      const newItems = [...restockItems];
                      newItems.splice(index, 1);
                      setRestockItems(newItems);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setRestockItems([...restockItems, { productId: "", quantity: 1 }])}
            >
              <Plus className="w-4 h-4 mr-2" /> Tambah Baris Produk
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestockDialogOpen(false)}>Batal</Button>
            <Button onClick={handleRestockSubmit}>Simpan Restock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Restock Dialog */}
      <Dialog open={!!quickRestockProduct} onOpenChange={(open) => { if (!open) { setQuickRestockProduct(null); setQuickRestockUnit('pcs'); setQuickRestockConversion(1); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restock Cepat: {quickRestockProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-500">Stok Saat Ini</label>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {(quickRestockProduct?.stock_quantity || 0).toLocaleString('id-ID')} pcs
                {quickRestockProduct && (quickRestockProduct.uoms || []).filter((u: any) => u.unit_name !== 'pcs' && u.conversion_factor > 1).length > 0 && (
                  <span className="text-sm font-normal text-slate-500 ml-2">({formatMultiUnitStock(quickRestockProduct)})</span>
                )}
              </div>
            </div>

            {/* Unit Selector */}
            {quickRestockProduct && getProductUomOptions(quickRestockProduct).length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Satuan Restock</label>
                <Select
                  value={quickRestockUnit}
                  onValueChange={(val) => {
                    const uom = getProductUomOptions(quickRestockProduct).find((u: any) => u.unit_name === val);
                    setQuickRestockUnit(val);
                    setQuickRestockConversion(uom?.conversion_factor || 1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {getProductUomOptions(quickRestockProduct).map((u: any) => (
                      <SelectItem key={u.unit_name} value={u.unit_name}>
                        {u.unit_name} {u.conversion_factor > 1 ? `(1 ${u.unit_name} = ${u.conversion_factor} pcs)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Jumlah Restock</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={quickRestockQty === 0 ? "" : formatNumberWithDots(String(quickRestockQty))}
                onChange={(e) => {
                  const val = parseNumberFromDots(e.target.value);
                  setQuickRestockQty(val);
                }}
              />
              {quickRestockConversion > 1 && (
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  = {quickRestockQty * quickRestockConversion} pcs akan ditambahkan ke stok
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan</label>
              <Input
                placeholder="Masukkan catatan restock..."
                value={quickRestockNote}
                onChange={(e) => setQuickRestockNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuickRestockProduct(null); setQuickRestockUnit('pcs'); setQuickRestockConversion(1); }}>Batal</Button>
            <Button
              onClick={async () => {
                if (quickRestockQty <= 0) {
                  toast({ title: "Error", description: "Jumlah harus lebih besar dari 0", variant: "destructive" });
                  return;
                }
                const actualPcsQty = quickRestockQty * quickRestockConversion;
                try {
                  await createStockMovement.mutateAsync({
                    data: {
                      product_id: quickRestockProduct.id,
                      quantity: actualPcsQty,
                      type: 'restock',
                      note: quickRestockNote || 'Restock Manual Cepat',
                      unit_name: quickRestockUnit,
                      unit_qty: quickRestockQty,
                      conversion_factor: quickRestockConversion
                    }
                  });
                  toast({ title: "Sukses", description: `Berhasil menambahkan ${quickRestockQty} ${quickRestockUnit} (${actualPcsQty} pcs) stok` });
                  setQuickRestockProduct(null);
                  setQuickRestockUnit('pcs');
                  setQuickRestockConversion(1);
                } catch (e: any) {
                  toast({ title: "Error", description: e.message || "Gagal melakukan restock", variant: "destructive" });
                }
              }}
              disabled={createStockMovement.isPending}
            >
              {createStockMovement.isPending ? "Menyimpan..." : "Simpan Restock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </Sidebar>
  );
}

function HistoryTabContent({ isAdmin }: { isAdmin: boolean }) {
  const { data: movements, isLoading, refetch } = useListStockMovements();
  const deleteMovement = useDeleteStockMovement();
  const deleteAllMovements = useDeleteAllStockMovements();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Hapus riwayat mutasi ini? Perhatian: Menghapus riwayat TIDAK akan mengembalikan stok produk.")) {
      deleteMovement.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Sukses", description: "Riwayat mutasi berhasil dihapus" });
          refetch();
        },
        onError: () => toast({ title: "Error", description: "Gagal menghapus riwayat mutasi", variant: "destructive" })
      });
    }
  };

  const handleDeleteAll = () => {
    if (!isAdmin) return;
    if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat mutasi stok? Tindakan ini tidak dapat dibatalkan dan tidak akan mengembalikan kuantitas stok produk.")) {
      deleteAllMovements.mutate(undefined, {
        onSuccess: () => {
          toast({ title: "Sukses", description: "Seluruh riwayat mutasi berhasil dihapus" });
          refetch();
        },
        onError: () => toast({ title: "Error", description: "Gagal menghapus seluruh riwayat mutasi", variant: "destructive" })
      });
    }
  };

  const formatMovementType = (type: string) => {
    switch (type) {
      case 'restock': return 'Restock Gudang';
      case 'transfer_to_sales': return 'Transfer ke Sales';
      case 'return_from_sales': return 'Kembali dari Sales';
      case 'adjustment': return 'Penyesuaian Stok';
      case 'sale': return 'Penjualan POS';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Riwayat Mutasi Stok</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Seluruh riwayat keluar-masuk barang, penjualan, dan penyesuaian stok.</p>
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteAll}
            disabled={deleteAllMovements.isPending || movements?.length === 0}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 font-medium self-end sm:self-auto"
          >
            Clear All
          </Button>
        )}
      </div>
      {/* Mobile History Cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Memuat riwayat...</p>
          </div>
        ) : movements?.length === 0 ? (
          <div className="text-center py-10 text-slate-500">Belum ada riwayat mutasi.</div>
        ) : (
          movements?.map((move: any) => {
            const isPositive = move.quantity > 0;
            return (
              <div key={move.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{move.products?.name || 'Produk Dihapus'}</h4>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mt-0.5">
                      {formatMovementType(move.type)}
                    </span>
                  </div>
                  <span className={`font-bold inline-flex items-center justify-center px-2 py-1 rounded-md text-sm shrink-0 ${isPositive ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                    {isPositive ? `+${move.quantity}` : move.quantity}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {new Date(move.created_at).toLocaleString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                {move.note && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">"{move.note}"</p>
                )}
                {isAdmin && (
                  <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(move.id)} className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop History Table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow className="border-slate-200 dark:border-slate-800">
                <TableHead>Waktu</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Jenis Mutasi</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Perubahan Qty</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <p className="text-xs font-medium">Memuat riwayat...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : movements?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Belum ada riwayat mutasi.</TableCell></TableRow>
              ) : (
                movements?.map((move: any) => {
                  const isPositive = move.quantity > 0;
                  return (
                    <TableRow key={move.id} className="border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {new Date(move.created_at).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">{move.products?.name || 'Produk Dihapus'}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatMovementType(move.type)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 italic max-w-[200px] truncate" title={move.note || '-'}>
                        {move.note || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold inline-flex items-center justify-center px-2 py-1 rounded-md ${isPositive ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                          {isPositive ? `+${move.quantity}` : move.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(move.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
  );
}