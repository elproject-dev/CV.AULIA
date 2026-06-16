# Konsep Nota Print Raw - Thermal Printer

## Overview
Fungsi `generateReceiptRaw()` membuat format nota dalam raw text yang sesuai dengan template thermal printer 32 karakter.

## Format Nota

```
         Sbagiamu
  jl.condong catur no 13 yk
________________________________
No.ID :               INV-A00001
Tanggal :       12-05-2026,12.01
Pelanggan :               Member
                          Jokowi
________________________________
Nasi Goreng 
1 x 18.000               18.000
Es Teh                 
1 x 3.000                 3.000

Diskon                    2.000
poin di gunakan -3        3.000
_______________________________
Subtotal                 16.000
TOTAL                    16.000

Bayar                    50.000
Kembali                  34.000
metode                    Tunai
poin                        +1
_______________________________
terima kasih sudah berbelanja

```

## Struktur Data Receipt

```typescript
interface ReceiptData {
  // Header
  storeName?: string;           // default: 'SBAGIAMU'
  storeAddress?: string;        // alamat toko

  // Transaction Info
  invoiceNumber: string;        // misal: 'INV-A00001'
  date: Date | string;          // tanggal transaksi
  customerName: string;         // nama pelanggan
  customerType?: 'member' | 'regular';

  // Items
  items: ReceiptItem[];         // array produk

  // Totals
  subtotal: number;             // total sebelum diskon/poin
  discount?: number;            // diskon rupiah
  pointsRedeemed?: number;      // jumlah poin digunakan
  pointsValue?: number;         // nilai rupiah dari poin
  total: number;                // total akhir

  // Payment
  amountPaid: number;           // jumlah uang yang dibayar
  change: number;               // kembalian
  paymentMethod?: string;       // misal: 'Tunai'

  // Points (untuk member)
  earnedPoints?: number;        // poin yang didapat

  // Footer
  footerMessage?: string;       // default: 'terima kasih sudah berbelanja'
}

interface ReceiptItem {
  productName: string;
  quantity: number;
  price: number;
}
```

## Cara Penggunaan

### 1. Generate Raw Text (untuk preview/testing)

```typescript
import { generateReceiptRaw } from '@/lib/bluetooth-printer';

const receiptData = {
  storeName: 'Sbagiamu',
  storeAddress: 'jl.condong catur no 13 yk',
  invoiceNumber: 'INV-A00001',
  date: new Date('2026-05-12T12:01:00'),
  customerName: 'Jokowi',
  customerType: 'member',
  items: [
    { productName: 'Nasi Goreng', quantity: 1, price: 18000 },
    { productName: 'Es Teh', quantity: 1, price: 3000 },
  ],
  subtotal: 21000,
  discount: 2000,
  pointsRedeemed: 3,
  pointsValue: 3000,
  total: 16000,
  amountPaid: 50000,
  change: 34000,
  paymentMethod: 'Tunai',
  earnedPoints: 1,
};

// Generate raw text
const rawText = generateReceiptRaw(receiptData);
console.log(rawText);

// Output akan seperti:
//          Sbagiamu
//   jl.condong catur no 13 yk
// ________________________________
// No.ID :               INV-A00001
// ... dst
```

### 2. Cetak langsung ke Printer Bluetooth

```typescript
import { printSimpleReceipt, connectToPrinter } from '@/lib/bluetooth-printer';

// Step 1: Hubungkan ke printer
const printerMac = '00:1A:7D:DA:71:13'; // MAC address printer
await connectToPrinter(printerMac);

// Step 2: Cetak receipt
const success = await printSimpleReceipt(receiptData);
if (success) {
  console.log('Nota berhasil dicetak');
} else {
  console.log('Gagal mencetak nota');
}
```

## Format Details

### Header
- Nama toko di-center
- Alamat toko di-center (opsional)
- Separator line (underscore 32 karakter)

### Info Transaksi
- No.ID, Tanggal, Pelanggan di-left align dengan padding
- Tanggal format: DD-MM-YYYY,HH.MM

### Items
- Nama produk di baris pertama
- Qty x Harga di baris kedua, total di sebelah kanan (right align)

### Totals & Payment
- Diskon (jika ada)
- Poin digunakan (jika ada)
- Separator
- Subtotal, TOTAL (bold)
- Bayar, Kembali, Metode pembayaran
- Poin yang didapat (untuk member)

### Footer
- Pesan terima kasih di-center

## Fungsi Helper

### `centerText(text, width)`
Mengenter text dalam lebar tertentu

### `padRight(text, length)`
Padding kanan untuk align kiri

### `padLeft(text, length)`
Padding kiri untuk align kanan

### `formatPrice(price)`
Format harga ke Rupiah tanpa simbol (contoh: 18000 → "18.000")

### `formatDateIndonesia(date)`
Format tanggal DD-MM-YYYY,HH.MM (contoh: 12-05-2026,12.01)

## Integrasi dengan Page

### Contoh di halaman transactions.tsx

```typescript
import { printSimpleReceipt, connectToPrinter } from '@/lib/bluetooth-printer';

// Dalam function print receipt
const handlePrintReceipt = async (transaction: any) => {
  try {
    // Get stored printer MAC
    const printerMac = localStorage.getItem('bluetoothPrinterMac');
    if (!printerMac) {
      alert('Printer belum dikonfigurasi');
      return;
    }

    // Connect to printer
    const connectResult = await connectToPrinter(printerMac);
    if (!connectResult.success) {
      alert(connectResult.message);
      return;
    }

    // Prepare receipt data
    const receiptData = {
      storeName: 'Sbagiamu',
      storeAddress: 'jl.condong catur no 13 yk',
      invoiceNumber: transaction.invoice_number,
      date: new Date(transaction.created_at),
      customerName: transaction.customer?.name || 'Guest',
      customerType: transaction.customer?.type || 'regular',
      items: transaction.items.map((item: any) => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal: transaction.subtotal,
      discount: transaction.discount,
      pointsRedeemed: transaction.points_redeemed,
      pointsValue: transaction.points_value,
      total: transaction.total,
      amountPaid: transaction.amount_paid,
      change: transaction.change,
      paymentMethod: transaction.payment_method,
      earnedPoints: transaction.earned_points,
    };

    // Print
    const success = await printSimpleReceipt(receiptData);
    if (success) {
      alert('Nota berhasil dicetak');
    } else {
      alert('Gagal mencetak nota');
    }
  } catch (error) {
    console.error('Error printing receipt:', error);
    alert('Terjadi kesalahan saat mencetak nota');
  }
};
```

## Testing & Preview

Untuk testing tanpa printer fisik, gunakan `generateReceiptRaw()` untuk melihat output:

```typescript
// Di console browser
import { generateReceiptRaw } from '@/lib/bluetooth-printer';

const testData = {
  invoiceNumber: 'INV-A00001',
  date: new Date(),
  customerName: 'Test Customer',
  items: [
    { productName: 'Item 1', quantity: 1, price: 10000 },
    { productName: 'Item 2', quantity: 2, price: 5000 },
  ],
  subtotal: 20000,
  total: 20000,
  amountPaid: 20000,
  change: 0,
};

console.log(generateReceiptRaw(testData));
```

## Notes

- Width tetap 32 karakter (standar thermal printer)
- Semua harga otomatis di-format dengan thousand separator
- Tanggal otomatis di-format sesuai standar Indonesia
- Untuk member, poin yang didapat ditampilkan
- Separator line menggunakan underscore 32 karakter
