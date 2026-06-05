import { useState, useMemo } from "react";
import { useListProducts, useListCategories, useListCustomers, useCreateTransaction, useGetDashboardStats, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, X, CreditCard, Banknote, QrCode, Wallet, CheckCircle, Tag, ShoppingCart, User as UserIcon, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

interface CartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
}

export default function POSPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaidStr, setAmountPaidStr] = useState<string>("");
  const [discountStr, setDiscountStr] = useState<string>("");
  
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  const { data: products, isLoading: isLoadingProducts } = useListProducts({ 
    search: search.length > 2 ? search : undefined, 
    categoryId, 
    isActive: true 
  });
  const { data: categories } = useListCategories();
  const { data: customers } = useListCustomers();
  
  const createTransaction = useCreateTransaction();

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const tax = useMemo(() => Math.round(subtotal * 0.11), [subtotal]);
  const discount = parseInt(discountStr) || 0;
  const total = useMemo(() => Math.max(0, subtotal + tax - discount), [subtotal, tax, discount]);
  const amountPaid = parseInt(amountPaidStr) || 0;
  const change = amountPaid > 0 ? amountPaid - total : 0;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paymentMethod === "cash" && amountPaid < total) {
      toast({ title: "Error", description: "Uang diterima kurang dari total", variant: "destructive" });
      return;
    }

    createTransaction.mutate({
      data: {
        customerId: customerId,
        cashierName: "Admin Kasir",
        paymentMethod: paymentMethod as any,
        discount,
        amountPaid: paymentMethod === "cash" ? amountPaid : total,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      }
    }, {
      onSuccess: (res) => {
        setLastTransaction(res);
        setShowReceipt(true);
        setCart([]);
        setCustomerId(undefined);
        setPaymentMethod("cash");
        setAmountPaidStr("");
        setDiscountStr("");
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Sukses", description: "Transaksi berhasil disimpan" });
      },
      onError: () => {
        toast({ title: "Error", description: "Gagal menyimpan transaksi", variant: "destructive" });
      }
    });
  };

  const selectedCustomer = customers?.find(c => c.id === customerId);

  return (
    <Sidebar>
      <div className="flex h-full w-full bg-slate-50">
        {/* Left Panel: Products */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
          <div className="p-4 bg-white border-b border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input 
                  placeholder="Cari produk (min 3 huruf)..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 text-lg shadow-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Button 
                variant={categoryId === undefined ? "default" : "outline"} 
                onClick={() => setCategoryId(undefined)}
                className="rounded-full whitespace-nowrap"
              >
                Semua
              </Button>
              {categories?.map(cat => (
                <Button 
                  key={cat.id} 
                  variant={categoryId === cat.id ? "default" : "outline"} 
                  onClick={() => setCategoryId(cat.id)}
                  className="rounded-full whitespace-nowrap"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            {isLoadingProducts ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : products?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Package className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium">Produk tidak ditemukan</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products?.map(product => (
                  <Card 
                    key={product.id} 
                    className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-md transition-all active:scale-95 flex flex-col"
                    onClick={() => addToCart(product)}
                  >
                    <div className="h-32 bg-slate-100 flex items-center justify-center relative">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-10 h-10 text-slate-300" />
                      )}
                      {product.stock !== null && product.stock <= 5 && (
                        <Badge variant="destructive" className="absolute top-2 right-2">
                          Sisa {product.stock}
                        </Badge>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-semibold text-sm line-clamp-2 leading-tight mb-1 flex-1">{product.name}</p>
                      <p className="font-bold text-primary">{formatRupiah(product.price)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel: Cart */}
        <div className="w-96 flex flex-col bg-white shadow-xl z-10 flex-shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Pesanan Aktif
            </h2>
            <Badge variant="secondary" className="font-bold text-sm bg-primary/10 text-primary">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} item
            </Badge>
          </div>

          <ScrollArea className="flex-1 p-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
                <ShoppingCart className="w-16 h-16 mb-4 text-slate-200" />
                <p>Belum ada produk</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.productId} className="flex flex-col p-3 rounded-lg border border-slate-100 bg-slate-50 gap-2">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm leading-tight pr-4">{item.productName}</p>
                      <button onClick={() => removeFromCart(item.productId)} className="text-slate-400 hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="font-bold text-sm text-primary">{formatRupiah(item.price)}</p>
                      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-md p-0.5">
                        <button 
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 active:bg-slate-200 text-slate-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-4 text-center text-sm font-semibold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 active:bg-slate-200 text-slate-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-slate-200 bg-white">
            <div className="p-4 space-y-4">
              {/* Customer Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</label>
                <Select value={customerId?.toString() || "none"} onValueChange={(v) => setCustomerId(v === "none" ? undefined : parseInt(v))}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Pilih Pelanggan (Opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Umum (Bukan Member)</SelectItem>
                    {customers?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{c.name}</span>
                          {c.membershipType === "member" && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] py-0 px-1.5 h-4">MEMBER</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer?.membershipType === "member" && (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Poin tersedia: {selectedCustomer.points}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Metode Pembayaran</label>
                <div className="grid grid-cols-4 gap-2">
                  <button 
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    <Banknote className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Tunai</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod("debit_card")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "debit_card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    <CreditCard className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Debit</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod("credit_card")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "credit_card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    <CreditCard className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Kredit</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod("qris")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "qris" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    <QrCode className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">QRIS</span>
                  </button>
                </div>
              </div>

              {/* Cash Input */}
              {paymentMethod === "cash" && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Uang Diterima</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                      <Input 
                        type="number" 
                        value={amountPaidStr} 
                        onChange={(e) => setAmountPaidStr(e.target.value)} 
                        className="pl-10 font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Kembalian</label>
                    <div className={`h-10 rounded-md border flex items-center px-3 font-bold ${change > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                      {formatRupiah(change)}
                    </div>
                  </div>
                </div>
              )}

              {/* Discount */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Diskon (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                  <Input 
                    type="number" 
                    value={discountStr} 
                    onChange={(e) => setDiscountStr(e.target.value)} 
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Pajak (11%)</span>
                  <span className="font-medium">{formatRupiah(tax)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Diskon</span>
                    <span className="font-medium">-{formatRupiah(discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700">TOTAL</span>
                  <span className="text-2xl font-black text-primary">{formatRupiah(total)}</span>
                </div>
              </div>

              <Button 
                className="w-full h-14 text-lg font-bold shadow-lg" 
                size="lg"
                disabled={cart.length === 0 || createTransaction.isPending || (paymentMethod === "cash" && (amountPaid < total))}
                onClick={handleCheckout}
              >
                {createTransaction.isPending ? "Memproses..." : "BAYAR SEKARANG"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              Transaksi Berhasil
            </DialogTitle>
            <DialogDescription className="text-center">
              Receipt No: #{lastTransaction?.id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 border-y border-dashed border-slate-300 space-y-4 font-mono text-sm">
            {lastTransaction?.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <div>
                  <p>{item.productName}</p>
                  <p className="text-slate-500">{item.quantity} x {formatRupiah(item.price)}</p>
                </div>
                <p className="font-bold">{formatRupiah(item.subtotal)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 py-4 font-mono text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatRupiah(lastTransaction?.subtotal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pajak (11%)</span>
              <span>{formatRupiah(lastTransaction?.tax || 0)}</span>
            </div>
            {lastTransaction?.discount > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>-{formatRupiah(lastTransaction?.discount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-dashed border-slate-300">
              <span>TOTAL</span>
              <span>{formatRupiah(lastTransaction?.total || 0)}</span>
            </div>
            {lastTransaction?.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between pt-2">
                  <span>Tunai</span>
                  <span>{formatRupiah(lastTransaction?.amountPaid || 0)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembali</span>
                  <span>{formatRupiah(lastTransaction?.change || 0)}</span>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowReceipt(false)} className="w-full">Tutup & Lanjut</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
