import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Store, Printer, Bell, Type, Percent, Bluetooth, CheckCircle, XCircle, Loader2, Search, Tag, Plus, Trash2, Palette, Building2, ChevronDown, Info, ExternalLink, User, LogOut } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { connectToPrinter, disconnectPrinter, listBluetoothDevices, isBluetoothAvailable } from "@/lib/bluetooth-printer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL, isAdminMode } from "@/lib/auth";
import { useListOutlets } from "@workspace/api-client-react";
import { ProfileContent } from "@/components/layout/ProfileContent";
import { canOpenAndroidAppSettings, openAndroidAppSettings } from "@/lib/android-app-settings";
import { open as openShell } from "@tauri-apps/plugin-shell";

// Collapsible Card Component - Accordion Style
function CollapsibleCard({
  id,
  title,
  icon: Icon,
  description,
  children,
  isOpen,
  onToggle
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen]);

  return (
    <Card className="overflow-hidden w-full rounded-xl shadow-sm border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full text-left"
      >
        <div className={`py-5 px-5 cursor-pointer transition-colors flex flex-row items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50`}>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${isOpen ? 'bg-primary/20 text-primary dark:bg-primary/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{title}</h3>
              {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
              )}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 shrink-0 ${isOpen ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </button>
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isOpen ? (contentHeight ? contentHeight + 48 : 'none') : '0px',
          opacity: isOpen ? 1 : 0
        }}
      >
        <div ref={contentRef} className="px-5 pb-6">
          <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const isAdminSuper = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isAdminMode(user);
  const { data: outlets } = useListOutlets();
  const assignedOutletName = outlets?.find(o => o.id.toString() === user?.outletId)?.name || 'Semua Outlet';
  const isOutletAssigned = false;

  // Accordion state - only one card open at a time
  const [openCard, setOpenCard] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab");
    }
    return null;
  });
  const toggleCard = useCallback((cardId: string) => {
    setOpenCard(prev => prev === cardId ? null : cardId);
  }, []);

  // Font Size - Default: small
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'medium');

  // Store Settings
  const [storeName, setStoreName] = useState(() => localStorage.getItem('storeName') || 'CV.AULIA USAHA');
  const [storeAddress, setStoreAddress] = useState(() => localStorage.getItem('storeAddress') || 'Jl. Condongcatur No.123 Yk');
  const [storePhone, setStorePhone] = useState(() => localStorage.getItem('storePhone') || '');
  const [storeBankName, setStoreBankName] = useState(() => localStorage.getItem('storeBankName') || 'BCA');
  const [storeBankAccount, setStoreBankAccount] = useState(() => localStorage.getItem('storeBankAccount') || '4451377137');
  const [storeBankAccountName, setStoreBankAccountName] = useState(() => localStorage.getItem('storeBankAccountName') || 'AULIA USAHA');
  const [bluetoothStoreName, setBluetoothStoreName] = useState(() => localStorage.getItem('bluetoothStoreName') || 'CV.AULIA USAHA');
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('autoPrint') !== 'false');
  const [showFooter, setShowFooter] = useState(() => localStorage.getItem('showFooter') !== 'false');
  const [footerMessage, setFooterMessage] = useState(() => localStorage.getItem('footerMessage') || '');
  const [footerMessage2, setFooterMessage2] = useState(() => localStorage.getItem('footerMessage2') || '');
  const [footerMessage3, setFooterMessage3] = useState(() => localStorage.getItem('footerMessage3') || '');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [notifyTransactionSuccess, setNotifyTransactionSuccess] = useState(
    () => localStorage.getItem('notifyTransactionSuccess') !== 'false'
  );
  const [notifyPrint, setNotifyPrint] = useState(
    () => localStorage.getItem('notifyPrint') !== 'false'
  );

  const isFirstLoad = useRef(true);
  const isSyncingFromEvent = useRef(false);

  // Listen for sync events from Sidebar
  useEffect(() => {
    const handleStoreChange = () => {
      isSyncingFromEvent.current = true;
      setStoreName(localStorage.getItem('storeName') || 'CV.AULIA USAHA');
      setStoreAddress(localStorage.getItem('storeAddress') || '');
      setStorePhone(localStorage.getItem('storePhone') || '');
      setStoreBankName(localStorage.getItem('storeBankName') || 'BCA');
      setStoreBankAccount(localStorage.getItem('storeBankAccount') || '4451377137');
      setStoreBankAccountName(localStorage.getItem('storeBankAccountName') || 'AULIA USAHA');
      setBluetoothStoreName(localStorage.getItem('bluetoothStoreName') || 'CV.AULIA USAHA');
      setTimeout(() => {
        isSyncingFromEvent.current = false;
      }, 100);
    };
    window.addEventListener('storeNameChanged', handleStoreChange);
    return () => window.removeEventListener('storeNameChanged', handleStoreChange);
  }, []);

  // Debounced auto-save store settings to Supabase
  useEffect(() => {
    if (!isAdmin) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (isSyncingFromEvent.current) {
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        let targetOutletId = 1;
        if (user?.outletId && user.outletId !== 'all') {
          targetOutletId = parseInt(user.outletId);
        } else if (outlets && outlets.length > 0) {
          targetOutletId = outlets[0].id;
        }

        const { error } = await supabase
          .from('outlets')
          .update({
            name: storeName,
            store_name: storeName,
            address: storeAddress,
            phone: storePhone,
            bank_name: storeBankName,
            bank_account: storeBankAccount,
            bank_account_name: storeBankAccountName,
            bluetooth_store_name: bluetoothStoreName
          })
          .eq('id', targetOutletId);

        if (error) throw error;

        // Dispatch events so other local components know it changed
        window.dispatchEvent(new Event('storeNameChanged'));
        window.dispatchEvent(new Event('storeSettingsChanged'));
      } catch (err) {
        console.error("Auto-save to Supabase failed:", err);
      }
    }, 1500); // 1.5 seconds debounce

    return () => clearTimeout(delayDebounceFn);
  }, [storeName, storeAddress, storePhone, storeBankName, storeBankAccount, storeBankAccountName, bluetoothStoreName, isAdmin, user?.outletId, outlets]);

  // Primary Color (HSL) - Default: hsl(200, 100%, 22%) - Blue
  const [primaryHue, setPrimaryHue] = useState(() => parseInt(localStorage.getItem('primaryHue') || '200'));
  const [primarySaturation, setPrimarySaturation] = useState(() => parseInt(localStorage.getItem('primarySaturation') || '100'));
  const [primaryLightness, setPrimaryLightness] = useState(() => parseInt(localStorage.getItem('primaryLightness') || '22'));

  // Printer
  const [bluetoothPrinterMac, setBluetoothPrinterMac] = useState(() => localStorage.getItem('bluetoothPrinterMac') || '');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ name: string; address: string }>>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);

  // Auto-save: Font Size - apply to root element
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    const fontSizes: Record<string, string> = {
      small: '11px',
      medium: '14px',
      large: '17px'
    };
    document.documentElement.style.fontSize = fontSizes[fontSize] || '12px';
  }, [fontSize]);

  // Auto-save: Store Settings
  useEffect(() => {
    localStorage.setItem('storeName', storeName);
    localStorage.setItem('storeAddress', storeAddress);
    localStorage.setItem('storePhone', storePhone);
    localStorage.setItem('storeBankName', storeBankName);
    localStorage.setItem('storeBankAccount', storeBankAccount);
    localStorage.setItem('storeBankAccountName', storeBankAccountName);
    localStorage.setItem('bluetoothStoreName', bluetoothStoreName);
    localStorage.setItem('autoPrint', autoPrint.toString());
    localStorage.setItem('showFooter', showFooter.toString());
    localStorage.setItem('footerMessage', footerMessage);
    localStorage.setItem('footerMessage2', footerMessage2);
    localStorage.setItem('footerMessage3', footerMessage3);
    localStorage.setItem('darkMode', darkMode.toString());
    localStorage.setItem('notifyTransactionSuccess', notifyTransactionSuccess.toString());
    localStorage.setItem('notifyPrint', notifyPrint.toString());
    localStorage.setItem('bluetoothPrinterMac', bluetoothPrinterMac);

    // Apply dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [storeName, storeAddress, storePhone, storeBankName, storeBankAccount, storeBankAccountName, bluetoothStoreName, autoPrint, showFooter, footerMessage, footerMessage2, footerMessage3, darkMode, notifyTransactionSuccess, notifyPrint, bluetoothPrinterMac]);

  // Auto-save: Primary Color (HSL)
  useEffect(() => {
    localStorage.setItem('primaryHue', primaryHue.toString());
    localStorage.setItem('primarySaturation', primarySaturation.toString());
    localStorage.setItem('primaryLightness', primaryLightness.toString());

    // Apply custom primary color to CSS variables
    const root = document.documentElement;

    // Main primary color
    root.style.setProperty('--primary', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
    root.style.setProperty('--accent', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
    root.style.setProperty('--ring', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
    root.style.setProperty('--sidebar-primary', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
    root.style.setProperty('--sidebar-ring', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
    root.style.setProperty('--chart-1', `${primaryHue} ${primarySaturation}% ${primaryLightness}%`);
    root.style.setProperty('--chart-5', `${primaryHue} ${Math.min(primarySaturation + 10, 100)}% ${Math.max(primaryLightness - 10, 30)}%`);

    // Sidebar background - darker version of primary
    root.style.setProperty('--sidebar', `${primaryHue} ${Math.max(primarySaturation - 40, 20)}% ${Math.max(primaryLightness - 70, 5)}%`);
    root.style.setProperty('--sidebar-accent', `${primaryHue} ${Math.max(primarySaturation - 30, 20)}% ${Math.max(primaryLightness - 60, 10)}%`);

    // For dark mode sidebar
    root.style.setProperty('--sidebar-border', `${primaryHue} ${Math.max(primarySaturation - 50, 10)}% ${Math.max(primaryLightness - 60, 8)}%`);
  }, [primaryHue, primarySaturation, primaryLightness]);
  const handleTestConnection = async () => {
    if (!bluetoothPrinterMac?.trim()) {
      setConnectionStatus('disconnected');
      setConnectionMessage('Belum ada printer yang dipilih. Pindai dan pilih printer terlebih dahulu.');
      toast({
        title: "Printer belum dipilih",
        description: "Pindai perangkat Bluetooth lalu pilih printer sebelum tes koneksi.",
        variant: "destructive",
      });
      return;
    }

    if (!isBluetoothAvailable()) {
      setConnectionStatus('disconnected');
      setConnectionMessage('Bluetooth tidak tersedia di perangkat ini.');
      toast({
        title: "Bluetooth tidak tersedia",
        description: "Fitur ini hanya tersedia di aplikasi Android atau Desktop.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      const result = await connectToPrinter(bluetoothPrinterMac);

      if (result.success) {
        setConnectionStatus('connected');
        setConnectionMessage(result.message || 'Printer terhubung dengan baik.');
        toast({ title: "Sukses", description: result.message || "Printer terhubung" });
        setTimeout(() => {
          disconnectPrinter();
        }, 2000);
      } else {
        setConnectionStatus('disconnected');
        setConnectionMessage(result.message);
        toast({
          title: "Gagal tes koneksi",
          description: result.message,
          variant: "destructive",
        });
        await disconnectPrinter();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menguji koneksi printer.';
      setConnectionStatus('disconnected');
      setConnectionMessage(message);
      toast({
        title: "Gagal tes koneksi",
        description: message,
        variant: "destructive",
      });
      await disconnectPrinter();
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSelectBluetoothDevice = (address: string, name: string) => {
    setBluetoothPrinterMac(address);
    setShowDeviceList(false);
    toast({ title: "Sukses", description: `Printer dipilih: ${name}` });
  };

  const handleScanDevices = async () => {
    setIsScanning(true);
    try {
      const response = await listBluetoothDevices();
      const devices = Array.isArray(response) ? response : response.devices || [];
      setBluetoothDevices(devices);
      setShowDeviceList(true);
      toast({ title: "Sukses", description: `${devices.length} perangkat ditemukan` });
    } catch {
      toast({ title: "Error", description: "Gagal memindai perangkat", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenAppPermissions = async () => {
    try {
      const opened = await openAndroidAppSettings();
      if (!opened) {
        toast({
          title: "Hanya tersedia di Android",
          description: "Buka Pengaturan > Aplikasi > CV.AULIA USAHA > Izin secara manual.",
        });
      }
    } catch (error) {
      toast({
        title: "Gagal membuka pengaturan",
        description: error instanceof Error ? error.message : "Coba buka manual dari pengaturan perangkat.",
        variant: "destructive",
      });
    }
  };



  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Settings className="w-6 h-6 text-primary animate-pulse" />
            <span>Pengaturan</span>
          </h1>
        </div>

        <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Profile Settings */}
            <CollapsibleCard id="profile" title="Profil Pengguna" icon={User} description="Informasi profil dan foto Anda" isOpen={openCard === 'profile'} onToggle={toggleCard}>
              <ProfileContent />
            </CollapsibleCard>

            {/* Store Settings */}
            <CollapsibleCard id="store" title="Informasi Perusahaan" icon={Building2} description="Konfigurasi informasi dasar perusahaan" isOpen={openCard === 'store'} onToggle={toggleCard}>
              {isOutletAssigned && (
                <div className="mb-4 text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <div className="shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                  </div>
                  <p>Informasi perusahaan diatur otomatis oleh Admin berdasarkan data Outlet Anda. Hubungi Admin jika ada perubahan.</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName" className="text-sm font-medium">Nama Perusahaan</Label>
                  <Input
                    id="storeName"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Masukkan nama perusahaan"
                    className="h-10"
                    disabled={isOutletAssigned || !isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storePhone" className="text-sm font-medium">Nomor Telepon</Label>
                  <Input
                    id="storePhone"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    placeholder="Masukkan nomor telepon"
                    className="h-10"
                    disabled={isOutletAssigned || !isAdmin}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="storeAddress" className="text-sm font-medium">Alamat Perusahaan</Label>
                <Input
                  id="storeAddress"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Masukkan alamat perusahaan"
                  className="h-10"
                  disabled={isOutletAssigned || !isAdmin}
                />
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storeBankName" className="text-sm font-medium">Nama Bank</Label>
                  <Input
                    id="storeBankName"
                    value={storeBankName}
                    onChange={(e) => setStoreBankName(e.target.value)}
                    placeholder="Contoh: BCA, Mandiri"
                    className="h-10"
                    disabled={isOutletAssigned || !isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeBankAccount" className="text-sm font-medium">Nomor Rekening</Label>
                  <Input
                    id="storeBankAccount"
                    value={storeBankAccount}
                    onChange={(e) => setStoreBankAccount(e.target.value)}
                    placeholder="Masukkan nomor rekening"
                    className="h-10"
                    disabled={isOutletAssigned || !isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeBankAccountName" className="text-sm font-medium">Atas Nama (A/N)</Label>
                  <Input
                    id="storeBankAccountName"
                    value={storeBankAccountName}
                    onChange={(e) => setStoreBankAccountName(e.target.value)}
                    placeholder="Masukkan nama pemilik rekening"
                    className="h-10"
                    disabled={isOutletAssigned || !isAdmin}
                  />
                </div>
              </div>
            </CollapsibleCard>






            {/* Printer Settings */}
            <CollapsibleCard id="printer" title="Pengaturan Printer" icon={Printer} description="Konfigurasi printer Bluetooth" isOpen={openCard === 'printer'} onToggle={toggleCard}>
              {/* Android Location Permission Notice */}
              <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Izin Lokasi Diperlukan</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Untuk menggunakan printer Bluetooth di Android, pastikan izin lokasi dan Bluetooth telah diaktifkan.
                    </p>
                  </div>
                </div>
                {canOpenAndroidAppSettings() && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-3 border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-900/50"
                    onClick={handleOpenAppPermissions}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Buka Pengaturan Izin Aplikasi
                  </Button>
                )}
              </div>

              {/* Bluetooth Store Name Input */}
              <div className="space-y-2 mb-5">
                <Label htmlFor="bluetoothStoreName" className="text-sm font-medium">Nama Perusahaan (Khusus Print Bluetooth)</Label>
                <Input
                  id="bluetoothStoreName"
                  value={bluetoothStoreName}
                  onChange={(e) => setBluetoothStoreName(e.target.value)}
                  placeholder="Masukkan nama perusahaan khusus untuk struk Bluetooth"
                  className="h-10"
                  disabled={!isAdmin}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nama ini akan dicantumkan di bagian atas struk thermal Bluetooth.
                </p>
              </div>

              {/* Auto Print Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <Label className="text-sm font-medium">Auto Print Struk</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Cetak otomatis saat transaksi</p>
                </div>
                <Switch checked={autoPrint} onCheckedChange={setAutoPrint} />
              </div>

              {/* Printer Selection */}
              <div className="mt-5 space-y-3">
                <Label className="text-sm font-medium">Pilih Printer</Label>
                <div className="flex gap-3">
                  <Input
                    readOnly
                    value={bluetoothPrinterMac ? bluetoothPrinterMac : 'Belum memilih printer'}
                    className="flex-1 text-sm h-11"
                  />
                  <Button onClick={handleScanDevices} disabled={isScanning} variant="outline" className="h-11 px-4">
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Memindai...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Pindai
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {showDeviceList && bluetoothDevices.length > 0 && (
                <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                    Perangkat Ditemukan ({bluetoothDevices.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {bluetoothDevices.map((device, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{device.name}</p>
                          <p className="text-xs text-slate-500 truncate">{device.address}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectBluetoothDevice(device.address, device.name)}
                          className="shrink-0 h-9 px-3"
                        >
                          Pilih
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !bluetoothPrinterMac}
                variant="outline"
                className="w-full mt-4 h-11"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menguji...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Tes Koneksi
                  </>
                )}
              </Button>

              {connectionStatus !== 'idle' && (
                <div className={`mt-4 flex items-center gap-3 text-sm p-4 rounded-xl ${connectionStatus === 'connected'
                  ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                  }`}>
                  {connectionStatus === 'connected' ? (
                    <>
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span>{connectionMessage || 'Printer terhubung'}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 shrink-0" />
                      <span>{connectionMessage || 'Gagal terhubung'}</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <Label className="text-sm font-medium">Tampilkan Pesan Footer</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Pesan di footer struk</p>
                </div>
                <Switch checked={showFooter} onCheckedChange={setShowFooter} disabled={!isAdminSuper} />
              </div>

              {showFooter && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="footerMessage" className="text-sm font-medium">Pesan Footer 1</Label>
                    <Input
                      id="footerMessage"
                      value={footerMessage}
                      onChange={(e) => setFooterMessage(e.target.value)}
                      placeholder="Masukkan pesan footer"
                      className="h-10"
                      disabled={!isAdminSuper}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="footerMessage2" className="text-sm font-medium">Pesan Footer 2</Label>
                    <Input
                      id="footerMessage2"
                      value={footerMessage2}
                      onChange={(e) => setFooterMessage2(e.target.value)}
                      placeholder="(kosong)"
                      className="h-10"
                      disabled={!isAdminSuper}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="footerMessage3" className="text-sm font-medium">Pesan Footer 3</Label>
                    <Input
                      id="footerMessage3"
                      value={footerMessage3}
                      onChange={(e) => setFooterMessage3(e.target.value)}
                      placeholder="(kosong)"
                      className="h-10"
                      disabled={!isAdminSuper}
                    />
                  </div>
                </div>
              )}
            </CollapsibleCard>

            {/* Appearance Settings */}
            <CollapsibleCard id="appearance" title="Tampilan" icon={Type} description="Konfigurasi tampilan aplikasi" isOpen={openCard === 'appearance'} onToggle={toggleCard}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fontSize" className="text-sm font-medium">Ukuran Font</Label>
                  <Select value={fontSize} onValueChange={setFontSize}>
                    <SelectTrigger id="fontSize" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Kecil</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="large">Besar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <Label className="text-sm font-medium">Dark Mode</Label>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gunakan tema gelap</p>
                  </div>
                  <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                </div>
              </div>

              {/* Primary Color Customization */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 space-y-5">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-slate-500" />
                  <Label className="text-sm font-medium">Warna Utama (HSL)</Label>
                </div>

                {/* Color Preview */}
                <div className="flex items-center gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                  <div
                    className="w-14 h-14 rounded-xl border-2 dark:border-slate-600 shadow-md"
                    style={{ backgroundColor: `hsl(${primaryHue}, ${primarySaturation}%, ${primaryLightness}%)` }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">hsl({primaryHue}, {primarySaturation}%, {primaryLightness}%)</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Warna aksen & tombol utama</p>
                  </div>
                </div>

                {/* Hue Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">Hue (Warna)</Label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{primaryHue}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={primaryHue}
                    onChange={(e) => setPrimaryHue(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right,
                          hsl(0, ${primarySaturation}%, ${primaryLightness}%),
                          hsl(60, ${primarySaturation}%, ${primaryLightness}%),
                          hsl(120, ${primarySaturation}%, ${primaryLightness}%),
                          hsl(180, ${primarySaturation}%, ${primaryLightness}%),
                          hsl(240, ${primarySaturation}%, ${primaryLightness}%),
                          hsl(300, ${primarySaturation}%, ${primaryLightness}%),
                          hsl(360, ${primarySaturation}%, ${primaryLightness}%))`
                    }}
                  />
                </div>

                {/* Saturation Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">Saturation (Kekayaan)</Label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{primarySaturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={primarySaturation}
                    onChange={(e) => setPrimarySaturation(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right,
                          hsl(${primaryHue}, 0%, ${primaryLightness}%),
                          hsl(${primaryHue}, 100%, ${primaryLightness}%))`
                    }}
                  />
                </div>

                {/* Lightness Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">Lightness (Kecerahan)</Label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{primaryLightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={primaryLightness}
                    onChange={(e) => setPrimaryLightness(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right,
                          hsl(${primaryHue}, ${primarySaturation}%, 10%),
                          hsl(${primaryHue}, ${primarySaturation}%, 50%),
                          hsl(${primaryHue}, ${primarySaturation}%, 90%))`
                    }}
                  />
                </div>

                {/* Quick Presets */}
                <div className="pt-3 space-y-3">
                  <Label className="text-sm">Preset Cepat</Label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(200); setPrimarySaturation(100); setPrimaryLightness(22); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform ring-2 ring-primary"
                      style={{ backgroundColor: 'hsl(200, 100%, 22%)' }}
                      title="Blue (Default)"
                    />
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(35); setPrimarySaturation(100); setPrimaryLightness(45); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: 'hsl(35, 100%, 45%)' }}
                      title="Orange/Amber"
                    />
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(230); setPrimarySaturation(85); setPrimaryLightness(55); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: 'hsl(230, 85%, 55%)' }}
                      title="Blue"
                    />
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(142); setPrimarySaturation(76); setPrimaryLightness(49); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: 'hsl(142, 76%, 49%)' }}
                      title="Green"
                    />
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(340); setPrimarySaturation(75); setPrimaryLightness(55); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: 'hsl(340, 75%, 55%)' }}
                      title="Pink/Magenta"
                    />
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(280); setPrimarySaturation(85); setPrimaryLightness(60); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: 'hsl(280, 85%, 60%)' }}
                      title="Purple"
                    />
                    <button
                      type="button"
                      onClick={() => { setPrimaryHue(0); setPrimarySaturation(72); setPrimaryLightness(51); }}
                      className="w-10 h-10 rounded-full border-2 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: 'hsl(0, 72%, 51%)' }}
                      title="Red"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleCard>

            {/* Notification Settings */}
            <CollapsibleCard id="notifications" title="Notifikasi" icon={Bell} description="Notifikasi untuk Android" isOpen={openCard === 'notifications'} onToggle={toggleCard}>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <Label className="text-sm font-medium">Notifikasi Transaksi Sukses</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tampilkan notifikasi Transaksi</p>
                </div>
                <Switch checked={notifyTransactionSuccess} onCheckedChange={setNotifyTransactionSuccess} />
              </div>
              <div className="flex items-center justify-between mt-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <Label className="text-sm font-medium">Notifikasi Print</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Notifikasi saat cetak dari popup berhasil atau printer bermasalah</p>
                </div>
                <Switch checked={notifyPrint} onCheckedChange={setNotifyPrint} />
              </div>
            </CollapsibleCard>

            {/* About System */}
            <CollapsibleCard id="about" title="Tentang System" icon={Info} description="Informasi aplikasi" isOpen={openCard === 'about'} onToggle={toggleCard}>
              <div className="space-y-5">
                {/* App Info */}
                <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-primary/10 to-primary/5 dark:bg-none dark:bg-black rounded-xl">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">CV.AULIA USAHA</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Point of Sale System</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Versi 1.0.0</p>
                  </div>
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center p-2 animate-logo-ring">
                    <img
                      src={`${import.meta.env.BASE_URL}CV.AULIA.png`}
                      alt="Logo"
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-4 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    &copy; {new Date().getFullYear()} CV.AULIA USAHA. All rights reserved.
                  </p>
                </div>
              </div>
            </CollapsibleCard>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}