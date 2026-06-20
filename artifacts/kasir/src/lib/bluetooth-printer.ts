// Bluetooth Printer Utility untuk ESC/POS Thermal Printers
// Menggunakan Cordova Bluetooth Serial Plugin untuk Android

import { Capacitor } from '@capacitor/core';
import { formatInvoiceNumber } from './formatters';
import { isTauri } from './tauri-file';

interface PrinterDevice {
  macAddress: string;
  connected: boolean;
}

let printerDevice: PrinterDevice | null = null;
let bluetoothReady = false;

// Helper untuk mendapatkan BluetoothSerial plugin (Capacitor)
function getBluetoothSerial(): any {
  return (window as any)?.bluetoothSerial ?? null;
}

// Helper untuk delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ESC/POS Commands (tetap sama)
const ESC = '\x1B';
const GS = '\x1D';

const ESC_POS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  FONT_A: `${ESC}M\x00`,
  FONT_B: `${ESC}M\x01`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_BOTH: `${ESC}!\x30`,
  NORMAL_SIZE: `${ESC}!\x00`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  FEED_LINE: '\n',
  FEED_3_LINES: '\n\n\n',
  FEED_5_LINES: '\n\n\n\n\n',
  PARTIAL_CUT: `${GS}V\x01`,
  FULL_CUT: `${GS}V\x00`,
  BARCODE_HEIGHT: `${GS}h\x64`,
  BARCODE_WIDTH: `${GS}w\x02`,
  BARCODE_PRINT: `${GS}k`,
};

// Inisialisasi Bluetooth
export async function initializeBluetooth(): Promise<{ success: boolean; message: string }> {
  if (isTauri()) {
    bluetoothReady = true;
    return { success: true, message: 'Bluetooth siap (Tauri Desktop)' };
  }

  try {
    const BT = getBluetoothSerial();

    if (!BT) {
      if (Capacitor.isNativePlatform()) {
        console.warn('BluetoothSerial plugin tidak tersedia di perangkat native');
      }
      return {
        success: false,
        message: Capacitor.isNativePlatform()
          ? 'BluetoothSerial plugin tidak ditemukan. Pastikan plugin cordova-plugin-bluetooth-serial sudah diinstall.'
          : 'Bluetooth hanya tersedia di aplikasi Android atau Desktop.',
      };
    }

    // Enable Bluetooth (Capacitor)
    try {
      if (typeof BT.enable === 'function') {
        await new Promise<void>((resolve) => {
          BT.enable(() => resolve(), (error: any) => {
            console.warn('Enable Bluetooth warning:', error);
            resolve();
          });
        });
      }
    } catch (enableError) {
      console.warn('Error enabling Bluetooth:', enableError);
    }

    bluetoothReady = true;
    return { success: true, message: 'Bluetooth siap digunakan' };
  } catch (error: any) {
    console.error('Bluetooth initialization error:', error);
    return { success: false, message: error?.message || 'Gagal menginisialisasi Bluetooth' };
  }
}

// Hubungkan ke printer
export async function connectToPrinter(macAddress: string): Promise<{ success: boolean; message: string }> {
  if (!macAddress) return { success: false, message: 'MAC Address tidak valid.' };

  if (isTauri()) {
    printerDevice = { macAddress, connected: true };
    return { success: true, message: 'Printer siap (Tauri Desktop)' };
  }

  try {
    const BT = getBluetoothSerial();
    if (!BT) return { success: false, message: 'Bluetooth plugin tidak tersedia.' };

    if (!bluetoothReady) await initializeBluetooth();

    if (printerDevice?.connected && printerDevice.macAddress === macAddress) {
      return { success: true, message: 'Sudah terhubung ke printer' };
    }

    if (printerDevice?.connected) await disconnectPrinter();

    // List devices (Capacitor)
    try {
      const devices = await new Promise<any[]>((resolve, reject) => {
        BT.list((devices: any[]) => resolve(devices || []), (e: any) => reject(e));
      });

      const matchedDevice = devices.find((device: any) => 
        (device.address || device.id || '').toLowerCase() === macAddress.toLowerCase()
      );

      if (!matchedDevice) {
        return { success: false, message: 'Printer tidak ditemukan dalam daftar paired devices.' };
      }
    } catch (e) { console.warn('List failed, trying anyway'); }

    // Connect (Capacitor)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('TIMEOUT')), 10000);
      BT.connect(macAddress, () => {
        clearTimeout(timeout);
        resolve();
      }, (e: any) => {
        clearTimeout(timeout);
        reject(new Error(String(e)));
      });
    });

    printerDevice = { macAddress, connected: true };
    return { success: true, message: 'Berhasil terhubung ke printer' };
  } catch (error: any) {
    console.error('Connection error:', error);
    printerDevice = null;
    return { success: false, message: `Gagal terhubung: ${error?.message || String(error)}` };
  }
}

