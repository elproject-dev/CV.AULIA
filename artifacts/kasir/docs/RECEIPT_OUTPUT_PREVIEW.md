# Receipt Raw Print - Output Preview

Ini adalah preview dari berbagai format nota yang bisa dihasilkan dari fungsi `generateReceiptRaw()`.

---

## Preview 1: Basic Receipt (Member dengan Diskon & Poin)

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
________________________________
Subtotal                 21.000
TOTAL                    16.000

Bayar                    50.000
Kembali                  34.000
metode                    Tunai
poin                         +1
________________________________

terima kasih sudah berbelanja

```

**Data:**
- Items: Nasi Goreng (18.000), Es Teh (3.000)
- Subtotal: 21.000
- Diskon: 2.000
- Poin digunakan: 3 (nilai 3.000)
- Total: 16.000
- Bayar: 50.000
- Kembali: 34.000
- Poin didapat: +1

---

## Preview 2: Receipt dengan Tax (Regular Customer)

```
         WARUNG MAKAN LEZAT
          Jl. Sudirman No. 45
________________________________
No.ID :               INV-B00234
Tanggal :       07-06-2026,14.35
Pelanggan :            Regular
                  Pembeli Reguler
________________________________
Burger King 
2 x 35.000               70.000
Coca Cola                
2 x 8.000                16.000
Fries                  
1 x 15.000               15.000

________________________________
Subtotal                101.000
TOTAL                   111.100

Bayar                   150.000
Kembali                  38.900
metode                    Tunai
________________________________

terima kasih sudah berbelanja

```

**Data:**
- Items: Burger King (2x35.000), Coca Cola (2x8.000), Fries (1x15.000)
- Subtotal: 101.000
- Tax (10%): 10.100
- Total: 111.100
- Bayar: 150.000
- Kembali: 38.900

---

## Preview 3: Member Transaction dengan Points Redemption

```
            KOPI ENAK
         Jl. Ahmad Yani No. 88
________________________________
No.ID :              INV-M12345
Tanggal :       07-06-2026,10.45
Pelanggan :               Member
                   Budi Santoso
________________________________
Cappuccino             
1 x 25.000               25.000
Brownies               
2 x 15.000               30.000

Diskon                    5.000
poin di gunakan -50       10.000
________________________________
Subtotal                 55.000
TOTAL                    40.000

Bayar                    50.000
Kembali                  10.000
metode                    Tunai
poin                         +8
________________________________

terima kasih sudah berbelanja

```

**Data:**
- Items: Cappuccino (25.000), Brownies (2x15.000)
- Subtotal: 55.000
- Diskon: 5.000
- Poin digunakan: 50 (nilai 10.000)
- Total: 40.000
- Bayar: 50.000
- Kembali: 10.000
- Poin didapat: +8

---

## Preview 4: Large Transaction (Corporate)

```
            APPLE STORE
         Plaza Indonesia, Jakarta
________________________________
No.ID :         INV-APPLE-2026-001
Tanggal :       07-06-2026,09.15
Pelanggan :               Member
                    Corporate Buyer
________________________________
MacBook Pro M3         
1 x 25.000.000           25.000.000
Apple Magic Mouse      
2 x 2.500.000             5.000.000
USB-C Cable            
3 x 500.000               1.500.000
Apple Care+            
1 x 5.000.000             5.000.000

Diskon                  5.000.000
poin di gunakan -100    2.000.000
________________________________
Subtotal              36.500.000
TOTAL                 29.500.000

Bayar                 31.000.000
Kembali                1.500.000
metode             Transfer Bank
poin                        +50
________________________________

terima kasih sudah berbelanja

