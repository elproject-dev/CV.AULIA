import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useListCategories, useCreateCategory, useDeleteCategory, getListProductsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Package, FolderPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  const { data: products, isLoading } = useListProducts({ search: search.length > 2 ? search : undefined });
  const { data: categories } = useListCategories();
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    categoryId: "none",
    stock: "",
    imageUrl: "",
    isActive: true
  });

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price: product.price.toString(),
        categoryId: product.categoryId?.toString() || "none",
        stock: product.stock?.toString() || "",
        imageUrl: product.imageUrl || "",
        isActive: product.isActive
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        price: "",
        categoryId: "none",
        stock: "",
        imageUrl: "",
        isActive: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      price: parseInt(formData.price),
      categoryId: formData.categoryId === "none" ? null : parseInt(formData.categoryId),
      stock: formData.stock === "" ? null : parseInt(formData.stock),
      imageUrl: formData.imageUrl || null,
      isActive: formData.isActive
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Sukses", description: "Produk diperbarui" });
          setIsDialogOpen(false);
        }
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Sukses", description: "Produk ditambahkan" });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if(confirm("Hapus produk ini?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Sukses", description: "Produk dihapus" });
        }
      });
    }
  };

  const handleCreateCategory = () => {
    if(!newCategoryName.trim()) return;
    createCategory.mutate({ data: { name: newCategoryName } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        toast({ title: "Sukses", description: "Kategori ditambahkan" });
        setNewCategoryName("");
        setIsCategoryDialogOpen(false);
      }
    });
  };

  const handleDeleteCategory = (id: number) => {
    if(confirm("Hapus kategori ini?")) {
      deleteCategory.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Sukses", description: "Kategori dihapus" });
        }
      });
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Produk</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
              <FolderPlus className="w-4 h-4 mr-2" /> Kategori
            </Button>
            <Button onClick={() => handleOpenDialog()} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Tambah Produk
            </Button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input 
                  placeholder="Cari produk..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-16">Foto</TableHead>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Memuat...</TableCell></TableRow>
                ) : products?.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.categoryName || "-"}</TableCell>
                    <TableCell className="font-bold text-slate-700">{formatRupiah(product.price)}</TableCell>
                    <TableCell>{product.stock !== null ? product.stock : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)}>
                        <Edit className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
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
            <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Produk</label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Harga (Rp)</label>
              <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori</label>
              <Select value={formData.categoryId} onValueChange={(v) => setFormData({...formData, categoryId: v})}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Kategori</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Stok (Kosongkan jika tidak terbatas)</label>
              <Input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL Gambar</label>
              <Input value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kelola Kategori</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Nama kategori baru" 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
              />
              <Button onClick={handleCreateCategory} disabled={createCategory.isPending}>Tambah</Button>
            </div>
            <div className="mt-4 border rounded-md overflow-hidden">
              <Table>
                <TableBody>
                  {categories?.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right w-16">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)} disabled={deleteCategory.isPending}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <TableRow><TableCell colSpan={2} className="text-center text-slate-500">Belum ada kategori</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