// Putuskan koneksi
export async function disconnectPrinter(): Promise<void> {
  if (isTauri()) {
    printerDevice = null;
    return;
  }

  try {
    const BT = getBluetoothSerial();
    if (BT && printerDevice?.connected) {
      await new Promise<void>((resolve) => {
        BT.disconnect(() => resolve(), () => resolve());
      });
    }
  } catch (e) { console.error('Disconnect error:', e); }
  printerDevice = null;
}

// Cetak data mentah
async function printRaw(data: string): Promise<boolean> {
  if (!printerDevice?.connected) {
    console.error('Printer tidak terhubung');
    return false;
  }

  // Konversi string ke array bytes
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    bytes[i] = data.charCodeAt(i);
  }

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('print_bluetooth_data', { 
        address: printerDevice.macAddress, 
        data: Array.from(bytes) 
      });
      return true;
    } catch (error) {
      console.error('Tauri print error:', error);
      return false;
    }
  }

  try {
    const BT = getBluetoothSerial();
    if (!BT) return false;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('TIMEOUT')), 10000);
      BT.write(Array.from(bytes), () => {
        clearTimeout(timeout);
        resolve();
      }, (e: any) => {
        clearTimeout(timeout);
        reject(new Error(String(e)));
      });
    });
    return true;
  } catch (error) {
    console.error('Print error:', error);
    return false;
  }
}

