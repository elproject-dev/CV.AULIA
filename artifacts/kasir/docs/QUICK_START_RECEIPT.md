# Receipt Raw Print - Quick Start Guide

## 📋 Overview

Konsep nota print raw untuk Thermal Printer Bluetooth dengan format sesuai template Sbagiamu.

**Fitur:**
- ✅ Format 32 karakter (standar thermal printer)
- ✅ Automatic harga dengan separator (18.000)
- ✅ Automatic tanggal format Indonesia (DD-MM-YYYY,HH.MM)
- ✅ Support diskon, poin, member system
- ✅ Right-align untuk angka, left-align untuk teks

---

## 🚀 Quick Implementation

### 1. Basic Print (3 langkah)

```typescript
import { generateReceiptRaw, printSimpleReceipt } from '@/lib/bluetooth-printer';

// Langkah 1: Buat data receipt
const receipt = {
  invoiceNumber: 'INV-001',
  date: new Date(),
  customerName: 'Budi',
  items: [
    { productName: 'Nasi Goreng', quantity: 1, price: 18000 },
    { productName: 'Es Teh', quantity: 1, price: 3000 },
  ],
  subtotal: 21000,
  total: 21000,
  amountPaid: 50000,
  change: 29000,
};

// Langkah 2: Preview (optional)
console.log(generateReceiptRaw(receipt));

// Langkah 3: Print
await printSimpleReceipt(receipt);
```

### 2. Dengan Diskon & Poin

```typescript
const receipt = {
  invoiceNumber: 'INV-001',
  date: new Date(),
  customerName: 'Jokowi',
  customerType: 'member',
  items: [
    { productName: 'Nasi Goreng', quantity: 1, price: 18000 },
    { productName: 'Es Teh', quantity: 1, price: 3000 },
  ],
  subtotal: 21000,
  discount: 2000,           // Diskon
  pointsRedeemed: 3,        // Poin digunakan
  pointsValue: 3000,        // Nilai poin (Rp)
  total: 16000,
  amountPaid: 50000,
  change: 34000,
  earnedPoints: 1,          // Poin didapat
};

await printSimpleReceipt(receipt);
```

### 3. Dari Data Transaksi Database

```typescript
import { transactionToReceiptData } from '@/lib/receipt-example';

// Convert DB transaction to receipt data
const receiptData = transactionToReceiptData(dbTransaction, {
  storeName: 'Sbagiamu',
  storeAddress: 'jl.condong catur no 13 yk',
});

await printSimpleReceipt(receiptData);
```

---

## 📐 Format Output

### Template Struktur:

```
         NAMA TOKO
     ALAMAT TOKO (optional)
________________________________
No.ID :               INV-001
Tanggal :       07-06-2026,14.35
Pelanggan :               Member
                      Nama Customer
________________________________
Nama Produk 1
1 x 18.000               18.000
Nama Produk 2
2 x 5.000                10.000

Diskon                    2.000
poin di gunakan -3        3.000
________________________________
Subtotal                 26.000
TOTAL                    21.000

Bayar                    50.000
Kembali                  29.000
metode                    Tunai
poin                         +1
________________________________

terima kasih sudah berbelanja
```

---

## 🔧 Interface

```typescript
interface ReceiptData {
  // Header
  storeName?: string;           // def: 'SBAGIAMU'
  storeAddress?: string;        // optional

  // Transaction
  invoiceNumber: string;        // 'INV-001'
  date: Date | string;
  customerName: string;
  customerType?: 'member' | 'regular';

  // Items
  items: ReceiptItem[];

  // Amounts
  subtotal: number;
  discount?: number;
  pointsRedeemed?: number;
  pointsValue?: number;
  total: number;

  // Payment
  amountPaid: number;
  change: number;
  paymentMethod?: string;       // def: 'Tunai'

  // Points
  earnedPoints?: number;

  // Footer
  footerMessage?: string;       // def: terima kasih
}

interface ReceiptItem {
  productName: string;
  quantity: number;
  price: number;
}
```

---

## 📱 Integration Points

### Di POS.tsx
```typescript
// Setelah checkout sukses
const success = await printSimpleReceipt(receiptData);
```

### Di transactions.tsx
```typescript
// Print existing transaction
<Button onClick={() => printSimpleReceipt(receiptData)}>
  Print
</Button>
```

### Di settings.tsx
```typescript
// Configure printer & test
await connectToPrinter(printerMac);
```

---

## 🎨 Customization

### Ubah Nama Toko
```typescript
const receipt = {
  ...receipt,
  storeName: 'WARUNG MAKAN LEZAT',
  storeAddress: 'Jl. Sudirman No. 45',
};
```

