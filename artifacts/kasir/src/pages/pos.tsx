import { useState, useMemo, useRef, useEffect } from "react";
import { useListProducts, useListCategories, useListCustomers, useCreateTransaction, getListProductsQueryKey, getListCustomersQueryKey, useListOutlets, generateNextCustomerId } from "@workspace/api-client-react";
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
import { Search, Plus, Minus, X, CreditCard, Banknote, QrCode, ShoppingCart, Package, Trash2, Tag, Printer, Bluetooth, Circle, Store, AlertTriangle, Ruler, Clock, CalendarRange, CheckCircle2, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  uomMinQty?: number;
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
    case 'debit_card': return 'E-wallet';
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
  const [manualAddress, setManualAddress] = useState<string>("");
  const [manualDistrict, setManualDistrict] = useState<string>("");
  const [manualCity, setManualCity] = useState<string>("");
  const [manualCustomerId, setManualCustomerId] = useState<string>("");

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

  const [paymentType, setPaymentType] = useState<"lunas" | "dp" | "tempo">("lunas");
  const [dueDate, setDueDate] = useState<string>("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // UOM selector state
  const [uomSelectorProduct, setUomSelectorProduct] = useState<any>(null);

  // QTY selector state
  const [qtySelector, setQtySelector] = useState<{ product: any, uom: any | null } | null>(null);
  const [qtyInput, setQtyInput] = useState<number>(1);

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

  const posProducts = useMemo(() => {
    return (products || [])
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
  }, [products, search, categoryId]);



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
        storeName: activeOutletObj?.store_name || activeOutletObj?.name || localStorage.getItem('bluetoothStoreName') || localStorage.getItem('storeName') || 'SBAGIAMU',
        storeAddress: activeOutletObj?.address || localStorage.getItem('storeAddress') || '',
        storePhone: activeOutletObj?.phone || localStorage.getItem('storePhone') || '',
        footerMessage: showFooter ? (activeOutletObj?.footer_message || localStorage.getItem('footerMessage') || '') : '',
        footerMessage2: showFooter ? (activeOutletObj?.footer_message2 || localStorage.getItem('footerMessage2') || '') : '',
        footerMessage3: showFooter ? (activeOutletObj?.footer_message3 || localStorage.getItem('footerMessage3') || '') : '',
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



  const addToCart = (product: any, selectedUnit?: { unit_name: string; conversion_factor: number; price?: number; discount_type?: string; discount_value?: number; label?: string; min_qty?: number }, qtyToAdd: number = 1) => {
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

    if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
      const conversionFactor = selectedUnit ? (selectedUnit.conversion_factor || 1) : 1;
      const totalPcsInCart = cart.reduce((acc, item) => {
        if (item.productId === product.id) {
          return acc + (item.quantity * item.conversionFactor);
        }
        return acc;
      }, 0);

      if (totalPcsInCart + (conversionFactor * qtyToAdd) > product.stock_quantity) {
        toast({ title: "Stok Tidak Cukup", description: `Sisa stok: ${Math.floor(product.stock_quantity - totalPcsInCart)} pcs`, variant: "destructive" });
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
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: qtyToAdd,
        imageUrl: imageUrl,
        unitName,
        conversionFactor,
        unitPrice,
        uomDiscountType: selectedUnit?.discount_type || 'none',
        uomDiscountAmount,
        uomMinQty: selectedUnit?.min_qty || 1,
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
      // Product only has pcs - open qty selector
      setQtyInput(1);
      setQtySelector({ product, uom: null });
    }
  };

  const updateQuantity = (productId: number, delta: number, unitName: string = 'pcs') => {
    if (delta > 0) {
      const product = posProducts.find((p: any) => p.id === productId);
      const item = cart.find(i => i.productId === productId && i.unitName === unitName);
      const convFactor = item?.conversionFactor || 1;

      if (product && product.stock_quantity !== undefined && product.stock_quantity !== null) {
        const totalPcsInCart = cart.reduce((acc, cartItem) => {
          if (cartItem.productId === product.id && !(cartItem.unitName === item?.unitName)) {
            return acc + (cartItem.quantity * cartItem.conversionFactor);
          }
          return acc;
        }, 0);

        if (totalPcsInCart + convFactor > product.stock_quantity) {
          toast({ title: "Stok Tidak Cukup", description: `Sisa stok: ${Math.floor(product.stock_quantity - totalPcsInCart)} pcs`, variant: "destructive" });
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
  const createNewCustomer = async (name: string, phone: string, alamat: string, kecamatan: string, kabupaten: string) => {
    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();

      if (!trimmedName) {
        toast({ title: "Error", description: "Nama pelanggan wajib diisi", variant: "destructive" });
        return null;
      }

      // Generate ID Pelanggan otomatis dengan format CTM-00001
      const autoGeneratedId = await generateNextCustomerId();

      // Gunakan outlet dari staff (settingan tugas)
      let outletIdToSave: number | null = user?.outletId && user.outletId !== "all" ? parseInt(user.outletId) : null;

      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: trimmedName,
          phone: trimmedPhone || null,
          total_spent: 0,
          sales_name: cashierName,
          customer_id_manual: autoGeneratedId,
          address: alamat.trim() || null,
          district: kecamatan.trim() || null,
          city: kabupaten.trim() || null,
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

  const getCartItemPriceAndDiscount = (item: CartItem) => {
    const product = posProducts.find(p => p.id === item.productId);
    if (!product) {
      const activeDiscount = item.quantity >= (item.uomMinQty || 1) ? (item.uomDiscountAmount || 0) : 0;
      return { price: item.unitPrice, discount: activeDiscount, label: item.uomLabel };
    }

    const uoms = product.uoms || [];

    // Jika satuan adalah 'pcs', lakukan alokasi greedy ke UOM yang lebih besar (box/pack) yang memenuhi syarat diskon
    if (item.unitName.toLowerCase() === 'pcs') {
      const sortedUoms = [...uoms]
        .filter((u: any) => u.conversion_factor > 1)
        .sort((a, b) => {
          if (b.conversion_factor !== a.conversion_factor) {
            return b.conversion_factor - a.conversion_factor;
          }
          return (b.min_qty || 1) - (a.min_qty || 1);
        });

      let remainingPcs = item.quantity;
      let totalPrice = 0;
      let totalDiscount = 0;
      let matchedLabel = '';

      for (const u of sortedUoms) {
        const numUnits = Math.floor(remainingPcs / u.conversion_factor);
        if (numUnits >= (u.min_qty || 1)) {
          const uomBasePrice = u.price ? Number(u.price) : product.price * u.conversion_factor;
          const uomTotalBasePrice = uomBasePrice * numUnits;

          let uomTotalDiscount = 0;
          if (u.discount_type === 'amount') {
            const discountPerUomUnit = (Number(u.discount_value) || 0) / (u.min_qty || 1);
            uomTotalDiscount = discountPerUomUnit * numUnits;
          } else if (u.discount_type === 'percent') {
            uomTotalDiscount = uomBasePrice * ((Number(u.discount_value) || 0) / 100) * numUnits;
          }

          if (u.label && !matchedLabel) {
            matchedLabel = u.label;
          }

          totalPrice += uomTotalBasePrice;
          totalDiscount += uomTotalDiscount;
          remainingPcs -= numUnits * u.conversion_factor;
        }
      }

      if (remainingPcs > 0) {
        const pcsUom = uoms.find((u: any) => u.unit_name.toLowerCase() === 'pcs');
        if (pcsUom) {
          const pcsBasePrice = pcsUom.price ? Number(pcsUom.price) : product.price;
          totalPrice += pcsBasePrice * remainingPcs;

          if (remainingPcs >= (pcsUom.min_qty || 1)) {
            let pcsDiscount = 0;
            if (pcsUom.discount_type === 'amount') {
              const discountPerPcs = (Number(pcsUom.discount_value) || 0) / (pcsUom.min_qty || 1);
              pcsDiscount = discountPerPcs * remainingPcs;
            } else if (pcsUom.discount_type === 'percent') {
              pcsDiscount = pcsBasePrice * ((Number(pcsUom.discount_value) || 0) / 100) * remainingPcs;
            }
            totalDiscount += pcsDiscount;
            if (pcsUom.label && !matchedLabel) {
              matchedLabel = pcsUom.label;
            }
          }
        } else {
          totalPrice += product.price * remainingPcs;
        }
      }

      const avgPrice = totalPrice / item.quantity;
      const avgDiscount = totalDiscount / item.quantity;

      return { price: avgPrice, discount: avgDiscount, label: matchedLabel };
    }

    const matchingUoms = uoms.filter((u: any) => u.unit_name.toLowerCase() === item.unitName.toLowerCase());

    if (matchingUoms.length === 0) {
      const activeDiscount = item.quantity >= (item.uomMinQty || 1) ? (item.uomDiscountAmount || 0) : 0;
      return { price: item.unitPrice, discount: activeDiscount, label: item.uomLabel };
    }

    const eligibleUoms = matchingUoms.filter((u: any) => item.quantity >= (u.min_qty || 1));
    const activeUom = eligibleUoms.length > 0
      ? eligibleUoms.reduce((max: any, u: any) => (u.min_qty || 1) > (max.min_qty || 1) ? u : max, eligibleUoms[0])
      : matchingUoms.reduce((min: any, u: any) => (u.min_qty || 1) < (min.min_qty || 1) ? u : min, matchingUoms[0]);

    const basePrice = activeUom.price ? Number(activeUom.price) : product.price * activeUom.conversion_factor;
    let discountAmountPerUnit = 0;
    if (item.quantity >= (activeUom.min_qty || 1)) {
      if (activeUom.discount_type === 'amount') {
        const totalDiscount = (Number(activeUom.discount_value) || 0) * Math.floor(item.quantity / (activeUom.min_qty || 1));
        discountAmountPerUnit = totalDiscount / item.quantity;
      } else if (activeUom.discount_type === 'percent') {
        discountAmountPerUnit = basePrice * ((Number(activeUom.discount_value) || 0) / 100);
      }
    }

    return { price: basePrice, discount: discountAmountPerUnit, label: activeUom.label || '' };
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => {
    const { price, discount } = getCartItemPriceAndDiscount(item);
    return sum + ((price - discount) * item.quantity);
  }, 0), [cart, posProducts]);

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



    if (paymentType === "dp" && amountPaid >= total) {
      toast({ title: "Error", description: "Nominal cicilan harus kurang dari total tagihan", variant: "destructive" });
      return;
    }

    if (paymentType === "dp" && amountPaid <= 0) {
      toast({ title: "Error", description: "Nominal cicilan tidak boleh kosong", variant: "destructive" });
      return;
    }

    if (paymentType !== "lunas" && !dueDate) {
      toast({ title: "Error", description: "Tanggal jatuh tempo wajib diisi untuk transaksi Cicilan / Tempo", variant: "destructive" });
      return;
    }

    if (paymentType !== "lunas" && !customerId && !manualCustomerName.trim()) {
      toast({ title: "Error", description: "Pelanggan wajib dipilih atau diisi untuk transaksi hutang (Cicilan/Tempo)", variant: "destructive" });
      return;
    }

    // Create pelanggan baru dari input manual agar langsung masuk ke data pelanggan
    let finalCustomerId = customerId;
    const manualName = manualCustomerName.trim();
    const manualPhone = manualCustomerPhone.trim();
    if (!customerId && manualName) {
      const newCustomer = await createNewCustomer(manualName, manualPhone, manualAddress, manualDistrict, manualCity);
      if (newCustomer) {
        finalCustomerId = newCustomer.id;
        toast({ title: "Sukses", description: `Pelanggan baru "${newCustomer.name}" berhasil dibuat`, variant: "default" });
      } else {
        toast({ title: "Error", description: "Gagal membuat pelanggan baru, lanjutkan transaksi tanpa simpan customer", variant: "destructive" });
      }
    }

    const receiptCustomerName = selectedCustomer?.name || manualCustomerName || "Umum";

    let finalAmountPaid = total;
    let finalRemaining = 0;
    let paymentStatus = "paid";

    if (paymentType === "tempo") {
      finalAmountPaid = 0;
      finalRemaining = total;
      paymentStatus = "unpaid";
    } else if (paymentType === "dp") {
      finalAmountPaid = amountPaid;
      finalRemaining = total - amountPaid;
      paymentStatus = "partial";
    }

    createTransaction.mutate({
      data: {
        customerId: finalCustomerId,
        cashierName,
        paymentMethod: paymentMethod as any,
        discount,
        discountNote: discountNote,
        amountPaid: finalAmountPaid,
        remainingBalance: finalRemaining,
        paymentStatus: paymentStatus,
        dueDate: paymentType !== "lunas" ? new Date(dueDate).toISOString() : undefined,
        subtotal: subtotal,
        tax: tax,
        change: paymentType === "lunas" ? change : 0,
        customerName: receiptCustomerName !== "Umum" ? receiptCustomerName : undefined,
        customerPhone: selectedCustomer?.phone || manualCustomerPhone || undefined,
        pointsRedeemed: 0,
        pointsDiscount: 0,
        earnedPoints: 0,
        items: cart.map(item => {
          const { price, discount } = getCartItemPriceAndDiscount(item);
          return {
            product_id: item.productId,
            productName: item.productName,
            quantity: item.quantity * item.conversionFactor,
            price: (price - discount) / item.conversionFactor,
            cost_price: 0,
            total: (price - discount) * item.quantity,
            unitName: item.unitName,
            unitQty: item.quantity,
            conversionFactor: item.conversionFactor
          };
        })
      }
    }, {
      onSuccess: async (res: any) => {
        // Update customer data langsung (total_spent)
        if (finalCustomerId && total > 0) {
          await updateCustomerData(finalCustomerId, total);
          await refetchCustomers?.();
        }

        const mappedItems = cart.map(item => {
          const { price, discount, label } = getCartItemPriceAndDiscount(item);
          return {
            ...item,
            unitPrice: price,
            uomDiscountAmount: discount,
            uomMinQty: 1,
            uomLabel: label
          };
        });

        setLastTransaction({
          ...res,
          cashierName,
          cashier_name: cashierName,
          items: mappedItems,
          subtotal,
          tax,
          discount,
          discountNote,
          total,
          amountPaid: finalAmountPaid,
          change,
          paymentMethod,
          payment_status: paymentStatus,
          remaining_balance: finalRemaining,
          enablePPN,
          ppnPercentage,
          customerName: receiptCustomerName,
          customerPhone: selectedCustomer?.phone || manualCustomerPhone,
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
            items: mappedItems,
            subtotal,
            tax,
            discount,
            discountNote,
            total,
            amountPaid: finalAmountPaid,
            change,
            paymentMethod,
            payment_status: paymentStatus,
            remaining_balance: finalRemaining,
            enablePPN,
            ppnPercentage,
            customerName: receiptCustomerName,
            customerPhone: selectedCustomer?.phone || manualCustomerPhone,
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
        setManualCustomerPhone("");
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
                            {isAdmin && (
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

                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-xs lg:text-sm leading-snug text-slate-800 dark:text-slate-200 break-words line-clamp-2">
                          <span className="text-primary">{item.quantity} {item.unitName}</span> {item.productName}
                        </p>
                        <div className="flex flex-col mt-1">
                          {(() => {
                            const { price, discount, label } = getCartItemPriceAndDiscount(item);
                            const finalPrice = price - discount;
                            const totalItemPrice = finalPrice * item.quantity;

                            return (
                              <>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  @ {formatRupiah(finalPrice)} {discount > 0 ? <span className="line-through opacity-70 ml-1">{formatRupiah(price)}</span> : null}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <p className="font-bold text-[13px] lg:text-sm text-emerald-600 dark:text-emerald-400">
                                    {formatRupiah(totalItemPrice)}
                                  </p>
                                  {label && (
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px] px-1.5 py-0 h-4 font-semibold border-0 whitespace-nowrap">
                                      🏷️ {label}
                                    </Badge>
                                  )}
                                </div>
                              </>
                            );
                          })()}
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
                <label className="text-xs font-normal text-primary uppercase tracking-wider">CARI PELANGGAN</label>
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
                                setManualAddress(c.address || "");
                                setManualDistrict(c.district || "");
                                setManualCity(c.city || "");
                                setManualCustomerId(c.customer_id_manual || "");
                                setManualCustomerId(c.customer_id_manual || "");
                                setCustomerSearchQuery("");
                                setShowCustomerDropdown(false);
                              }}
                              className="flex items-center gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                            >
                              <span className="flex-1 truncate text-slate-900 dark:text-slate-100">{formatCustomerLabel(c)}</span>
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
                      setManualAddress("");
                      setManualDistrict("");
                      setManualCity("");
                      setManualCustomerId("");
                      setManualCustomerId("");
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
                      setManualCustomerName(e.target.value);
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
                  <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alamat Lengkap</label>
                  <Input
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="Masukkan alamat"
                    className="h-10 lg:h-9"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 lg:gap-2">
                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kecamatan</label>
                    <Input
                      value={manualDistrict}
                      onChange={(e) => setManualDistrict(e.target.value)}
                      placeholder="Kecamatan"
                      className="h-10 lg:h-9"
                    />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kabupaten</label>
                    <Input
                      value={manualCity}
                      onChange={(e) => setManualCity(e.target.value)}
                      placeholder="Kabupaten"
                      className="h-10 lg:h-9"
                    />
                  </div>
                </div>
              </div>
            </div>



            {/* Tipe Pembayaran */}
            <div className="px-4 lg:px-3 pb-4 lg:pb-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipe Pembayaran</label>
                <Select
                  value={paymentType}
                  onValueChange={(val: "lunas" | "dp" | "tempo") => {
                    setPaymentType(val);
                    if (val === "lunas") {
                      setDueDate("");
                    } else if (val === "tempo") {
                      setAmountPaidStr("0");
                      setAmountPaidDisplay("0");
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <SelectValue placeholder="Pilih Tipe Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunas">Lunas</SelectItem>
                    <SelectItem value="dp">Cicilan</SelectItem>
                    <SelectItem value="tempo">Tempo Penuh</SelectItem>
                  </SelectContent>
                </Select>
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
                    <Wallet className="w-4 h-4 lg:w-5 lg:h-5 mb-1" />
                    <span className="text-[10px] font-medium">E-wallet</span>
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

            {/* Cash Input / DP Input */}
            {paymentType === "dp" && (
              <div className="px-4 lg:px-3 pb-4 lg:pb-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      Nominal Cicilan
                    </label>
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
                    <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Sisa Hutang</label>
                    <div className={`h-10 rounded-md border flex items-center px-3 font-bold text-sm bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400`}>
                      {formatRupiah(Math.max(0, total - amountPaid))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Jatuh Tempo Date Input */}
            {paymentType !== "lunas" && (
              <div className="px-4 lg:px-3 pb-4 lg:pb-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tanggal Jatuh Tempo</label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-between text-left font-medium h-10 px-3 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 ${!dueDate ? "text-slate-400" : "text-slate-900 dark:text-slate-100"
                          }`}
                      >
                        {dueDate ? (
                          new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                        ) : (
                          <span>Pilih Tanggal</span>
                        )}
                        <CalendarRange className="w-4 h-4 text-slate-400" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate ? new Date(dueDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setDueDate(`${year}-${month}-${day}`);
                          } else {
                            setDueDate("");
                          }
                          setIsCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                disabled={
                  cart.length === 0 ||
                  createTransaction.isPending ||
                  (paymentType === "dp" && (amountPaid <= 0 || amountPaid >= total))
                }
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
                  {localStorage.getItem('bluetoothStoreName') || localStorage.getItem('storeName') || 'SBAGIAMU'}
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
                const activeDiscount = item.quantity >= (item.uomMinQty || 1) ? (item.uomDiscountAmount || 0) : 0;
                const itemPrice = item.unitPrice - activeDiscount;
                return (
                  <div key={idx} className="mb-2 break-inside-avoid">
                    <div className="font-bold">{item.productName}</div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div>{item.quantity} {item.unitName} x {formatRupiah(item.unitPrice)}</div>
                        {activeDiscount > 0 && (
                          <div className="text-[10px] text-slate-600 mt-0.5 italic">
                            Diskon: -{formatRupiah(activeDiscount * item.quantity)} {item.uomLabel ? `(${item.uomLabel})` : ''}
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{formatRupiah(item.quantity * itemPrice)}</p>
                    </div>
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
                {lastTransaction?.payment_status === 'partial' ? (
                  <>
                    <div className="flex justify-between text-xs pt-2">
                      <span className="text-slate-500 dark:text-slate-400">Cicilan ({getPaymentMethodLabel(lastTransaction?.paymentMethod || '')})</span>
                      <span className="text-slate-700 dark:text-slate-300">{formatRupiah(lastTransaction?.amountPaid || lastTransaction?.amount_paid || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span>Sisa Hutang</span>
                      <span>{formatRupiah(lastTransaction?.remaining_balance || 0)}</span>
                    </div>
                  </>
                ) : lastTransaction?.payment_status === 'unpaid' ? (
                  <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400 pt-2">
                    <span>Sisa Hutang</span>
                    <span>{formatRupiah(lastTransaction?.remaining_balance || 0)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs pt-2">
                    <span className="text-slate-500 dark:text-slate-400">Metode Pembayaran</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{getPaymentMethodLabel(lastTransaction?.paymentMethod || '')}</span>
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
          <DialogHeader className="flex flex-col items-center justify-center text-center sm:text-center">
            <DialogTitle className="text-base font-bold">
              Pilih Satuan
            </DialogTitle>
            <DialogDescription className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
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

              return uoms.map((uom: any, idx: number) => {
                const unitPrice = uom.price ? Number(uom.price) : uomSelectorProduct.price * uom.conversion_factor;
                const minQty = uom.min_qty || 1;
                
                const totalBeforeDiscount = unitPrice * minQty;
                let totalDiscount = 0;
                
                if (uom.discount_type === 'amount') {
                  totalDiscount = Number(uom.discount_value) || 0;
                } else if (uom.discount_type === 'percent') {
                  totalDiscount = totalBeforeDiscount * ((Number(uom.discount_value) || 0) / 100);
                }
                
                const totalAfterDiscount = Math.max(0, totalBeforeDiscount - totalDiscount);

                return (
                  <button
                    key={`${uom.unit_name}_${idx}`}
                    onClick={() => {
                      setQtyInput(minQty);
                      setQtySelector({ product: uomSelectorProduct, uom });
                      setUomSelectorProduct(null);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-bold uppercase">
                        {uom.unit_name.slice(0, 3)}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          {minQty} <span className="capitalize">{uom.unit_name}</span>
                        </div>
                        {uom.conversion_factor > 1 && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">1 {uom.unit_name} = {uom.conversion_factor} pcs</div>
                        )}
                        {uom.label && (
                          <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">🏷️ {uom.label}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      {totalDiscount > 0 ? (
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 line-through mb-0.5">{formatRupiah(totalBeforeDiscount)}</div>
                          <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700">{formatRupiah(totalAfterDiscount)}</div>
                        </div>
                      ) : (
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{formatRupiah(totalBeforeDiscount)}</div>
                      )}
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* QTY Selector Dialog */}
      <Dialog open={!!qtySelector} onOpenChange={(open) => !open && setQtySelector(null)}>
        <DialogContent className="sm:max-w-xs sm:rounded-2xl">
          <DialogHeader className="flex flex-col items-center justify-center text-center sm:text-center">
            <DialogTitle className="text-base font-bold">
              Masukkan Jumlah
            </DialogTitle>
            <DialogDescription className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {qtySelector?.product?.name} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({qtySelector?.uom?.unit_name || 'pcs'})</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQtyInput(prev => Math.max(1, prev - 1))}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                className="w-24 text-center font-bold text-lg"
                value={qtyInput}
                onChange={(e) => setQtyInput(parseInt(e.target.value) || 1)}
                min={1}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQtyInput(prev => prev + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick amount buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map(amount => (
                <Button
                  key={amount}
                  variant="secondary"
                  size="sm"
                  onClick={() => setQtyInput(amount)}
                  className="text-xs"
                >
                  {amount}
                </Button>
              ))}
            </div>

            <Button
              className="w-full mt-2"
              onClick={() => {
                if (qtySelector) {
                  addToCart(qtySelector.product, qtySelector.uom, qtyInput);
                  setQtySelector(null);
                }
              }}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Tambah
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}