// Format data receipt untuk thermal printer
export function formatReceipt(transaction: any): string {
  console.log('formatReceipt called with transaction keys:', Object.keys(transaction || {}));

  const {
    storeName = 'SBAGIAMU',
    storeAddress = '',
    storePhone = '',
    customerName,
    customerPhone,
    cashierName,
    cashier_name,
    id,
    items = [],
    subtotal = 0,
    tax = 0,
    discount = 0,
    discountNote = '',
    total = 0,
    amountPaid = 0,
    change = 0,
    paymentMethod = 'cash',
    enablePPN = false,
    ppnPercentage = 11,
    customerType = 'regular',
    pointsRedeemed = 0,
    pointsDiscount = 0,
    earnedPoints = 0,
    finalCustomerPoints = 0,
    pointsValue = 1000,
    footerMessage = 'terima kasih sudah berbelanja',
    footerMessage2 = 'Real Brew, Real Bean, Real Coffee',
    footerMessage3 = 'Powered by Tembus Digital',
    createdAt,
  } = transaction || {};

  const displayCashierName = cashier_name || cashierName || 'Admin Kasir';
  let receipt = '';
  // Width for Font B is 42 characters
  const PAPER_WIDTH = 42;
  const SEPARATOR = '-'.repeat(PAPER_WIDTH);
  const DECO_SEPARATOR = '='.repeat(PAPER_WIDTH);

  // Inisialisasi printer
  receipt += ESC_POS.INIT;
  receipt += ESC_POS.FONT_B; // Gunakan Font B secara global
  receipt += ESC_POS.ALIGN_CENTER;

  // DISABLED: Header - Nama Toko (sudah ditampilkan di logo)
  // receipt += `\n`;
  // receipt += ESC_POS.DOUBLE_HEIGHT;
  // receipt += `${storeName}\n`;
  // receipt += ESC_POS.NORMAL_SIZE;

  // DISABLED: Alamat toko (sudah ditampilkan di logo)
  // if (storeAddress) {
  //   receipt += `${storeAddress}\n`;
  // }

  receipt += `${DECO_SEPARATOR}\n`;
  receipt += ESC_POS.ALIGN_LEFT;

  // Info transaksi (No.ID, Tanggal, Pelanggan)
  const dateObj = createdAt ? new Date(createdAt) : new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hour = String(dateObj.getHours()).padStart(2, '0');
  const minute = String(dateObj.getMinutes()).padStart(2, '0');

  const waktuStr = `${day} ${month} ${year} ,${hour}:${minute}`;

  receipt += formatLine('No.ID', id ? formatInvoiceNumber(id) : '-', PAPER_WIDTH) + '\n';
  receipt += formatLine('Waktu', waktuStr, PAPER_WIDTH) + '\n';

  if (customerType === 'member' && customerName) {
    receipt += formatLine('Pelanggan', `Member - ${customerName}`, PAPER_WIDTH) + '\n';
  } else {
    receipt += formatLine('Pelanggan', 'Umum', PAPER_WIDTH) + '\n';
  }
  receipt += formatLine('Kasir', displayCashierName, PAPER_WIDTH) + '\n';
  receipt += `${SEPARATOR}\n`;

  // Daftar item: Qty Nama_Produk Harga Total (Posisi harga satuan fix/sejajar)
  items?.forEach((item: any) => {
    const name = item.productName || '-';
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const itemTotal = qty * price;

    const qtyStr = `${qty}`;
    const priceStr = formatPrice(price);
    const totalStr = formatPrice(itemTotal);

    // Fixed widths agar kolom harga satuan sejajar
    const QTY_WIDTH = 3;
    const NAME_WIDTH = 19;
    const PRICE_WIDTH = 9;

    const qtyPadded = qtyStr.padEnd(QTY_WIDTH, ' ');
    
    let displayName = name;
    if (displayName.length > NAME_WIDTH) {
      displayName = displayName.substring(0, NAME_WIDTH - 3) + '...';
    }
    const namePadded = displayName.padEnd(NAME_WIDTH, ' ');
    
    const pricePadded = priceStr.padStart(PRICE_WIDTH, ' ');

    const leftSide = `${qtyPadded}${namePadded} ${pricePadded}`;
    receipt += formatLine(leftSide, totalStr, PAPER_WIDTH) + '\n';
  });

  receipt += `${SEPARATOR}\n`;

  // Subtotal dan Total
  receipt += formatLine('Subtotal', formatPrice(subtotal), PAPER_WIDTH) + '\n';

  // PPN (Pajak 11%)
  if (tax > 0) {
    receipt += formatLine(`Pajak (${ppnPercentage || 11}%)`, formatPrice(tax), PAPER_WIDTH) + '\n';
  }

  // Diskon dan poin yang digunakan (di bawah subtotal)
  if (discount > 0) {
    receipt += formatLine('Diskon', formatPrice(discount), PAPER_WIDTH) + '\n';
  }

  if (pointsDiscount > 0) {
    receipt += formatLine(`Poin digunakan -${pointsRedeemed}`, formatPrice(pointsDiscount), PAPER_WIDTH) + '\n';
  }

  receipt += ESC_POS.BOLD_ON;
  receipt += formatLine('TOTAL', formatPrice(total), PAPER_WIDTH) + '\n';
  receipt += ESC_POS.BOLD_OFF;
  receipt += `\n`;

  // Info pembayaran
  if (paymentMethod === 'cash') {
    receipt += formatLine('Bayar', formatPrice(amountPaid), PAPER_WIDTH) + '\n';
    receipt += formatLine('Kembali', formatPrice(change), PAPER_WIDTH) + '\n';
  }

  receipt += formatLine('Metode Pembayaran', getPaymentMethodLabel(paymentMethod), PAPER_WIDTH) + '\n';

  // Poin yang didapat dan total poin (untuk member)
  if (customerType === 'member') {
    if (earnedPoints > 0) {
      receipt += formatLine('Poin', `+${earnedPoints}`, PAPER_WIDTH) + '\n';
    }
    // Asumsikan finalCustomerPoints ada dan di-passing dari komponen checkout
    if (finalCustomerPoints !== undefined && finalCustomerPoints !== null) {
      receipt += formatLine('Total Poin', `${finalCustomerPoints}`, PAPER_WIDTH) + '\n';
    }
  }

  receipt += `${SEPARATOR}\n`;

  // Footer (Langsung tanpa newline)
  receipt += ESC_POS.ALIGN_CENTER;
  
  if (footerMessage) {
    receipt += `${footerMessage}\n`;
  }
  if (footerMessage2) {
    receipt += `${footerMessage2}\n`;
  }
  if (footerMessage3) {
    receipt += `\n${footerMessage3}\n\n`; // Tambah spasi kosong 1 baris di bawahnya agar tidak terpotong
  }
  
  receipt += ESC_POS.FEED_3_LINES;

  // Potong kertas
  receipt += ESC_POS.PARTIAL_CUT;

  return receipt;
}