```

**Data:**
- Items: MacBook, Mouse (2x), USB Cable (3x), Apple Care
- Subtotal: 36.500.000
- Diskon: 5.000.000
- Poin digunakan: 100 (nilai 2.000.000)
- Total: 29.500.000
- Bayar: 31.000.000
- Kembali: 1.500.000
- Metode: Transfer Bank
- Poin didapat: +50

---

## Preview 5: Multiple Items dengan Berbagai Harga

```
            MINIMARKET LANGGENG
           Jl. Gatot Subroto No. 12
________________________________
No.ID :              INV-ML-98765
Tanggal :       07-06-2026,15.20
Pelanggan :            Regular
                        Anonim
________________________________
Beras 5kg              
1 x 65.000               65.000
Minyak Goreng 2L       
1 x 28.000               28.000
Gula Pasir 1kg         
2 x 12.000               24.000
Telur 10 butir         
1 x 22.000               22.000
Roti Tawar Putih       
3 x 8.000                24.000
Teh Kotak 250ml        
6 x 3.000                18.000

Diskon                    5.000
________________________________
Subtotal                181.000
TOTAL                   176.000

Bayar                   200.000
Kembali                  24.000
metode                    Tunai
________________________________

terima kasih sudah berbelanja

```

---

## Preview 6: Multiple Transactions Comparison

### Scenario A: High-value Single Item
```
Produk: Laptop Gaming 1x Rp 25.000.000
Total: Rp 25.000.000 (90 mm paper width)
```

### Scenario B: Many Items
```
Produk: 15+ items dari supermarket
Total: Rp 500.000+
Paper akan lebih panjang
```

### Scenario C: Micro-transactions
```
Produk: Kopi + Snack ringan
Total: < Rp 50.000
Paper pendek dan cepat
```

---

## Fitur-fitur Format:

### ✓ Automatic Formatting
- Harga otomatis pakai thousand separator (18.000 bukan 18000)
- Tanggal Indonesia format DD-MM-YYYY,HH.MM
- Alignment otomatis sesuai lebar paper

### ✓ Smart Padding
- Nama produk di baris pertama (left align)
- Harga di baris kedua dengan total di kanan (right align)
- Separator line otomatis dengan lebar 32 karakter

### ✓ Conditional Fields
- Diskon hanya muncul jika ada
- Poin hanya muncul jika ada
- Member/Regular label sesuai tipe pelanggan
- Poin didapat hanya untuk member

### ✓ Dynamic Content
- Center text otomatis untuk header
- Right align otomatis untuk angka
- Left align otomatis untuk label

---

## Testing Output

Untuk melihat output real-time, jalankan di console browser:

```javascript
// Import di console
import { generateReceiptRaw } from '/src/lib/bluetooth-printer.ts';
import { testAllExamples } from '/src/lib/receipt-example.ts';

// Test semua contoh
testAllExamples();

// Atau individual
import { exampleBasicReceipt } from '/src/lib/receipt-example.ts';
console.log(exampleBasicReceipt());

// Copy ke editor text untuk melihat lebih jelas formatting
navigator.clipboard.writeText(exampleBasicReceipt());
```

---

## Notes Teknis

### Paper Width
- Standard thermal printer: 32 karakter
- Separator: 32 underscore
- Centered text: otomatis calculate padding
- Right-aligned numbers: padStart dengan space

### Character Encoding
- Menggunakan UTF-8
- Umlauts dan special chars tersupport
- Nama produk bisa sampai 25+ karakter (akan wrap di printer)

### Print Sequence
1. Initialize printer (ESC@)
2. Center alignment (ESC a 01)
3. Header
4. Left alignment (ESC a 00)
5. Transaction info
6. Items
7. Totals
8. Payment info
9. Center footer
10. Cut paper (GS V)

---

## Kompatibilitas Printer

Format ini kompatibel dengan:
- Thermal Printer 80mm (thermal58 atau thermal80)
- Thermal Printer 58mm (standar POS kasir)
- Receipt Printer dengan ESC/POS support
- Epson thermal printers
- Xprinter thermal printers
- ZJiang thermal printers