### Ubah Footer Message
```typescript
const receipt = {
  ...receipt,
  footerMessage: 'Sampai jumpa lagi!',
};
```

### Ubah Payment Method Label
```typescript
const receipt = {
  ...receipt,
  paymentMethod: 'Transfer Bank',  // Tunai, Transfer, Debit, Kredit, QRIS, E-Wallet
};
```

---

## ✅ Test Examples

### Run all examples
```typescript
import { testAllExamples } from '@/lib/receipt-example';
testAllExamples();  // Console akan print semua format
```

### Individual examples
```typescript
import { exampleBasicReceipt } from '@/lib/receipt-example';
console.log(exampleBasicReceipt());
```

---

## 🐛 Troubleshooting

### Printer tidak terkoneksi
```typescript
// 1. Cek MAC address di settings
const mac = localStorage.getItem('bluetoothPrinterMac');

// 2. List available devices
const { devices } = await listBluetoothDevices();
console.log(devices);

// 3. Connect manual
await connectToPrinter(mac);
```

### Format tidak tepat
```typescript
// Preview sebelum print
const preview = generateReceiptRaw(receiptData);
console.log(preview);

// Cek output di console untuk alignment issues
```

### Harga format salah
```typescript
// Pastikan price adalah number, bukan string
const item = {
  productName: 'Produk',
  quantity: 1,
  price: 18000,  // number, bukan '18000'
};
```

---

## 📝 Checklist Implementation

### Phase 1: Basic Setup
- [ ] Copy fungsi dari bluetooth-printer.ts
- [ ] Test generateReceiptRaw() di console
- [ ] Verify format output

### Phase 2: Integration
- [ ] Integrate ke POS.tsx
- [ ] Integrate ke transactions.tsx
- [ ] Test print dari UI

### Phase 3: Enhancement
- [ ] Add customization options
- [ ] Add error handling
- [ ] Add success notifications

### Phase 4: Testing
- [ ] Test dengan berbagai items
- [ ] Test dengan berbagai harga
- [ ] Test member vs regular
- [ ] Test print preview

---

## 📦 Files Created

1. **bluetooth-printer.ts** - Tambahan fungsi generateReceiptRaw()
2. **RECEIPT_RAW_CONCEPT.md** - Dokumentasi lengkap
3. **RECEIPT_OUTPUT_PREVIEW.md** - Contoh output berbagai format
4. **receipt-example.ts** - 4 contoh implementasi
5. **RECEIPT_INTEGRATION.md** - Guide integrasi ke aplikasi
6. **QUICK_START.md** - File ini (quick reference)

---

## 💡 Tips & Tricks

### Tip 1: Preview tanpa printer
```typescript
// Untuk development/testing tanpa printer fisik
const preview = generateReceiptRaw(receiptData);
document.write('<pre>' + preview + '</pre>');
```

### Tip 2: Copy ke clipboard
```typescript
const text = generateReceiptRaw(receiptData);
navigator.clipboard.writeText(text);
```

### Tip 3: Export ke text file
```typescript
const text = generateReceiptRaw(receiptData);
const blob = new Blob([text], { type: 'text/plain' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'receipt.txt';
a.click();
```

### Tip 4: Debug formatting
```typescript
// Tampilkan dengan grid/ruler untuk alignment check
const text = generateReceiptRaw(receiptData);
const withRuler = '0         1         2         3\n' +
                  '0123456789012345678901234567890123\n' +
                  text;
console.log(withRuler);
```

---

## 🔗 Related Files

- [Dokumentasi Lengkap](RECEIPT_RAW_CONCEPT.md)
- [Output Preview](RECEIPT_OUTPUT_PREVIEW.md)
- [Contoh Implementasi](src/lib/receipt-example.ts)
- [Integration Guide](src/lib/RECEIPT_INTEGRATION.md)
- [Bluetooth Printer Module](src/lib/bluetooth-printer.ts)

---

## 📞 Support

Jika ada error atau pertanyaan:
1. Check console.log untuk error message
2. Verify data format sesuai interface
3. Test dengan contoh dari receipt-example.ts
4. Check dokumentasi di file-file di atas

---

## 🎯 Next Steps

1. **Implement di POS** - Add print button after checkout
2. **Implement di Transactions** - Add print button untuk reprint nota
3. **Configure Settings** - Allow user select printer & test connection
4. **Add Auto-Print** - Optional auto-print after transaction
5. **Add Print History** - Keep track of printed receipts

---

**Version:** 1.0  
**Last Updated:** June 7, 2026  
**Format:** ESC/POS Thermal Printer (32 char width)  
**Encoding:** UTF-8