// Helper untuk format harga
function formatPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

// Helper untuk label metode pembayaran
function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Tunai';
    case 'transfer': return 'Transfer';
    case 'debit_card': return 'Debit';
    case 'credit_card': return 'Kredit';
    case 'qris': return 'QRIS';
    default: return method;
  }
}

// Convert image to ESC/POS bitmap format - centered dan kecil
export async function imageToEscPosBitmap(imagePath: string, width: number = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Ukuran printer thermal: 32 karakter width = 256 pixels
        // Tapi untuk logo, kita gunakan ukuran yang lebih kecil dan pas
        const PRINTER_WIDTH_PIXELS = 256; // 32 chars * 8 pixels per char
        const logoHeight = Math.round((PRINTER_WIDTH_PIXELS / img.width) * img.height);

        if (img.width === 0 || img.height === 0) {
          reject(new Error('Invalid image dimensions'));
          return;
        }

        // Create canvas dengan ukuran sesuai printer thermal
        const canvas = document.createElement('canvas');
        canvas.width = PRINTER_WIDTH_PIXELS;
        canvas.height = logoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image scaled to fit width but maintain aspect ratio
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Resize canvas untuk thermal printer resolution
        // Thermal printers typically use 8 dots per mm, reduce for better print quality
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = 280; // Reduced from 384 for smaller logo
        resizedCanvas.height = Math.round((280 / canvas.width) * canvas.height);

        const resizedCtx = resizedCanvas.getContext('2d');
        if (!resizedCtx) {
          reject(new Error('Cannot get resized canvas context'));
          return;
        }

        // White background
        resizedCtx.fillStyle = 'white';
        resizedCtx.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);

        // Draw scaled image
        resizedCtx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);

        // Get image data
        const imageData = resizedCtx.getImageData(0, 0, resizedCanvas.width, resizedCanvas.height);
        const data = imageData.data;

        // Convert to monochrome (black and white)
        const bitmap: number[] = [];
        const bytesPerRow = Math.ceil(resizedCanvas.width / 8);

        for (let y = 0; y < resizedCanvas.height; y++) {
          for (let x = 0; x < bytesPerRow; x++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x * 8 + bit;
              if (pixelX < resizedCanvas.width) {
                const pixelIndex = (y * resizedCanvas.width + pixelX) * 4;
                const gray = (data[pixelIndex] * 0.299 + data[pixelIndex + 1] * 0.587 + data[pixelIndex + 2] * 0.114);
                if (gray < 128) {
                  byte |= (0x80 >> bit);
                }
              }
            }
            bitmap.push(byte);
          }
        }

        // ESC/POS bitmap command - dengan alignment CENTER
        let result = '';
        result += ESC_POS.ALIGN_CENTER; // Set alignment to center FIRST
        result += GS + 'v' + '0' + '\x00'; // mode 0 = normal mode, single density

        // Width dalam satuan byte (bytesPerRow)
        result += String.fromCharCode(bytesPerRow & 0xFF);
        result += String.fromCharCode((bytesPerRow >> 8) & 0xFF);

        // Height
        result += String.fromCharCode(resizedCanvas.height & 0xFF);
        result += String.fromCharCode((resizedCanvas.height >> 8) & 0xFF);

        // Add bitmap data
        for (let byte of bitmap) {
          result += String.fromCharCode(byte);
        }

        result += '\n';
        result += ESC_POS.ALIGN_LEFT; // Reset to left align after logo
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imagePath;
  });
}

