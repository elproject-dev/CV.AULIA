import { useState, useMemo, useRef, useEffect } from "react";
import { useListProducts, useListCategories, useListCustomers, useCreateTransaction, getListProductsQueryKey, getListCustomersQueryKey, useListOutlets, useListLoadingSessions, useListLoadingItems } from "@workspace/api-client-react";
import { formatRupiah, formatInvoiceNumber } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getProductImageUrl as getProductImageUrlFromStorage } from "@/lib/supabase-storage";
import { connectToPrinter, disconnectPrinter, printReceipt, getAutoPrintSetting, getBluetoothPrinterMac, isBluetoothAvailable } from "@/lib/bluetooth-printer";
import { showTransactionSuccessNotification, showPrinterNotConnectedNotification, showPrintSuccessNotification } from "@/lib/android-notifications";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, X, CreditCard, Banknote, QrCode, ShoppingCart, Package, Trash2, Tag, Printer, Bluetooth, Circle, Store, AlertTriangle, Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthUserName, useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/auth";

interface CartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  unitName: string;
  conversionFactor: number;
  unitPrice: number;
  uomDiscountType?: string;
  uomDiscountAmount?: number;
  uomLabel?: string;
}

// Helper function untuk format angka dengan titik ribuan
const formatNumberWithDots = (value: string): string => {
  const cleanValue = value.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (!cleanValue) return '';
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Helper function untuk parse angka dari format dengan titik ke number
const parseNumberFromDots = (value: string): number => {
  return parseInt(value.replace(/\./g, '')) || 0;
};



const formatCustomerLabel = (customer: any) => {
  return customer?.phone ? `${customer.name} - ${customer.phone}` : customer?.name || '';
};

const CUSTOM_DISCOUNT_NOTE_VALUE = '__custom_discount_note__';

const getDefaultDiscountNotes = () => [
  'Promo Member',
  'Diskon Produk',
  'Voucher Toko',
  'Promo Musiman',
  'Komplain Pelanggan'
];



const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'cash': return 'Tunai';
    case 'transfer': return 'Transfer';
    case 'debit_card': return 'Debit';
    case 'credit_card': return 'Kredit';
    case 'qris': return 'QRIS';
    default: return method;
  }
};

