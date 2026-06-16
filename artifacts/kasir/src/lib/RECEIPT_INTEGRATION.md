/**
 * Integration Guide - Receipt Print dalam Aplikasi
 * Lokasi: src/lib/receipt-integration.md
 */

# Integrasi Receipt Print dengan Aplikasi Kasir

## Lokasi Implementasi

### 1. Di halaman POS (`src/pages/pos.tsx`)

```typescript
import { printSimpleReceipt, connectToPrinter } from '@/lib/bluetooth-printer';
import { transactionToReceiptData } from '@/lib/receipt-example';

// Dalam komponen POS
const handlePrintReceipt = async () => {
  try {
    // Get printer MAC dari settings
    const printerMac = localStorage.getItem('bluetoothPrinterMac');
    if (!printerMac) {
      toast({
        title: 'Error',
        description: 'Printer belum dikonfigurasi. Silakan atur di Settings.',
        variant: 'destructive',
      });
      return;
    }

    // Connect ke printer
    const connectResult = await connectToPrinter(printerMac);
    if (!connectResult.success) {
      toast({
        title: 'Error',
        description: connectResult.message,
        variant: 'destructive',
      });
      return;
    }

    // Prepare receipt data
    const receiptData = {
      storeName: 'Sbagiamu',
      storeAddress: 'jl.condong catur no 13 yk',
      invoiceNumber: transaction.invoice_number,
      date: new Date(transaction.created_at),
      customerName: transaction.customer?.name || 'Pembeli',
      customerType: transaction.customer?.type === 'member' ? 'member' : 'regular',
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
      paymentMethod: translatePaymentMethod(transaction.payment_method),
      earnedPoints: transaction.earned_points,
    };

    // Print
    const success = await printSimpleReceipt(receiptData);
    if (success) {
      toast({
        title: 'Success',
        description: 'Nota berhasil dicetak',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Gagal mencetak nota',
        variant: 'destructive',
      });
    }
  } catch (error) {
    console.error('Error printing receipt:', error);
    toast({
      title: 'Error',
      description: 'Terjadi kesalahan saat mencetak nota',
      variant: 'destructive',
    });
  }
};
```

### 2. Di halaman Transactions (`src/pages/transactions.tsx`)

```typescript
// Import
import { printSimpleReceipt, connectToPrinter } from '@/lib/bluetooth-printer';

// Function untuk print individual transaction
const handlePrintSingleReceipt = async (transaction: any) => {
  try {
    const printerMac = localStorage.getItem('bluetoothPrinterMac');
    if (!printerMac) {
      alert('Printer belum dikonfigurasi');
      return;
    }

    await connectToPrinter(printerMac);

    const receiptData = transactionToReceiptData(transaction, {
      storeName: 'Sbagiamu',
      storeAddress: 'jl.condong catur no 13 yk',
    });

    const success = await printSimpleReceipt(receiptData);
    if (success) {
      alert('Nota berhasil dicetak');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Gagal mencetak nota');
  }
};

// Dalam render/JSX
<Button
  variant="outline"
  size="sm"
  onClick={() => handlePrintSingleReceipt(transaction)}
>
  <Printer className="w-4 h-4 mr-2" />
  Print
</Button>
```

### 3. Di Settings (`src/pages/settings.tsx`)

```typescript
import {
  connectToPrinter,
  listBluetoothDevices,
  setBluetoothPrinterMac,
} from '@/lib/bluetooth-printer';

// Component untuk select printer
const PrinterSettings = () => {
  const [devices, setDevices] = useState<Array<{ name: string; address: string }>>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(
    localStorage.getItem('bluetoothPrinterMac') || ''
  );
  const [loading, setLoading] = useState(false);

  const handleScanDevices = async () => {
    setLoading(true);
    try {
      const result = await listBluetoothDevices();
      if (result.success) {
        setDevices(result.devices);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error scanning devices:', error);
      alert('Gagal scan devices');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrinter = (mac: string) => {
    setSelectedPrinter(mac);
    localStorage.setItem('bluetoothPrinterMac', mac);
    alert('Printer tersimpan');
  };

  const handleTestPrinter = async () => {
    try {
      const result = await connectToPrinter(selectedPrinter);
      if (result.success) {
        alert('Berhasil terhubung ke printer');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Gagal test printer');
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleScanDevices} disabled={loading}>
        {loading ? 'Scanning...' : 'Scan Devices'}
      </Button>

      {devices.length > 0 && (
        <div>
          <h3>Printer yang Tersedia:</h3>
          <div className="space-y-2">
            {devices.map((device) => (
              <div key={device.address} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="printer"
                  value={device.address}
                  checked={selectedPrinter === device.address}
                  onChange={(e) => handleSelectPrinter(e.target.value)}
                />
                <label>{device.name}</label>
                <span className="text-sm text-gray-500">({device.address})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPrinter && (
        <Button onClick={handleTestPrinter}>Test Printer</Button>
      )}
    </div>
  );
};
```