// Cetak receipt
export async function printReceipt(transaction: any): Promise<boolean> {
  try {
    console.log('printReceipt called with transaction:', JSON.stringify(transaction, null, 2));

    // Validate required fields
    if (!transaction) {
      console.error('Transaction is null or undefined');
      return false;
    }

    if (!transaction.items || !Array.isArray(transaction.items)) {
      console.error('Transaction items is missing or not an array');
      return false;
    }

    console.log('Transaction validation passed');
    let receiptData = formatReceipt(transaction);
    console.log('Formatted receipt data length:', receiptData.length);
    console.log('Receipt data preview:', receiptData.substring(0, 200));

    // Tambahkan logo di awal
    let finalReceipt = '';
    try {
      const logoData = await imageToEscPosBitmap('/sbagiamu.png', 80);
      finalReceipt = logoData;
      console.log('Logo berhasil ditambahkan');
    } catch (logoError) {
      console.warn('Logo tidak dapat ditambahkan:', logoError);
      // Lanjutkan tanpa logo
    }

    finalReceipt += receiptData;
    const success = await printRaw(finalReceipt);

    if (success) {
      console.log('Receipt berhasil dicetak');
    } else {
      console.error('Gagal mencetak receipt - printRaw returned false');
    }

    return success;
  } catch (error) {
    console.error('Error saat mencetak receipt:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return false;
  }
}

// Cek apakah Bluetooth tersedia
export function isBluetoothAvailable(): boolean {
  return isTauri() || getBluetoothSerial() !== null;
}

// Cek apakah printer sudah terhubung
export function isPrinterConnected(): boolean {
  return printerDevice?.connected === true;
}

// Ambil setting auto print
export function getAutoPrintSetting(): boolean {
  return localStorage.getItem('autoPrint') === 'true';
}

// Ambil MAC address printer Bluetooth
export function getBluetoothPrinterMac(): string {
  return localStorage.getItem('bluetoothPrinterMac') || '';
}

// Helper untuk cek plugin dengan retry
async function getBluetoothSerialWithRetry(maxRetries: number = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    const BT = getBluetoothSerial();
    if (BT) {
      console.log(`BluetoothSerial plugin found (attempt ${i + 1})`);
      return BT;
    }
    if (i < maxRetries - 1) {
      console.log(`Bluetooth plugin not ready, waiting... (attempt ${i + 1}/${maxRetries})`);
      await delay(500);
    }
  }
  return null;
}

