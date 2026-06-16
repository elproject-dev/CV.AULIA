/**
 * Contoh Implementasi Receipt Raw Print
 * File: src/lib/receipt-example.ts
 */

import {
  generateReceiptRaw,
  generateReceiptRawWithLogo,
  printSimpleReceipt,
  printReceiptWithLogo,
  connectToPrinter,
  ReceiptData,
  ReceiptItem,
} from './bluetooth-printer';

// ==================== EXAMPLE 1: Basic Receipt ====================

export function exampleBasicReceipt(): string {
  const receiptData: ReceiptData = {
    storeName: 'Sbagiamu',
    storeAddress: 'jl.condong catur no 13 yk',
    invoiceNumber: 'INV-A00001',
    date: new Date('2026-05-12T12:01:00'),
    customerName: 'Jokowi',
    customerType: 'member',
    items: [
      {
        productName: 'Nasi Goreng',
        quantity: 1,
        price: 18000,
      },
      {
        productName: 'Es Teh',
        quantity: 1,
        price: 3000,
      },
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

  return generateReceiptRaw(receiptData);
}

// ==================== EXAMPLE 2: With Tax ====================

export function exampleReceiptWithTax(): string {
  const items: ReceiptItem[] = [
    { productName: 'Burger King', quantity: 2, price: 35000 },
    { productName: 'Coca Cola', quantity: 2, price: 8000 },
    { productName: 'Fries', quantity: 1, price: 15000 },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const tax = Math.round(subtotal * 0.1); // 10% tax
  const total = subtotal + tax;

  const receiptData: ReceiptData = {
    storeName: 'WARUNG MAKAN LEZAT',
    storeAddress: 'Jl. Sudirman No. 45',
    invoiceNumber: 'INV-B00234',
    date: new Date(),
    customerName: 'Pembeli Reguler',
    customerType: 'regular',
    items,
    subtotal,
    discount: 0,
    total,
    amountPaid: 150000,
    change: 150000 - total,
    paymentMethod: 'Tunai',
  };

  return generateReceiptRaw(receiptData);
}

// ==================== EXAMPLE 3: Member with Points ====================

export function exampleReceiptMemberWithPoints(): string {
  const items: ReceiptItem[] = [
    { productName: 'Cappuccino', quantity: 1, price: 25000 },
    { productName: 'Brownies', quantity: 2, price: 15000 },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const pointsRedeemed = 50;
  const pointsValue = 10000; // 1 poin = 200, jadi 50 poin = 10000
  const discount = 5000;
  const total = subtotal - pointsValue - discount;

  const receiptData: ReceiptData = {
    storeName: 'KOPI ENAK',
    storeAddress: 'Jl. Ahmad Yani No. 88',
    invoiceNumber: 'INV-M12345',
    date: new Date(),
    customerName: 'Budi Santoso',
    customerType: 'member',
    items,
    subtotal,
    discount,
    pointsRedeemed,
    pointsValue,
    total,
    amountPaid: 50000,
    change: 50000 - total,
    paymentMethod: 'Tunai',
    earnedPoints: Math.floor(total / 5000), // setiap 5000 dapat 1 poin
  };

  return generateReceiptRaw(receiptData);
}

// ==================== EXAMPLE 4: Large Transaction ====================

export function exampleLargeTransaction(): string {
  const items: ReceiptItem[] = [
    { productName: 'MacBook Pro M3', quantity: 1, price: 25000000 },
    { productName: 'Apple Magic Mouse', quantity: 2, price: 2500000 },
    { productName: 'USB-C Cable', quantity: 3, price: 500000 },
    { productName: 'Apple Care+', quantity: 1, price: 5000000 },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discount = 5000000; // 5 juta diskon
  const pointsRedeemed = 100;
  const pointsValue = 2000000; // 100 poin = 2 juta
  const total = subtotal - discount - pointsValue;

  const receiptData: ReceiptData = {
    storeName: 'APPLE STORE',
    storeAddress: 'Plaza Indonesia, Jakarta',
    invoiceNumber: 'INV-APPLE-2026-001',
    date: new Date(),
    customerName: 'Corporate Buyer',
    customerType: 'member',
    items,
    subtotal,
    discount,
    pointsRedeemed,
    pointsValue,
    total,
    amountPaid: 31000000,
    change: 31000000 - total,
    paymentMethod: 'Transfer Bank',
    earnedPoints: 50,
  };

  return generateReceiptRaw(receiptData);
}

// ==================== EXAMPLE 5: With Logo (Sbagiamu) ====================

export async function exampleReceiptWithLogo(): Promise<string> {
  const items: ReceiptItem[] = [
    { productName: 'Nasi Goreng', quantity: 2, price: 18000 },
    { productName: 'Es Teh', quantity: 2, price: 3000 },
    { productName: 'Lumpia', quantity: 1, price: 8000 },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discount = 0;
  const total = subtotal - discount;

  const receiptData: ReceiptData = {
    storeName: 'SBAGIAMU',
    storeAddress: 'jl.condong catur no 13 yk',
    logoPath: '/sbagiamu.png', // Logo dari public folder
    invoiceNumber: 'INV-SBG-2026-001',
    date: new Date(),
    customerName: 'Pelanggan Setia',
    customerType: 'member',
    items,
    subtotal,
    discount,
    total,
    amountPaid: 100000,
    change: 100000 - total,
    paymentMethod: 'Tunai',
    earnedPoints: Math.floor(total / 5000),
    footerMessage: 'terima kasih sudah berbelanja di Sbagiamu!',
  };

  // Gunakan generateReceiptRawWithLogo untuk include gambar
  return await generateReceiptRawWithLogo(receiptData);
}

// ==================== PRINT FUNCTIONS ====================

/**
 * Print example receipt ke printer
 */
export async function printExampleReceipt(
  exampleType: 'basic' | 'tax' | 'member' | 'large' | 'with-logo'
): Promise<boolean> {
  try {
    let receiptText = '';

    switch (exampleType) {
      case 'basic':
        receiptText = exampleBasicReceipt();
        break;
      case 'tax':
        receiptText = exampleReceiptWithTax();
        break;
      case 'member':
        receiptText = exampleReceiptMemberWithPoints();
        break;
      case 'large':
        receiptText = exampleLargeTransaction();
        break;
      case 'with-logo':
        receiptText = await exampleReceiptWithLogo();
        break;
    }

    console.log('Preview:');
    console.log(receiptText);

    // Uncomment untuk print ke printer (perlu printer connected)
    // const printerMac = localStorage.getItem('bluetoothPrinterMac');
    // if (printerMac) {
    //   await connectToPrinter(printerMac);
    //   return await printSimpleReceipt(receiptData);
    // }

    return true;
  } catch (error) {
    console.error('Error printing example receipt:', error);
    return false;
  }
}

// ==================== CONVERT FROM TRANSACTION ====================

/**
 * Convert dari data transaksi database ke ReceiptData
 * Contoh:
 * const receipt = transactionToReceiptData(transaction, storeConfig);
 */
export function transactionToReceiptData(
  transaction: any,
  storeConfig: {
    storeName: string;
    storeAddress: string;
  }
): ReceiptData {
  const items: ReceiptItem[] = transaction.items.map((item: any) => ({
    productName: item.product.name,
    quantity: item.quantity,
    price: item.price,
  }));

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  return {
    storeName: storeConfig.storeName,
    storeAddress: storeConfig.storeAddress,
    invoiceNumber: transaction.invoice_number,
    date: new Date(transaction.created_at),
    customerName: transaction.customer?.name || 'Pembeli',
    customerType: transaction.customer?.type === 'member' ? 'member' : 'regular',
    items,
    subtotal,
    discount: transaction.discount || 0,
    pointsRedeemed: transaction.points_redeemed || 0,
    pointsValue: transaction.points_value || 0,
    total: transaction.total,
    amountPaid: transaction.amount_paid,
    change: transaction.change,
    paymentMethod: translatePaymentMethod(transaction.payment_method),
    earnedPoints: transaction.earned_points || 0,
  };
}

function translatePaymentMethod(method: string): string {
  const translations: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer Bank',
    debit_card: 'Debit',
    credit_card: 'Kredit',
    qris: 'QRIS',
    e_wallet: 'E-Wallet',
  };
  return translations[method] || method;
}

// ==================== TESTING ====================

export function testAllExamples(): void {
  console.log('=== EXAMPLE 1: Basic Receipt ===');
  console.log(exampleBasicReceipt());

  console.log('\n=== EXAMPLE 2: Receipt with Tax ===');
  console.log(exampleReceiptWithTax());

  console.log('\n=== EXAMPLE 3: Member with Points ===');
  console.log(exampleReceiptMemberWithPoints());

  console.log('\n=== EXAMPLE 4: Large Transaction ===');
  console.log(exampleLargeTransaction());
}

// Jalankan di console: testAllExamples()