---

## Helper Function: Translate Payment Method

```typescript
// Tambahkan di bluetooth-printer.ts atau receipt-example.ts
function translatePaymentMethod(method: string): string {
  const translations: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    debit_card: 'Debit',
    credit_card: 'Kredit',
    qris: 'QRIS',
    e_wallet: 'E-Wallet',
  };
  return translations[method] || method;
}
```

---

## Auto-Print Configuration

Untuk auto-print saat selesai transaksi:

```typescript
// Di POS.tsx - setelah transaksi berhasil
const handleCheckout = async () => {
  try {
    // ... save transaction to database ...

    // Auto print jika enabled
    const autoPrint = localStorage.getItem('autoPrint') === 'true';
    if (autoPrint) {
      const printerMac = localStorage.getItem('bluetoothPrinterMac');
      if (printerMac) {
        await connectToPrinter(printerMac);
        await printSimpleReceipt(receiptData);
      }
    }

    // Show success
    toast({ title: 'Success', description: 'Transaksi berhasil' });
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## Error Handling

```typescript
// Comprehensive error handling
const printWithErrorHandling = async (receiptData: ReceiptData) => {
  try {
    const printerMac = localStorage.getItem('bluetoothPrinterMac');

    if (!printerMac) {
      throw new Error('Printer belum dikonfigurasi');
    }

    const connectResult = await connectToPrinter(printerMac);
    if (!connectResult.success) {
      throw new Error(connectResult.message);
    }

    const printResult = await printSimpleReceipt(receiptData);
    if (!printResult) {
      throw new Error('Gagal mengirim data ke printer');
    }

    return { success: true, message: 'Nota berhasil dicetak' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Print error:', errorMessage);
    return {
      success: false,
      message: `Error: ${errorMessage}`,
    };
  }
};
```

---

## Print Preview (untuk testing tanpa printer)

```typescript
import { generateReceiptRaw } from '@/lib/bluetooth-printer';

// Component untuk preview
const PrintPreview = ({ receiptData }: { receiptData: ReceiptData }) => {
  const preview = generateReceiptRaw(receiptData);

  return (
    <pre
      className="bg-gray-100 p-4 rounded font-mono text-sm overflow-auto"
      style={{
        fontFamily: 'Courier New, monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '600px',
      }}
    >
      {preview}
    </pre>
  );
};
```

---

## Complete Integration Example

```typescript
// Minimal working example
import {
  generateReceiptRaw,
  printSimpleReceipt,
  connectToPrinter,
  ReceiptData,
} from '@/lib/bluetooth-printer';

// Step 1: Prepare data
const receiptData: ReceiptData = {
  invoiceNumber: 'INV-001',
  date: new Date(),
  customerName: 'John Doe',
  items: [
    { productName: 'Item 1', quantity: 1, price: 50000 },
    { productName: 'Item 2', quantity: 2, price: 25000 },
  ],
  subtotal: 100000,
  total: 100000,
  amountPaid: 100000,
  change: 0,
};

// Step 2: For preview
const preview = generateReceiptRaw(receiptData);
console.log(preview);

// Step 3: For printing
const printerMac = localStorage.getItem('bluetoothPrinterMac');
if (printerMac) {
  await connectToPrinter(printerMac);
  await printSimpleReceipt(receiptData);
}
```

---

## Testing Checklist

- [ ] Test dengan berbagai jumlah items (1-20 items)
- [ ] Test dengan berbagai harga (Rp 1.000 - Rp 999.999.999)
- [ ] Test member vs regular customer
- [ ] Test dengan diskon
- [ ] Test dengan poin redemption
- [ ] Test payment methods (Tunai, Transfer, dll)
- [ ] Test dengan nama produk panjang
- [ ] Test dengan nama customer panjang
- [ ] Test print preview tanpa printer
- [ ] Test connection error handling
- [ ] Test printer disconnection
- [ ] Test auto-print feature