// List available Bluetooth devices
export async function listBluetoothDevices(): Promise<{
  success: boolean;
  devices: Array<{ name: string; address: string }>;
  message: string;
}> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const devices = await invoke<Array<{ name: string; address: string }>>('list_bluetooth_devices');
      return {
        success: true,
        devices,
        message: `Ditemukan ${devices.length} perangkat Bluetooth`
      };
    } catch (error: any) {
      console.error('Tauri list devices error:', error);
      return {
        success: false,
        devices: [],
        message: `Gagal mendaftar perangkat Bluetooth: ${error?.message || String(error)}`
      };
    }
  }

  try {
    // Try to get plugin with retry
    const BT = await getBluetoothSerialWithRetry(3);

    if (!BT) {
      console.error('BluetoothSerial plugin not available after retries');
      return {
        success: false,
        devices: [],
        message: 'Plugin Bluetooth tidak tersedia. Pastikan aplikasi sudah diinstal dengan benar dan Bluetooth didukung perangkat Anda.'
      };
    }

    // Ensure Bluetooth is initialized
    if (!bluetoothReady) {
      console.log('Bluetooth not ready, initializing...');
      const initResult = await initializeBluetooth();
      if (!initResult.success) {
        return {
          success: false,
          devices: [],
          message: initResult.message
        };
      }
    }

    console.log('Listing paired Bluetooth devices...');
    const devices = await new Promise<any[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Device listing timeout'));
      }, 10000); // 10 second timeout

      BT.list(
        (devices: any[]) => {
          clearTimeout(timeout);
          resolve(devices || []);
        },
        (error: any) => {
          clearTimeout(timeout);
          console.warn('Error listing devices:', error);
          reject(error);
        }
      );
    });

    // Map devices to standardized format
    const mappedDevices = devices.map((device: any) => ({
      name: device.name || 'Unknown Device',
      address: (device.address || device.id || '').toUpperCase()
    }));

    console.log('Devices found:', mappedDevices);

    if (mappedDevices.length === 0) {
      return {
        success: true,
        devices: [],
        message: 'Tidak ada perangkat Bluetooth yang ditemukan. Pastikan printer sudah dipairing di Bluetooth settings Android.'
      };
    }

    return {
      success: true,
      devices: mappedDevices,
      message: `Ditemukan ${mappedDevices.length} perangkat Bluetooth`
    };
  } catch (error: any) {
    console.error('Error listing Bluetooth devices:', error);
    return {
      success: false,
      devices: [],
      message: `Gagal mendaftar perangkat Bluetooth: ${error?.message || 'Unknown error'}`
    };
  }
}

// ==================== RECEIPT RAW GENERATION ====================

// Helper: Center text dalam lebar tertentu
function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

// Helper: Format line dengan label di kiri dan value di kanan (32 karakter)
function formatLine(label: string, value: string, width: number = 32): string {
  const maxLabelLen = width - value.length - 1;
  const truncatedLabel = label.substring(0, maxLabelLen);
  const padding = width - truncatedLabel.length - value.length;
  return truncatedLabel + ' '.repeat(Math.max(1, padding)) + value;
}

// Helper: Format tanggal Indonesia (DD-MM-YYYY,HH.MM)
function formatDateIndonesia(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${day}-${month}-${year},${hour}.${minute}`;
}

// Helper: Format waktu untuk receipt (DD mon YYYY ,HH:MM)
function formatWaktuReceipt(date: Date): string {
  const bulanIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = bulanIndo[date.getMonth()];
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} ,${hour}:${minute}`;
}

/**
 * Generate receipt dalam format raw text untuk thermal printer
 * Sesuai dengan konsep nota Sbagiamu
 */
export interface ReceiptItem {
  productName: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  // Header
  storeName?: string;
  storeAddress?: string;
  logoPath?: string; // Path ke logo gambar (PNG)

  // Transaction Info
  invoiceNumber: string;
  date: Date | string;
  customerName: string;
  cashierName?: string;
  cashier_name?: string;
  customerType?: 'member' | 'regular'; // member atau regular

  // Items
  items: ReceiptItem[];

  // Totals
  subtotal: number;
  tax?: number; // PPN/Pajak
  ppnPercentage?: number; // Persentase PPN (default 11%)
  discount?: number;
  pointsRedeemed?: number; // jumlah poin yang digunakan
  pointsValue?: number; // nilai rupiah dari poin
  total: number;

  // Payment
  amountPaid: number;
  change: number;
  paymentMethod?: string; // Tunai, Transfer, dll

  // Points (untuk member)
  earnedPoints?: number; // poin yang didapat
  finalCustomerPoints?: number; // total poin pelanggan

  // Footer
  footerMessage?: string;
  footerMessage2?: string;
  footerMessage3?: string;
}

/**
 * Generate raw receipt text
 * Format sesuai contoh:
 *          Sbagiamu
 *   jl.condong catur no 13 yk
 * ________________________________
 * No.ID :               INV-A00001
 * ...
 */