export default function POSPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const cashierName = useAuthUserName();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("pos_cart");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load cart", e);
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pos_cart", JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart.length }));
    }
  }, [cart]);

  const [customerId, setCustomerId] = useState<number | undefined>();
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [manualCustomerName, setManualCustomerName] = useState<string>("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState<string>("");
  const [customerType, setCustomerType] = useState<string>("umum");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaidDisplay, setAmountPaidDisplay] = useState<string>("");
  const [amountPaidStr, setAmountPaidStr] = useState<string>("");
  const [discountDisplay, setDiscountDisplay] = useState<string>("");
  const [discountStr, setDiscountStr] = useState<string>("");
  const [discountNote, setDiscountNote] = useState<string>("");
  const [discountNoteOptions, setDiscountNoteOptions] = useState<string[]>([]);
  const [isCustomDiscountNote, setIsCustomDiscountNote] = useState(false);
  const enableDiscount = false;
  const defaultDiscountPrice = "0";
  const enablePPN = false;
  const ppnPercentage = 11;

  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showProducts, setShowProducts] = useState(false); // Default tidak menampilkan produk

  // UOM selector state
  const [uomSelectorProduct, setUomSelectorProduct] = useState<any>(null);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Initialize outlet: Kasir's specific outlet for Kasir, Admin's assigned outlet if set, otherwise 'all'
  const [selectedOutlet, setSelectedOutlet] = useState<string>(() => {
    // Kasir must use their assigned outlet
    if (!isAdmin) {
      return user?.outletId || "all";
    }
    // Admin with assigned outlet should filter to their outlet
    if (user?.outletId && user.outletId !== "all") {
      return user.outletId;
    }
    // Admin without outlet assignment can see all
    return "all";
  });

  // Force outlet to always match user assignment
  useEffect(() => {
    if (!isAdmin) {
      // Kasir must always use their assigned outlet
      setSelectedOutlet(user?.outletId || "all");
    } else {
      // Admin with assigned outlet should use their outlet, not "all"
      if (user?.outletId && user.outletId !== "all") {
        setSelectedOutlet(user.outletId);
      }
    }
  }, [isAdmin, user?.outletId]);

  const { data: outlets } = useListOutlets();

  const { data: products, isLoading: isLoadingProducts } = useListProducts({
    search: search.length > 2 ? search : undefined,
    // Abaikan categoryId saat ada input pencarian (search >= 3 karakter)
    // Sehingga pencarian tetap bekerja meski kasir masih dalam mode kategori
    categoryId: search.length > 2 ? undefined : categoryId,
    isActive: true,
    outletId: selectedOutlet,
    includeShared: true
  });
  const { data: categories } = useListCategories({ outletId: selectedOutlet });
  const { data: customers, isLoading: isLoadingCustomers, refetch: refetchCustomers } = useListCustomers();

  // FMCG: Fetch active loading session for Kasir
  const { data: activeSessions } = useListLoadingSessions({
    salesId: user?.staffId,
    status: 'active'
  });
  const activeSession = activeSessions?.[0];
  const { data: loadingItems } = useListLoadingItems(activeSession?.id);

  const posProducts = useMemo(() => {
    if (isAdmin) return products || [];
    
    if (!loadingItems) return [];
    
    return loadingItems
      .map((item: any) => ({
        ...item.products,
        stock_quantity: item.quantity_loaded - item.quantity_sold - item.quantity_returned,
        loadingItemId: item.id
      }))
      .filter((p: any) => p.stock_quantity > 0 && p.is_active !== false)
      // apply search
      .filter((p: any) => {
        if (search.length > 2) {
          return p.name.toLowerCase().includes(search.toLowerCase());
        }
        if (categoryId) {
          return p.category_id === categoryId;
        }
        return true;
      });
  }, [isAdmin, products, loadingItems, search, categoryId]);

  const createTransaction = useCreateTransaction();

  // Auto-show products on load if screen is landscape (e.g., Galaxy Tab 7 mapping)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        setShowProducts(true);
      }
    }
  }, []);



  const prevCartLengthRef = useRef(0);
  useEffect(() => {
    const prevLength = prevCartLengthRef.current;
    const currentLength = cart.length;
    prevCartLengthRef.current = currentLength;

    if (currentLength === 0 && prevLength > 0) {
      setDiscountDisplay("");
      setDiscountStr("");
      setDiscountNote("");
      setIsCustomDiscountNote(false);
    }
  }, [cart.length]);



  // Function to handle printing receipt
  const handlePrintReceipt = async (
    transaction: any,
    options?: { showSuccessNotification?: boolean }
  ) => {
    console.log('Starting print process...', transaction);

    if (!isBluetoothAvailable()) {
      console.error('Bluetooth plugin not available');
      void showPrinterNotConnectedNotification('Plugin Bluetooth tidak tersedia di perangkat ini.');
      return;
    }

    const printerMac = getBluetoothPrinterMac();
    console.log('Printer MAC:', printerMac);

    if (!printerMac) {
      console.error('Printer MAC not set');
      void showPrinterNotConnectedNotification('Alamat MAC printer belum diatur di pengaturan.');
      return;
    }

    setIsPrinting(true);
    try {
      // Prepare transaction data with store settings
      const activeOutletObj = outlets?.find(o => o.id.toString() === selectedOutlet);
      const showFooter = localStorage.getItem('showFooter') !== 'false';
      const printData = {
        ...transaction,
        storeName: activeOutletObj?.store_name || activeOutletObj?.name || localStorage.getItem('storeName') || 'SBAGIAMU',
        storeAddress: activeOutletObj?.address || localStorage.getItem('storeAddress') || '',
        storePhone: activeOutletObj?.phone || localStorage.getItem('storePhone') || '',
        footerMessage: showFooter ? (activeOutletObj?.footer_message || localStorage.getItem('footerMessage') || 'Terima kasih atas kunjungan Anda') : '',
        footerMessage2: showFooter ? (activeOutletObj?.footer_message2 || localStorage.getItem('footerMessage2') || 'Real Brew, Real Bean, Real Coffee') : '',
        footerMessage3: showFooter ? (activeOutletObj?.footer_message3 || localStorage.getItem('footerMessage3') || 'Powered by Tembus Digital') : '',
      };
      console.log('Print data prepared:', printData);

      // Connect to printer (auto connect if not connected)
      console.log('Connecting to printer...');
      const connectionResult = await connectToPrinter(printerMac);
      console.log('Connection result:', connectionResult);

      if (!connectionResult.success) {
        console.error('Connection failed:', connectionResult.message);
        void showPrinterNotConnectedNotification(connectionResult.message);
        return;
      }

      // Add small delay to ensure connection is stable
      await new Promise(resolve => setTimeout(resolve, 500));

      // Print receipt
      console.log('Printing receipt...');
      const printed = await printReceipt(printData);
      console.log('Print result:', printed);

      if (!printed) {
        console.error('Print failed');
        void showPrinterNotConnectedNotification('Gagal mencetak struk. Pastikan printer menyala dan terhubung.');
      } else if (options?.showSuccessNotification) {
        const invoiceId = transaction?.id ?? transaction?.transaction_id;
        void showPrintSuccessNotification(
          transaction?.total ?? 0,
          invoiceId != null ? formatInvoiceNumber(invoiceId) : undefined
        );
      }

      // Wait for print to complete before disconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Disconnect after printing to free up connection
      console.log('Disconnecting printer...');
      await disconnectPrinter();
      console.log('Printer disconnected');
    } catch (error) {
      console.error('Print error:', error);
      void showPrinterNotConnectedNotification(
        error instanceof Error ? error.message : 'Terjadi kesalahan saat mencetak struk.'
      );
      // Ensure disconnect on error
      try {
        await disconnectPrinter();
      } catch (disconnectError) {
        console.error('Error during disconnect:', disconnectError);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const getProductImageUrl = (product: any, size: 'small' | 'thumb' | 'full' = 'full'): string | null => {
    const imageUrl = product.image_url || product.imageUrl;
    if (!imageUrl) return null;
    
    let options = undefined;
    if (size === 'small') options = { width: 200, height: 200 };
    if (size === 'thumb') options = { width: 100, height: 100 };
    
    return getProductImageUrlFromStorage(imageUrl, options);
  };



  const handleAmountPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formattedValue = formatNumberWithDots(rawValue);
    setAmountPaidDisplay(formattedValue);
    setAmountPaidStr(formattedValue);
  };



  const addToCart = (product: any, selectedUnit?: { unit_name: string; conversion_factor: number; price?: number; discount_type?: string; discount_value?: number; label?: string }) => {
    const unitName = selectedUnit?.unit_name || 'pcs';
    const conversionFactor = selectedUnit?.conversion_factor || 1;
    const unitPrice = selectedUnit?.price ? Number(selectedUnit.price) : product.price * conversionFactor;
    
    let uomDiscountAmount = 0;
    if (selectedUnit?.discount_type === 'amount') {
      uomDiscountAmount = Number(selectedUnit.discount_value) || 0;
    } else if (selectedUnit?.discount_type === 'percent') {
      uomDiscountAmount = unitPrice * ((Number(selectedUnit.discount_value) || 0) / 100);
    }

    const cartKey = `${product.id}_${unitName}`;

    if (!isAdmin && product.stock_quantity !== undefined) {
      const existing = cart.find(item => item.productId === product.id && item.unitName === unitName);
      const currentPcsQty = existing ? existing.quantity * existing.conversionFactor : 0;
      // Total pcs of this product across all units in cart
      const totalPcsInCart = cart
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity * item.conversionFactor, 0);
      if (totalPcsInCart + conversionFactor > product.stock_quantity) {
        toast({ title: "Stok Tidak Mencukupi", description: "Tidak dapat melebihi stok di tangan (Loading).", variant: "destructive" });
        return;
      }
    }

    const imageUrl = getProductImageUrl(product, 'thumb');
    
    toast({
      title: product.name,
      description: `Ditambahkan ke keranjang (${unitName})`,
      duration: 1500,
      variant: "success",
    });

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.unitName === unitName);
      if (existing) {
        return prev.map(item => 
          (item.productId === product.id && item.unitName === unitName)
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        imageUrl: imageUrl,
        unitName,
        conversionFactor,
        unitPrice,
        uomDiscountType: selectedUnit?.discount_type || 'none',
        uomDiscountAmount,
        uomLabel: selectedUnit?.label || ''
      }];
    });
  };

  // Handle clicking a product: if it has multiple UOMs, show selector
  const handleProductClick = (product: any) => {
    const uoms = product.uoms || [];
    const nonPcsUoms = uoms.filter((u: any) => u.unit_name !== 'pcs' && u.conversion_factor > 1);
    
    if (nonPcsUoms.length > 0) {
      // Product has multiple units - show UOM selector
      setUomSelectorProduct(product);
    } else {
      // Product only has pcs - add directly
      addToCart(product);
    }
  };

  const updateQuantity = (productId: number, delta: number, unitName: string = 'pcs') => {
    if (!isAdmin && delta > 0) {
      const product = posProducts.find((p: any) => p.id === productId);
      if (product && product.stock_quantity !== undefined) {
        const item = cart.find(i => i.productId === productId && i.unitName === unitName);
        const totalPcsInCart = cart
          .filter(i => i.productId === productId)
          .reduce((sum, i) => sum + i.quantity * i.conversionFactor, 0);
        const convFactor = item?.conversionFactor || 1;
        if (totalPcsInCart + convFactor > product.stock_quantity) {
          toast({ title: "Stok Tidak Mencukupi", description: "Tidak dapat melebihi stok di tangan.", variant: "destructive" });
          return;
        }
      }
    }

    setCart(prev => {
      return prev.map(item => {
        if (item.productId === productId && item.unitName === unitName) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: number, unitName: string = 'pcs') => {
    setCart(prev => prev.filter(item => !(item.productId === productId && item.unitName === unitName)));
  };

  // Function untuk create pelanggan baru
  const createNewCustomer = async (name: string, phone: string, membershipType: string) => {
    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();

      if (!trimmedName) {
        toast({ title: "Error", description: "Nama pelanggan wajib diisi", variant: "destructive" });
        return null;
      }

      // Gunakan outlet dari staff (settingan tugas)
      let outletIdToSave: number | null = user?.outletId && user.outletId !== "all" ? parseInt(user.outletId) : null;

      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: trimmedName,
          phone: trimmedPhone || null,
          membership_type: membershipType,
          points: 0,
          total_spent: 0,
          ...(outletIdToSave !== null ? { outlet_id: outletIdToSave } : {})
        })
        .select()
        .single();

      if (error) {
        console.error('Create customer error:', error);
        toast({ title: "Error", description: "Gagal membuat pelanggan baru", variant: "destructive" });
        return null;
      }

      await queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      await refetchCustomers?.();

      return data;
    } catch (err) {
      console.error('Create customer error:', err);
      return null;
    }
  };

  const clearCart = () => {
    if (cart.length > 0 && confirm("Hapus semua item dari keranjang?")) {
      setCart([]);
      setDiscountDisplay("");
      setDiscountStr("");
      setDiscountNote("");
      setIsCustomDiscountNote(false);
      setAmountPaidDisplay("");
      setAmountPaidStr("");
    }
  };

  // Function untuk update total belanja customer langsung di supabase
  const updateCustomerData = async (customerId: number, transactionTotal: number) => {
    try {
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('total_spent')
        .eq('id', customerId)
        .single();

      if (fetchError) {
        return false;
      }

      const currentTotalSpent = customer?.total_spent || 0;

      // Hitung total belanja baru
      const newTotalSpent = (currentTotalSpent || 0) + transactionTotal;

      // Update customer dengan data baru
      if (newTotalSpent !== currentTotalSpent) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            total_spent: newTotalSpent
          })
          .eq('id', customerId);

        if (updateError) {
          return false;
        } else {
          return true;
        }
      } else {
        return true;
      }
    } catch (err) {
      return false;
    }
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + ((item.unitPrice - (item.uomDiscountAmount || 0)) * item.quantity), 0), [cart]);

  const tax = useMemo(() => {
    if (!enablePPN) return 0;
    return Math.round(subtotal * (ppnPercentage / 100));
  }, [subtotal, enablePPN, ppnPercentage]);

  // Hitung poin yang akan didapat dari pembelian saat ini
  const discount = enableDiscount ? parseNumberFromDots(discountStr) : 0;
  const total = useMemo(() => Math.max(0, subtotal + tax - discount), [subtotal, tax, discount]);
  const amountPaid = parseNumberFromDots(amountPaidStr);
  const change = amountPaid > 0 ? amountPaid - total : 0;
  const discountNoteSelectValue = isCustomDiscountNote
    ? CUSTOM_DISCOUNT_NOTE_VALUE
    : discountNoteOptions.includes(discountNote)
      ? discountNote
      : '';

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: "Error", description: "Keranjang belanja masih kosong", variant: "destructive" });
      return;
    }

    if (paymentMethod === "cash" && amountPaid < total) {
      toast({ title: "Error", description: "Uang diterima kurang dari total", variant: "destructive" });
      return;
    }

    // Create pelanggan baru dari input manual agar langsung masuk ke data pelanggan
    let finalCustomerId = customerId;
    const manualName = manualCustomerName.trim();
    const manualPhone = manualCustomerPhone.trim();
    const normalizedCustomerType = customerType === "member" ? "member" : "non_member";

    if (!customerId && manualName) {
      const newCustomer = await createNewCustomer(manualName, manualPhone, normalizedCustomerType);
      if (newCustomer) {
        finalCustomerId = newCustomer.id;
        toast({ title: "Sukses", description: `Pelanggan baru "${newCustomer.name}" berhasil dibuat`, variant: "default" });
      } else {
        toast({ title: "Error", description: "Gagal membuat pelanggan baru, lanjutkan transaksi tanpa simpan customer", variant: "destructive" });
      }
    }

    const isMemberTransaction = selectedCustomer?.membership_type === "member" || customerType === "member";
    const receiptCustomerName = selectedCustomer?.name || manualCustomerName || "Umum";

    createTransaction.mutate({
      data: {
        customerId: finalCustomerId,
        cashierName,
        paymentMethod: paymentMethod as any,
        discount,
        discountNote: discountNote,
        amountPaid: paymentMethod === "cash" ? amountPaid : total,
        subtotal: subtotal,
        tax: tax,
        change: change,
        customerName: receiptCustomerName !== "Umum" ? receiptCustomerName : undefined,
        customerPhone: selectedCustomer?.phone || manualCustomerPhone || undefined,
        customerType: normalizedCustomerType,
        pointsRedeemed: 0,
        pointsDiscount: 0,
        earnedPoints: 0,
        loadingSessionId: activeSession?.id,
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity * item.conversionFactor,
          price: (item.unitPrice - (item.uomDiscountAmount || 0)) / item.conversionFactor,
          unitName: item.unitName,
          unitQty: item.quantity,
          conversionFactor: item.conversionFactor,
          loadingItemId: posProducts.find((p: any) => p.id === item.productId)?.loadingItemId
        }))
      }
    }, {
      onSuccess: async (res: any) => {
        // Update customer data langsung (total_spent)
        if (finalCustomerId && total > 0) {
          await updateCustomerData(finalCustomerId, total);
          await refetchCustomers?.();
        }

        setLastTransaction({
          ...res,
          cashierName,
          cashier_name: cashierName,
          items: cart,
          subtotal,
          tax,
          discount,
          discountNote,
          total,
          amountPaid: paymentMethod === "cash" ? amountPaid : total,
          change,
          paymentMethod,
          enablePPN,
          ppnPercentage,
          customerName: receiptCustomerName,
          customerPhone: selectedCustomer?.phone || manualCustomerPhone,
          customerType: isMemberTransaction ? "member" : customerType,
          pointsRedeemed: 0,
          pointsDiscount: 0,
          earnedPoints: 0,
          finalCustomerPoints: 0,
          pointsValue: 0
        });
        setShowReceipt(true);

        // Auto print if enabled
        if (getAutoPrintSetting()) {
          const transactionData = {
            ...res,
            cashierName,
            cashier_name: cashierName,
            items: cart,
            subtotal,
            tax,
            discount,
            discountNote,
            total,
            amountPaid: paymentMethod === "cash" ? amountPaid : total,
            change,
            paymentMethod,
            enablePPN,
            ppnPercentage,
            customerName: receiptCustomerName,
            customerPhone: selectedCustomer?.phone || manualCustomerPhone,
            customerType: isMemberTransaction ? "member" : customerType,
            pointsRedeemed: 0,
            pointsDiscount: 0,
            earnedPoints: 0,
            finalCustomerPoints: 0,
            pointsValue: 0,
            createdAt: res?.created_at || new Date().toISOString()
          };
          handlePrintReceipt(transactionData);
        }
        setCart([]);
        setCustomerId(undefined);
        setManualCustomerName("");
        setManualCustomerPhone("");
        setCustomerType("umum");
        setPaymentMethod("cash");
        setAmountPaidDisplay("");
        setAmountPaidStr("");
        setDiscountDisplay("");
        setDiscountStr("");
        setDiscountNote("");
        setIsCustomDiscountNote(false);
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });

        // Dispatch custom event for realtime updates across the app
        window.dispatchEvent(new CustomEvent('transactionCreated', {
          detail: { transactionId: res?.id, cashierName }
        }));
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });

        void showTransactionSuccessNotification(
          total,
          res?.id != null ? formatInvoiceNumber(res.id) : undefined
        );
      },
      onError: (error: any) => {
        toast({ title: "Error", description: error?.message || "Gagal menyimpan transaksi", variant: "destructive" });
      }
    });
  };

  const selectedCustomer = customers?.find(c => c.id === customerId);
  const filteredCustomers = customers?.filter(c => {
    if (!customerSearchQuery) return true;
    if (customerSearchQuery.length < 3) return false;
    const query = customerSearchQuery.toLowerCase();
    const phone = String(c.phone || '').toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      phone.includes(query)
    );
  });

  if (!isAdmin && !activeSession) {
    return (
      <Sidebar>
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 h-full min-h-[calc(100vh-4rem)]">
          <Card className="max-w-md w-full p-8 text-center flex flex-col items-center shadow-lg border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50 rounded-2xl">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-orange-200/50 dark:border-orange-800/50">
              <Package className="w-10 h-10 text-orange-600 dark:text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-3">Belum Ada Sesi Loading</h2>
            <p className="text-orange-700 dark:text-orange-300 mb-6 leading-relaxed">
              Anda belum memiliki sesi "Transfer Stock" (Loading) yang aktif dari Gudang. Silakan hubungi Admin Gudang untuk melakukan transfer stock kepada Anda.
            </p>
          </Card>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="flex flex-col md:flex-row h-full w-full bg-slate-100 dark:bg-slate-900">
        {/* Left Panel: Products */}
        <div className="flex-[3] flex flex-col min-w-0 md:flex-[7] order-1 z-10">
          {/* Search dan Filter Section - SELALU DI ATAS untuk semua device */}
          <div className="p-3 lg:p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2 lg:space-y-3 shadow-md flex-shrink-0">
            {/* Search Input and Outlet Filter Wrapper */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 lg:w-4 lg:h-4" />
                <Input
                  placeholder="Cari produk..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    // Tampilkan produk saat user mengetik 3+ karakter, sembunyikan jika kurang (hanya jika portrait)
                    if (e.target.value.length >= 3) {
                      setShowProducts(true);
                    } else {
                      if (typeof window !== "undefined" && window.innerWidth <= window.innerHeight) {
                        setShowProducts(false);
                      }
                    }
                  }}
                  className="pl-9 h-11 lg:h-12 text-sm lg:text-lg shadow-md border-primary/20 focus:border-primary"
                />
              </div>

            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide pt-2">
              {/* Toggle Button - Simple Circle */}
              <Button
                onClick={() => {
                  if (categoryId !== undefined) {
                    // Jika kategori terpilih, reset kategori tapi tetap tampilkan produk
                    setCategoryId(undefined);
                  } else {
                    // Jika tidak ada kategori, toggle tampilan produk
                    setShowProducts(!showProducts);
                  }
                }}
                className="rounded-full w-9 h-9 lg:w-10 lg:h-10 p-0 shrink-0 flex items-center justify-center"
                variant={categoryId !== undefined || showProducts ? "default" : "outline"}
                size="sm"
              >
                <Circle className="w-4 h-4" fill="currentColor" />
              </Button>

              {categories?.map(cat => (
                <Button
                  key={cat.id}
                  variant={categoryId === cat.id ? "default" : "outline"}
                  onClick={() => {
                    setCategoryId(cat.id);
                    setShowProducts(true); // Tampilkan produk saat kategori diklik
                  }}
                  className="rounded-full whitespace-nowrap shrink-0 text-xs lg:text-sm px-3"
                  size="sm"
                >
                  <Tag className="w-3 h-3 mr-1.5 opacity-70" />
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Product Grid - Conditional Display */}
          {showProducts && (
            <ScrollArea className="flex-1 p-4">
              {isLoadingProducts ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : posProducts?.length === 0 ? (
                <div></div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                  {posProducts?.map(product => {
                   const imageUrl = getProductImageUrl(product, 'small');
                   return (
                     <div
                       key={product.id}
                       className="p-[3px] rounded-xl hover:scale-105 transition-transform duration-200 cursor-pointer"
                       onClick={() => handleProductClick(product)}
                     >
                       <Card
                         className="overflow-hidden active:scale-95 flex flex-col h-full"
                       >
                         <div className="aspect-square w-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center relative">
                           {imageUrl ? (
                             <img
                               src={imageUrl}
                               alt={product.name}
                               className="w-full h-full object-cover"
                               loading="lazy"
                               onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    const icon = parent.querySelector('.product-fallback-icon');
                                    if (icon) icon.classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <Package
                              className={`w-6 h-6 lg:w-10 lg:h-10 text-slate-300 dark:text-slate-600 ${imageUrl ? 'hidden' : ''} product-fallback-icon`}
                            />
                            {!isAdmin && (
                              <Badge className="absolute top-1 right-1 bg-white/90 text-slate-800 border-none font-bold shadow-sm">
                                Stok: {product.stock_quantity}
                              </Badge>
                            )}
                          </div>
                          <div className="p-1.5 lg:p-3 flex flex-col flex-1">
                            <p className="font-bold text-[10px] lg:text-xs truncate leading-tight mb-0.5 flex-1 text-slate-800">{product.name}</p>
                            <p className="font-bold text-[10px] lg:text-xs text-primary dark:text-primary-400">{formatRupiah(product.price)}</p>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* Right Panel: Cart */}
        <div className="w-full md:flex-[4] lg:flex-[3] flex flex-col bg-white dark:bg-slate-800 shadow-xl z-10 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 flex-1 md:h-full order-2 pb-16 md:pb-0">
          <div className="flex-1 overflow-y-auto">
            {/* Cart Header */}
            <div className="p-4 lg:p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-base flex items-center gap-2 text-slate-700">
                  <ShoppingCart className="w-5 h-5 lg:w-4 lg:h-4 text-primary" />
                  Pesanan Aktif
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-medium text-xs lg:text-xs bg-primary/10 text-primary dark:bg-primary-900/30 dark:text-primary-300">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} item
                  </Badge>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Cart Items with Images */}
            <div className="p-4 lg:p-3">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center text-slate-400 dark:text-slate-500 py-6">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Belum ada produk di pilih</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={`${item.productId}_${item.unitName}`} className="flex items-center gap-2 lg:gap-2 p-3 lg:p-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const icon = parent.querySelector('.cart-item-icon');
                                if (icon) icon.classList.remove('hidden');
                              }
                            }}
                          />
                        ) : null}
                        <Package className={`w-4 h-4 lg:w-5 lg:h-5 text-slate-400 dark:text-slate-500 ${item.imageUrl ? 'hidden' : ''} cart-item-icon`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs lg:text-sm leading-tight truncate text-slate-800">{item.productName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.uomDiscountAmount && item.uomDiscountAmount > 0 ? (
                            <div className="flex flex-col">
                              <p className="font-bold text-xs text-primary dark:text-primary-400">
                                {formatRupiah(item.unitPrice - item.uomDiscountAmount)}
                              </p>
                              <p className="text-[9px] text-slate-400 line-through">
                                {formatRupiah(item.unitPrice)}
                              </p>
                            </div>
                          ) : (
                            <p className="font-bold text-xs text-primary dark:text-primary-400">{formatRupiah(item.unitPrice)}</p>
                          )}
                          {item.unitName !== 'pcs' && (
                            <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[9px] px-1 py-0 h-3.5 font-semibold border-0">
                              {item.unitName}
                            </Badge>
                          )}
                          {item.uomLabel && (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px] px-1 py-0 h-3.5 font-semibold border-0 whitespace-nowrap">
                              🏷️ {item.uomLabel}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 lg:gap-2">
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md p-0.5">
                          <button
                            onClick={() => updateQuantity(item.productId, -1, item.unitName)}
                            className="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                          </button>
                          <span className="w-4 text-center text-xs font-medium text-slate-700">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1, item.unitName)}
                            className="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId, item.unitName)}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                        >
                          <X className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Selector */}
            <div className="px-4 lg:px-3 pb-4 lg:pb-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">CARI PELANGGAN</label>
                <div className="relative">
                  <Input
                    value={selectedCustomer ? formatCustomerLabel(selectedCustomer) : customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) {
                        setCustomerId(undefined);
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    placeholder="Cari pelanggan member..."
                    className="h-10 lg:h-9"
                  />
                  {showCustomerDropdown && customerSearchQuery && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {isLoadingCustomers ? (
                        <div className="p-3 text-sm text-slate-500 dark:text-slate-400 font-normal">Memuat...</div>
                      ) : customers && customers.length > 0 ? (
                        <>
                          {filteredCustomers?.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setCustomerId(c.id);
                                setManualCustomerName(c.name || "");
                                setManualCustomerPhone(c.phone ? String(c.phone) : "");
                                setCustomerType(c.membership_type === "member" ? "member" : "umum");
                                setCustomerSearchQuery("");
                                setShowCustomerDropdown(false);
                              }}
                              className="flex items-center gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                            >
                              <span className="flex-1 truncate text-slate-900 dark:text-slate-100">{formatCustomerLabel(c)}</span>
                              {c.membership_type === "member" && (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] py-0 px-1.5 h-4 shrink-0">MEMBER</Badge>
                              )}
                            </div>
                          ))}
                          {filteredCustomers?.length === 0 && (
                            <div className="p-3 text-sm text-slate-500 dark:text-slate-400 font-normal">Tidak ada pelanggan ditemukan</div>
                          )}
                        </>
                      ) : (
                        <div className="p-3 text-sm text-slate-500 dark:text-slate-400 font-normal">Tidak ada pelanggan</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedCustomer && (
                  <button
                    onClick={() => {
                      setCustomerId(undefined);
                      setCustomerSearchQuery("");
                      setManualCustomerName("");
                      setManualCustomerPhone("");
                      setCustomerType("umum");
                    }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 underline"
                  >
                    Hapus pelanggan terpilih
                  </button>
                )}
              </div>
            </div>

            {/* Manual Customer Input */}
            <div className="px-4 lg:px-3 pb-4 lg:pb-3">
              <div className="flex flex-col gap-3 lg:gap-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Pelanggan</label>
                  <Input
                    value={manualCustomerName}
                    onChange={(e) => {
                      setManualCustomerName(e.target.value);
                      if (e.target.value.trim().length > 0 && customerType !== "member") {
                        setCustomerType("member");
                      }
                    }}
                    placeholder="Masukkan nama pelanggan"
                    className="h-10 lg:h-9"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nomor Telepon</label>
                  <Input
                    value={manualCustomerPhone}
                    onChange={(e) => setManualCustomerPhone(e.target.value)}
                    placeholder="Masukkan nomor telepon"
                    className="h-10 lg:h-9"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipe Pelanggan</label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Pilih tipe pelanggan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="umum">Umum</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>



            {/* Payment Method */}
            <div className="px-4 lg:px-3 pb-4 lg:pb-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Metode Pembayaran</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary dark:bg-primary-900/20 dark:border-primary-400 dark:text-primary-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"}`}
                  >
                    <Banknote className="w-4 h-4 lg:w-5 lg:h-5 mb-1" />
                    <span className="text-[10px] font-medium">Tunai</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("transfer")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "transfer" ? "border-primary bg-primary/5 text-primary dark:bg-primary-900/20 dark:border-primary-400 dark:text-primary-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"}`}
                  >
                    <CreditCard className="w-4 h-4 lg:w-5 lg:h-5 mb-1" />
                    <span className="text-[10px] font-medium">Transfer</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("debit_card")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "debit_card" ? "border-primary bg-primary/5 text-primary dark:bg-primary-900/20 dark:border-primary-400 dark:text-primary-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"}`}
                  >
                    <CreditCard className="w-4 h-4 lg:w-5 lg:h-5 mb-1" />
                    <span className="text-[10px] font-medium">Debit</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("qris")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${paymentMethod === "qris" ? "border-primary bg-primary/5 text-primary dark:bg-primary-900/20 dark:border-primary-400 dark:text-primary-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"}`}
                  >
                    <QrCode className="w-4 h-4 lg:w-5 lg:h-5 mb-1" />
                    <span className="text-[10px] font-medium">QRIS</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === "cash" && (
              <div className="px-4 lg:px-3 pb-4 lg:pb-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Uang Diterima</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium text-sm">Rp</span>
                      <Input
                        type="text"
                        value={amountPaidDisplay}
                        onChange={handleAmountPaidChange}
                        className="pl-9 h-10 rounded-md border font-bold text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Kembalian</label>
                    <div className={`h-10 rounded-md border flex items-center px-3 font-bold text-sm ${change >= 0 ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"}`}>
                      {formatRupiah(Math.max(0, change))}
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* Summary */}
            <div className="px-4 lg:px-3 pb-4 lg:pb-3">
              <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{formatRupiah(subtotal)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-medium text-slate-700 dark:text-slate-200">TOTAL</span>
                  <span className="text-xl font-bold text-primary dark:text-primary-400">{formatRupiah(total)}</span>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            <div className="px-4 lg:px-3 pb-12 lg:pb-3">
              <Button
                className="w-full h-12 text-base font-medium shadow-lg"
                size="lg"
                disabled={cart.length === 0 || createTransaction.isPending || (paymentMethod === "cash" && amountPaid < total)}
                onClick={handleCheckout}
              >
                {createTransaction.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Memproses...
                  </div>
                ) : (
                  "BAYAR SEKARANG"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md dark:bg-slate-800 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-center flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Transaksi Berhasil
            </DialogTitle>
            <DialogDescription className="text-center text-slate-600 dark:text-slate-400">
              Terima kasih atas pembelian Anda
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Content - Hidden Scrollbar */}
          <div className="flex-1 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 space-y-2 font-mono text-sm">
              {/* Header - Store Name Centered */}
              <div className="text-center mb-3">
                <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {localStorage.getItem('storeName') || 'SBAGIAMU'}
                </p>
                {(() => {
                  const address = localStorage.getItem('storeAddress');
                  return address && typeof address === 'string' && address.trim() ? (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {address}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Date/Time - Invoice Row */}
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                <div className="text-left">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {lastTransaction?.createdAt ? new Date(lastTransaction.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                    {lastTransaction?.createdAt ? new Date(lastTransaction.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium font-mono">
                    {lastTransaction?.id ? formatInvoiceNumber(lastTransaction.id) : "INV-"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{cashierName}</p>
                </div>
              </div>

              {/* Customer Info */}
              {lastTransaction?.customerName && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Pelanggan</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{lastTransaction.customerName}</span>
                </div>
              )}

              {lastTransaction?.items?.map((item: any, idx: number) => {
                const itemPrice = item.unitPrice - (item.uomDiscountAmount || 0);
                return (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-slate-100">{item.productName} {item.unitName !== 'pcs' ? `(${item.unitName})` : ''}</p>
                      <p className="text-slate-400 dark:text-slate-500">{item.quantity} x {formatRupiah(itemPrice)}</p>
                      {item.uomDiscountAmount && item.uomDiscountAmount > 0 && (
                        <p className="text-[10px] text-green-600 dark:text-green-400">
                          Diskon: -{formatRupiah(item.uomDiscountAmount * item.quantity)} {item.uomLabel ? `(${item.uomLabel})` : ''}
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{formatRupiah(item.quantity * itemPrice)}</p>
                  </div>
                );
              })}

              <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Metode</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{getPaymentMethodLabel(lastTransaction?.paymentMethod || '')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                  <span className="text-slate-700 dark:text-slate-300">{formatRupiah(lastTransaction?.subtotal || 0)}</span>
                </div>

                {lastTransaction?.enablePPN && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Pajak ({lastTransaction?.ppnPercentage || 11}%)</span>
                    <span className="text-slate-700 dark:text-slate-300">{formatRupiah(lastTransaction?.tax || 0)}</span>
                  </div>
                )}
                {(lastTransaction?.discount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-red-600 dark:text-red-400">
                    <span>Diskon {lastTransaction?.discountNote && `(${lastTransaction.discountNote})`}</span>
                    <span>-{formatRupiah(lastTransaction?.discount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2">
                  <span className="text-slate-700 dark:text-slate-200">TOTAL</span>
                  <span className="text-slate-900 dark:text-slate-100">{formatRupiah(lastTransaction?.total || 0)}</span>
                </div>
                {lastTransaction?.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-xs pt-2">
                      <span className="text-slate-500 dark:text-slate-400">Tunai</span>
                      <span className="text-slate-700 dark:text-slate-300">{formatRupiah(lastTransaction?.amountPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Kembali</span>
                      <span>{formatRupiah(lastTransaction?.change || 0)}</span>
                    </div>
                  </>
                )}
                {lastTransaction?.customerType === "member" && (
                  <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Status</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">Member</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="sm:justify-center gap-2">
              <Button
                onClick={() => handlePrintReceipt(lastTransaction, { showSuccessNotification: true })}
                disabled={isPrinting}
                variant="outline"
                className="w-full"
              >
                {isPrinting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Mencetak...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Print
                  </div>
                )}
              </Button>
              <Button
                onClick={() => setShowReceipt(false)}
                className="w-full"
              >
                Selesai
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* UOM Selector Dialog */}
      <Dialog open={!!uomSelectorProduct} onOpenChange={(open) => !open && setUomSelectorProduct(null)}>
        <DialogContent className="sm:max-w-xs sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Ruler className="w-4 h-4 text-indigo-500" />
              Pilih Satuan
            </DialogTitle>
            <DialogDescription className="text-xs">
              {uomSelectorProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {uomSelectorProduct && (() => {
              const uoms = [...(uomSelectorProduct.uoms || [])];
              if (!uoms.some(u => u.unit_name === 'pcs')) {
                uoms.unshift({
                  unit_name: 'pcs',
                  conversion_factor: 1,
                  price: null,
                  discount_type: 'none',
                  discount_value: 0
                });
              }
              
              return uoms.map((uom: any) => {
                const unitPrice = uom.price ? Number(uom.price) : uomSelectorProduct.price * uom.conversion_factor;
                
                let uomDiscountAmount = 0;
                if (uom.discount_type === 'amount') {
                  uomDiscountAmount = Number(uom.discount_value) || 0;
                } else if (uom.discount_type === 'percent') {
                  uomDiscountAmount = unitPrice * ((Number(uom.discount_value) || 0) / 100);
                }

                return (
                <button
                  key={uom.unit_name}
                  onClick={() => {
                    addToCart(uomSelectorProduct, uom);
                    setUomSelectorProduct(null);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold uppercase">
                      {uom.unit_name.slice(0, 3)}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 capitalize">{uom.unit_name}</div>
                      {uom.conversion_factor > 1 && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">1 {uom.unit_name} = {uom.conversion_factor} pcs</div>
                      )}
                      {uom.label && (
                        <div className="text-[10px] font-medium text-green-600 dark:text-green-400 mt-0.5">🏷️ {uom.label}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {uomDiscountAmount > 0 ? (
                      <>
                        <div className="font-bold text-sm text-primary group-hover:text-indigo-600">{formatRupiah(unitPrice - uomDiscountAmount)}</div>
                        <div className="text-[10px] text-slate-400 line-through">{formatRupiah(unitPrice)}</div>
                      </>
                    ) : (
                      <div className="font-bold text-sm text-primary group-hover:text-indigo-600">{formatRupiah(unitPrice)}</div>
                    )}
                  </div>
                </button>
              );
            });
          })()}
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}