export function generateReceiptRaw(data: ReceiptData): string {
  const {
    storeName = 'SBAGIAMU',
    storeAddress = '',
    invoiceNumber,
    date = new Date(),
    customerName,
    cashierName,
    cashier_name,
    customerType = 'regular',
    items,
    subtotal,
    tax = 0,
    ppnPercentage = 11,
    discount = 0,
    pointsRedeemed = 0,
    pointsValue = 0,
    total,
    amountPaid,
    change,
    paymentMethod = 'Tunai',
    earnedPoints = 0,
    finalCustomerPoints,
    footerMessage = 'terima kasih sudah berbelanja',
    footerMessage2 = 'Real Brew, Real Bean, Real Coffee',
    footerMessage3 = 'Powered by Tembus Digital',
  } = data;

  const displayCashierName = cashier_name || cashierName || 'Admin Kasir';

  const PAPER_WIDTH = 42; // Font B width
  const SEPARATOR = '-'.repeat(PAPER_WIDTH);
  const DECO_SEPARATOR = '='.repeat(PAPER_WIDTH);

  let receipt = '';

  // Inisialisasi printer dan font (raw format ESC/POS injection di awal string tidak terbaca sebagai raw text biasa, jadi kita biarkan jika ini pure raw string. Tapi jika ini dikirim sebagai text ke printer yang support escape code, kita tambahkan ESC/POS)
  receipt += ESC_POS.INIT;
  receipt += ESC_POS.FONT_B;

  // Tambahkan line kosong di awal agar header tidak terpotong saat print
  receipt += '\n\n';

  // ==================== HEADER ====================
  // DISABLED: Header dengan nama toko dan alamat disembunyikan (logo sudah menampilkannya)
  // receipt += `${DECO_SEPARATOR}\n`;
  // receipt += '\n';
  // receipt += `${centerText(storeName, PAPER_WIDTH)}\n`;
  // if (storeAddress) {
  //   receipt += `${centerText(storeAddress, PAPER_WIDTH)}\n`;
  // }
  // receipt += `${DECO_SEPARATOR}\n`;

  // ==================== TRANSACTION INFO ====================
  receipt += formatLine('No.ID', invoiceNumber, PAPER_WIDTH) + '\n';

  const dateObj = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const waktuStr = formatWaktuReceipt(dateObj);
  receipt += formatLine('Waktu', waktuStr, PAPER_WIDTH) + '\n';

  receipt += formatLine('Pelanggan', customerName, PAPER_WIDTH) + '\n';
  receipt += formatLine('Kasir', displayCashierName, PAPER_WIDTH) + '\n';
  receipt += `${SEPARATOR}\n`;
  // ==================== ITEMS ====================
  items.forEach((item) => {
    const { productName, quantity, price } = item;
    const itemTotal = quantity * price;

    const qtyStr = `${quantity}`;
    const priceStr = formatPrice(price);
    const totalStr = formatPrice(itemTotal);

    // Fixed widths agar kolom harga satuan sejajar
    const QTY_WIDTH = 3;
    const NAME_WIDTH = 19;
    const PRICE_WIDTH = 9;

    const qtyPadded = qtyStr.padEnd(QTY_WIDTH, ' ');
    
    let displayName = productName || '-';
    if (displayName.length > NAME_WIDTH) {
      displayName = displayName.substring(0, NAME_WIDTH - 3) + '...';
    }
    const namePadded = displayName.padEnd(NAME_WIDTH, ' ');
    
    const pricePadded = priceStr.padStart(PRICE_WIDTH, ' ');

    const leftSide = `${qtyPadded}${namePadded} ${pricePadded}`;
    receipt += formatLine(leftSide, totalStr, PAPER_WIDTH) + '\n';
  });

  // ==================== DISCOUNTS & POINTS ====================
  if (discount > 0) {
    receipt += formatLine('Diskon', formatPrice(discount), PAPER_WIDTH) + '\n';
  }

  if (pointsRedeemed > 0 && pointsValue > 0) {
    receipt += formatLine(`Poin digunakan -${pointsRedeemed}`, formatPrice(pointsValue), PAPER_WIDTH) + '\n';
  }

  receipt += `${SEPARATOR}\n`;

  // ==================== TOTALS ====================
  receipt += formatLine('Subtotal', formatPrice(subtotal), PAPER_WIDTH) + '\n';

  // PPN (Pajak)
  if (tax > 0) {
    receipt += formatLine(`Pajak (${ppnPercentage}%)`, formatPrice(tax), PAPER_WIDTH) + '\n';
  }

  receipt += formatLine('TOTAL', formatPrice(total), PAPER_WIDTH) + '\n';
  receipt += `\n`;

  // ==================== PAYMENT ====================
  receipt += formatLine('Bayar', formatPrice(amountPaid), PAPER_WIDTH) + '\n';
  receipt += formatLine('Kembali', formatPrice(change), PAPER_WIDTH) + '\n';
  receipt += formatLine('Metode', paymentMethod, PAPER_WIDTH) + '\n';

  if (customerType === 'member') {
    if (earnedPoints > 0) {
      receipt += formatLine('Poin', `+${earnedPoints}`, PAPER_WIDTH) + '\n';
    }
    if (finalCustomerPoints !== undefined && finalCustomerPoints !== null) {
      receipt += formatLine('Total Poin', `${finalCustomerPoints}`, PAPER_WIDTH) + '\n';
    }
  }

  receipt += `${SEPARATOR}\n`;

  // ==================== FOOTER ====================
  receipt += `${DECO_SEPARATOR}\n`;
  receipt += '\n';

  if (footerMessage) {
    receipt += `${centerText(footerMessage, PAPER_WIDTH)}\n`;
  }
  if (footerMessage2) {
    receipt += `${centerText(footerMessage2, PAPER_WIDTH)}\n`;
  }
  if (footerMessage3) {
    receipt += `\n${centerText(footerMessage3, PAPER_WIDTH)}\n\n`; // Tambah spasi kosong 1 baris di bawahnya agar tidak terpotong
  }
  
  receipt += '\n';
  receipt += `${DECO_SEPARATOR}\n`;
  receipt += `\n\n`;

  return receipt;
}

/**
 * Generate receipt dengan logo di atas nama toko
 * Versi async yang support gambar - menggabungkan bitmap logo dengan text receipt
 */
export async function generateReceiptRawWithLogo(data: ReceiptData): Promise<string> {
  let finalReceipt = '';

  // Tambahkan logo di awal jika tersedia
  if (data.logoPath) {
    try {
      const logoData = await imageToEscPosBitmap(data.logoPath, 80);
      if (logoData) {
        finalReceipt += logoData;
        finalReceipt += '\n\n'; // Spasi setelah logo
      }
    } catch (error) {
      console.warn('Failed to add logo to receipt:', error);
    }
  }

  // Generate receipt text tanpa logoPath dan tanpa nama toko/alamat (sudah ada di logo)
  const receiptDataWithoutLogoAndStore: ReceiptData = {
    ...data,
    logoPath: undefined, // Remove logo path
    storeName: undefined, // Sembunyikan nama toko
    storeAddress: undefined, // Sembunyikan alamat
  };

  // Gunakan generateReceiptRaw untuk text content
  finalReceipt += generateReceiptRaw(receiptDataWithoutLogoAndStore);

  return finalReceipt;
}

/**
 * Cetak receipt menggunakan data simple
 */
export async function printSimpleReceipt(receiptData: ReceiptData): Promise<boolean> {
  try {
    // Gunakan versi dengan logo jika logoPath disediakan
    let rawText: string;
    if (receiptData.logoPath) {
      rawText = await generateReceiptRawWithLogo(receiptData);
    } else {
      rawText = generateReceiptRaw(receiptData);
    }
    return await printRaw(rawText);
  } catch (error) {
    console.error('Error printing simple receipt:', error);
    return false;
  }
}

/**
 * Cetak receipt dengan logo (async wrapper)
 */
export async function printReceiptWithLogo(receiptData: ReceiptData): Promise<boolean> {
  try {
    const rawText = await generateReceiptRawWithLogo(receiptData);
    return await printRaw(rawText);
  } catch (error) {
    console.error('Error printing receipt with logo:', error);
    return false;
  }
}

// Set MAC address printer Bluetooth
export function setBluetoothPrinterMac(macAddress: string): void {
  localStorage.setItem('bluetoothPrinterMac', macAddress);
}
