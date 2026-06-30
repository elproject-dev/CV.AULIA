import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import { FileDown, Calendar, UserCircle, History, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import {
  formatInvoiceNumber,
  formatPaymentMethod,
  formatRupiahValue,
} from "@/lib/formatters";
import { useListStaff } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTauri, tauriSaveFile } from "@/lib/tauri-file";

// Types
interface TransactionItem {
  productName: string;
  price: number;
  quantity: number;
  qtyReturn?: number;
  returnAmount?: number;
  netTotal?: number;
  kasMasuk?: number;
  sisaPiutang?: number;
  hpp?: number;
  margin?: number;
}

interface Transaction {
  id: string;
  createdAt: string;
  items: TransactionItem[];
  customerName?: string;
  customerId?: string | number;
  customerPhone?: string;
  customerAddress?: string;
  customerDistrict?: string;
  customerCity?: string;
  paymentMethod?: string;
  discount?: number;
  discountNote?: string;
  total: number;
  totalReturn?: number;
  netTotal?: number;
  totalKasMasuk?: number;
  totalSisaPiutang?: number;
  totalHpp?: number;
  totalMargin?: number;
  cashierName?: string;
  outletId?: number;
  tax?: number;
  paymentStatus?: string;
  dueDate?: string;
  remainingBalance?: number;
}

interface ExportColumn {
  header: string;
  key: string;
  width: number;
}

interface ExportOptions {
  title: string;
  sheetName: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  rowStripes: number[];
  filename: string;
}

// Default column widths for transaction export
const DEFAULT_COL_WIDTHS: ExportColumn[] = [
  { header: "Tanggal", key: "Tanggal", width: 15 },
  { header: "Jam", key: "Jam", width: 10 },
  { header: "No.Transaksi", key: "No.Transaksi", width: 20 },
  { header: "ID Pelanggan", key: "ID Pelanggan", width: 15 },
  { header: "Nama Pelanggan", key: "Nama Pelanggan", width: 30 },
  { header: "No. Telepon", key: "No. Telepon", width: 15 },
  { header: "Alamat", key: "Alamat", width: 30 },
  { header: "Kecamatan", key: "Kecamatan", width: 20 },
  { header: "Kabupaten", key: "Kabupaten", width: 20 },
  { header: "Nama Produk", key: "Nama Produk", width: 35 },
  { header: "Qty", key: "Qty", width: 8 },
  { header: "Harga", key: "Harga", width: 15 },
  { header: "Total", key: "Total", width: 15 },
  { header: "Qty Retur", key: "Qty Retur", width: 10 },
  { header: "Nominal Retur", key: "Nominal Retur", width: 15 },
  { header: "Sisa Piutang", key: "Sisa Piutang", width: 15 },
  { header: "Total Akhir", key: "Total Akhir", width: 15 },
  { header: "HPP", key: "HPP", width: 15 },
  { header: "Margin", key: "Margin", width: 15 },
  { header: "Pembayaran", key: "Pembayaran", width: 15 },
  { header: "Tipe Pembayaran", key: "Tipe Pembayaran", width: 15 },
  { header: "Jatuh Tempo", key: "Jatuh Tempo", width: 15 },
  { header: "Salesman", key: "Salesman", width: 15 },
  { header: "Period Month", key: "Period Month", width: 15 },
  { header: "Period Year", key: "Period Year", width: 12 },
];

const CENTER_ALIGNED_KEYS = new Set([
  "Tanggal",
  "Jam",
  "Period Month",
  "Period Year",
  "No.Transaksi",
  "ID Pelanggan",
  "No. Telepon",
  "Kecamatan",
  "Kabupaten",
  "Qty",
  "Qty Retur",
  "Diskon",
  "No",
  "Poin",
  "Bergabung Sejak",
  "Pembayaran",
  "Tipe Pembayaran",
  "Jatuh Tempo",
]);

const RIGHT_ALIGNED_KEYS = new Set([
  "Harga",
  "Total",
  "Nominal Retur",
  "Sisa Piutang",
  "Total Akhir",
  "HPP",
  "Margin",
  "PPN",
  "Grand Total",
  "Salesman",
  "Total Belanja",
]);

// Columns that need thousand separator format (numbers only)
const THOUSAND_FORMAT_KEYS = new Set(["Harga", "Total", "Nominal Retur", "Sisa Piutang", "Total Akhir", "HPP", "Margin", "Diskon", "PPN", "Grand Total", "Total Belanja"]);

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid" as const, fgColor: { rgb: "000000" } },
  alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: false },
};

const STRIPE_WHITE = { patternType: "solid" as const, fgColor: { rgb: "FFFFFF" } };
const STRIPE_GRAY = { patternType: "solid" as const, fgColor: { rgb: "F2F2F2" } };

const GRID_BORDER = {
  top: { style: "thin" as const, color: { rgb: "CCCCCC" } },
  bottom: { style: "thin" as const, color: { rgb: "CCCCCC" } },
  left: { style: "thin" as const, color: { rgb: "CCCCCC" } },
  right: { style: "thin" as const, color: { rgb: "CCCCCC" } },
};

function getColumnAlignment(colKey: string): "left" | "center" | "right" {
  if (RIGHT_ALIGNED_KEYS.has(colKey)) return "right";
  if (CENTER_ALIGNED_KEYS.has(colKey)) return "center";
  return "left";
}

// Utility functions
function formatJatuhTempo(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  
  const day = date.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

function formatDateForFileName(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateForExcel(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  const day = date.getDate();
  const month = new Intl.DateTimeFormat("id-ID", { month: "long" })
    .format(date)
    .toLowerCase();
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function formatTimeForExcel(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function getPeriodMonth(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(date);
}

function getPeriodYear(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return String(date.getFullYear());
}

function formatExcelRupiah(value: number | undefined | null): number {
  // Return raw number so Excel can use SUM formula
  return Number(value) || 0;
}

// Number format with thousand separator for Excel
const RUPIAH_FORMAT = "#,##0";
const RUPIAH_DASH_FORMAT = `#,##0;-#,##0;"-"`;

function formatExcelCount(value: number | undefined | null): number {
  return Number(value) || 0;
}

function applyWorksheetStyles(
  ws: XLSX.WorkSheet,
  columns: ExportColumn[],
  rowStripes: number[]
): { lastDataRow: number } {
  const rangeRef = ws["!ref"];
  if (!rangeRef) return { lastDataRow: 0 };

  const range = XLSX.utils.decode_range(rangeRef);
  // range.e.r is 0-indexed, need +1 for 1-indexed Excel row number
  const lastDataRow = range.e.r + 1;

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: "s", v: "" };
      }
      const cell = ws[cellRef];

      const colKey = columns[col]?.key ?? "";
      const isHeader = row === range.s.r;
      const alignment = {
        horizontal: getColumnAlignment(colKey),
        vertical: "center" as const,
        wrapText: false,
      };

      if (isHeader) {
        cell.s = {
          ...HEADER_STYLE,
          alignment,
          border: GRID_BORDER,
        };
        continue;
      }

      const stripe = rowStripes[row - range.s.r - 1] ?? 0;
      const cellStyle: Record<string, unknown> = {
        alignment,
        fill: stripe === 0 ? STRIPE_WHITE : STRIPE_GRAY,
        border: GRID_BORDER,
      };

      // Apply thousand separator format for numeric columns and ensure number type
      if (THOUSAND_FORMAT_KEYS.has(colKey)) {
        const fmt = (colKey === "Diskon" || colKey === "Tukar Poin") ? RUPIAH_DASH_FORMAT : RUPIAH_FORMAT;
        cellStyle.numFmt = fmt;
        cell.z = fmt;
        // Force number type if cell has numeric value
        if (typeof cell.v === 'number' || !isNaN(Number(cell.v))) {
          if (typeof cell.v !== 'number') {
            cell.v = Number(cell.v);
          }
          cell.t = 'n';
        }
      }

      cell.s = cellStyle;
    }
  }

  return { lastDataRow };
}

// Core export function
export async function exportToExcel(options: ExportOptions): Promise<void> {
  const { sheetName, columns, data, rowStripes, filename } = options;

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = columns.map((col) => ({ wch: col.width }));
  applyWorksheetStyles(ws, columns, rowStripes);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  if (Capacitor.isNativePlatform()) {
    // Android/iOS: Save to filesystem and share
    const base64Data = await blobToBase64(blob);
    const fileName = filename;

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    const filePath = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: "Download Laporan Excel",
      url: filePath.uri,
    });
  } else if (isTauri()) {
    // Tauri desktop: Use native save dialog
    await tauriSaveFile(
      excelBuffer,
      filename,
      [{ name: "Excel Files", extensions: ["xlsx"] }]
    );
  } else {
    // Web: Use traditional download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Transform transactions to exportable data
interface Outlet {
  id: number;
  name: string;
}

function transformTransactions(
  transactions: Transaction[],
  branchName?: string,
  cashierDefault: string = "Admin Kasir",
  outlets: Outlet[] = [],
  isAdmin: boolean = true
): { data: Record<string, unknown>[]; rowStripes: number[] } {
  const data: Record<string, unknown>[] = [];
  const rowStripes: number[] = [];

  // Create a map for quick outlet lookup
  const outletMap = new Map(outlets.map(o => [o.id, o.name]));

  // Gunakan nama cabang/outlet dari pengaturan (localStorage)
  const storedOutletId = typeof window !== "undefined" ? localStorage.getItem('selectedOutletId') : null;
  const selectedOutletName = (storedOutletId && storedOutletId !== 'unselected')
    ? outletMap.get(parseInt(storedOutletId))
    : (storedOutletId === 'unselected' ? 'Belum di pilih' : null);

  const storedBranch = typeof window !== "undefined" ? localStorage.getItem('storeBranch') : null;
  const storedAddress = typeof window !== "undefined" ? localStorage.getItem('storeAddress') : null;
  const actualBranchName = selectedOutletName || (typeof storedBranch === 'string' && storedBranch.trim()) || (typeof storedAddress === 'string' && storedAddress.trim()) || branchName || "CV.AULIA USAHA";

  transactions.forEach((trx, trxIndex) => {
    const stripe = trxIndex % 2;
    const transactionId = Number(trx.id);

    const baseRow = {
      Tanggal: formatDateForExcel(trx.createdAt),
      Jam: formatTimeForExcel(trx.createdAt),
      "No.Transaksi": Number.isFinite(transactionId) ? formatInvoiceNumber(transactionId) : "-",
      "ID Pelanggan": trx.customerId || "-",
      "Nama Pelanggan": trx.customerName || "Umum",
      "No. Telepon": trx.customerPhone || "-",
      Alamat: trx.customerAddress || "-",
      Kecamatan: trx.customerDistrict || "-",
      Kabupaten: trx.customerCity || "-",
    };

    const salesman = trx.cashierName || cashierDefault;
    const periodMonth = getPeriodMonth(trx.createdAt);
    const periodYear = getPeriodYear(trx.createdAt);
    const pembayaran = String(trx.paymentMethod || "-").toUpperCase();
    const tipePembayaranRaw = String(trx.paymentStatus || "-");
    const tipePembayaran = tipePembayaranRaw === 'paid' ? 'Lunas' : tipePembayaranRaw === 'partial' ? 'Cicilan' : tipePembayaranRaw === 'unpaid' ? 'Belum Lunas' : tipePembayaranRaw;

    let jatuhTempoStr = "-";
    if (tipePembayaranRaw === 'partial' || tipePembayaranRaw === 'unpaid') {
      jatuhTempoStr = formatJatuhTempo(trx.dueDate);
    }

    if (trx.items && trx.items.length > 0) {
      trx.items.forEach((item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const subtotal = price * qty;

        const qtyReturn = Number(item.qtyReturn) || 0;
        const netTotal = Number(item.netTotal) ?? subtotal;
        const kasMasuk = Number(item.kasMasuk) || 0;
        const sisaPiutang = Number(item.sisaPiutang) || 0;
        const hpp = Number(item.hpp) || 0;
        const margin = Number(item.margin) || 0;

        const returnAmount = Number(item.returnAmount) || 0;

        data.push({
          ...baseRow,
          "Nama Produk": item.productName || "-",
          Qty: formatExcelCount(qty),
          Harga: formatExcelRupiah(price),
          Total: formatExcelRupiah(subtotal),
          "Qty Retur": formatExcelCount(qtyReturn),
          "Nominal Retur": formatExcelRupiah(returnAmount),
          "Sisa Piutang": formatExcelRupiah(sisaPiutang),
          "Total Akhir": formatExcelRupiah(kasMasuk),
          ...(isAdmin ? {
            HPP: formatExcelRupiah(hpp),
            Margin: formatExcelRupiah(margin),
          } : {}),
          Pembayaran: pembayaran,
          "Tipe Pembayaran": tipePembayaran,
          "Jatuh Tempo": jatuhTempoStr,
          Salesman: salesman,
          "Period Month": periodMonth,
          "Period Year": periodYear,
        });
        rowStripes.push(stripe);
      });
    } else {
      data.push({
        ...baseRow,
        "Nama Produk": "-",
        Qty: "-",
        Harga: "-",
        Total: "-",
        "Qty Retur": "-",
        "Nominal Retur": "-",
        "Sisa Piutang": "-",
        "Total Akhir": "-",
        ...(isAdmin ? {
          HPP: "-",
          Margin: "-",
        } : {}),
        Pembayaran: pembayaran,
        "Tipe Pembayaran": tipePembayaran,
        "Jatuh Tempo": jatuhTempoStr,
        Salesman: salesman,
        "Period Month": periodMonth,
        "Period Year": periodYear,
      });
      rowStripes.push(stripe);
    }
  });

  return { data, rowStripes };
}

// Map raw Supabase/API transactions to export format
export function mapApiTransactionsToExport(
  transactions: Record<string, unknown>[],
  returnsData: Record<string, unknown>[] = [],
  productsData: Record<string, unknown>[] = []
): Transaction[] {
  const hppMap = new Map<string, number>();
  productsData.forEach(p => {
    hppMap.set(String(p.id), Number(p.hpp) || 0);
  });

  return (transactions || []).map((trx) => {
    const subtotal = Number(trx.subtotal) || 0;
    const total = subtotal;

    // Process returns for this transaction
    const trxReturns = returnsData.filter(r => String(r.transaction_id) === String(trx.id) && r.status === 'completed');
    let totalReturnAmount = 0;
    const returnItemMap = new Map<string, { qty: number, amount: number }>();

    trxReturns.forEach(ret => {
      totalReturnAmount += Number(ret.total_refund) || 0;
      const items = (ret.sales_return_items || []) as Record<string, unknown>[];
      items.forEach(rItem => {
        const pId = rItem.product_id ? String(rItem.product_id) : '';
        const pName = rItem.product_name ? String(rItem.product_name) : '';
        const key = pId || pName;

        const uoms = (rItem.products as any)?.product_uoms || [];
        const uom = uoms.find((u: any) => u.unit_name === rItem.unit_name);
        const conversionFactor = uom ? Number(uom.conversion_factor) : 1;

        const rQty = (Number(rItem.quantity) || 0) * conversionFactor;
        const rAmt = Number(rItem.subtotal) || Number(rItem.refund_amount) || 0;

        if (key) {
          const current = returnItemMap.get(key) || { qty: 0, amount: 0 };
          returnItemMap.set(key, {
            qty: current.qty + rQty,
            amount: current.amount + rAmt
          });
        }
      });
    });

    const netTotal = Math.max(0, total - totalReturnAmount);

    const rawItems = (trx.transaction_items || trx.items || []) as Record<string, unknown>[];
    const customer = trx.customers as {
      name?: string,
      id?: string | number,
      customer_id_manual?: string,
      phone?: string,
      address?: string,
      district?: string,
      city?: string
    } | null | undefined;
    const discountNote = String(trx.discount_note ?? trx.discountNote ?? "").trim() || undefined;

    const trxRemaining = Math.max(0, Number(trx.remaining_balance ?? trx.remainingBalance) || 0);
    const trxKasMasuk = Math.max(0, netTotal - trxRemaining);
    const paymentRatio = netTotal > 0 ? trxKasMasuk / netTotal : 0;

    let totalHpp = 0;
    let totalMargin = 0;

    const mappedItems = rawItems.map((item) => {
      const pId = item.product_id ? String(item.product_id) : '';
      const pName = String(item.product_name ?? item.productName ?? "-");
      const key = pId || pName;

      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      const itemSubtotal = price * quantity;

      const rData = returnItemMap.get(key) || { qty: 0, amount: 0 };
      const itemNet = Math.max(0, itemSubtotal - rData.amount);

      const itemKasMasuk = itemNet * paymentRatio;
      const itemSisaPiutang = itemNet - itemKasMasuk;

      const netQty = Math.max(0, quantity - rData.qty);
      const hppPerUnit = hppMap.get(pId) || 0;

      const fullItemHpp = netQty * hppPerUnit;
      const fullItemMargin = itemNet - fullItemHpp;

      const itemHpp = fullItemHpp * paymentRatio;
      const itemMargin = fullItemMargin * paymentRatio;

      totalHpp += itemHpp;
      totalMargin += itemMargin;

      return {
        productName: pName,
        price,
        quantity,
        qtyReturn: rData.qty,
        returnAmount: rData.amount,
        netTotal: itemNet,
        kasMasuk: itemKasMasuk,
        sisaPiutang: itemSisaPiutang,
        hpp: itemHpp,
        margin: itemMargin,
      };
    });

    return {
      id: String(trx.id ?? ""),
      createdAt: String(trx.created_at ?? trx.createdAt ?? ""),
      customerName: customer?.name || (trx.customerName as string | undefined) || "Umum",
      customerId: customer?.customer_id_manual || (trx.customer_id_manual as string | undefined) || customer?.id || (trx.customer_id ?? trx.customerId) as string | number | undefined,
      customerPhone: customer?.phone || (trx.customerPhone as string | undefined) || "-",
      customerAddress: customer?.address || (trx.customerAddress as string | undefined) || "-",
      customerDistrict: customer?.district || (trx.customerDistrict as string | undefined) || "-",
      customerCity: customer?.city || (trx.customerCity as string | undefined) || "-",
      paymentMethod: String(trx.payment_method ?? trx.paymentMethod ?? ""),
      items: mappedItems,
      discount: 0,
      discountNote,
      tax: 0,
      total,
      totalReturn: totalReturnAmount,
      netTotal,
      totalKasMasuk: trxKasMasuk,
      totalSisaPiutang: trxRemaining,
      totalHpp,
      totalMargin,
      cashierName: (trx.cashier_name ?? trx.cashierName) as string | undefined,
      outletId: Number(trx.outlet_id ?? trx.outletId) || undefined,
      paymentStatus: trx.payment_status as string | undefined,
      dueDate: trx.due_date as string | undefined,
      remainingBalance: Number(trx.remaining_balance ?? trx.remainingBalance) || 0,
    };
  });
}

// Filter transactions by date range
function filterTransactionsByDate(
  transactions: Transaction[],
  startDate: Date,
  endDate?: Date
): Transaction[] {
  const end = endDate || new Date();
  end.setHours(23, 59, 59, 999);

  return transactions.filter((trx) => {
    const trxDate = new Date(trx.createdAt);
    return trxDate >= startDate && trxDate <= end;
  });
}

// Filter transactions for today
function filterTodayTransactions(transactions: Transaction[]): Transaction[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return filterTransactionsByDate(transactions, today);
}

// Filter transactions for this month
function filterThisMonthTransactions(transactions: Transaction[]): Transaction[] {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  return filterTransactionsByDate(transactions, firstDayOfMonth);
}

// Filter transactions for custom date range
function filterTransactionsByRange(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] {
  return filterTransactionsByDate(transactions, startDate, endDate);
}

// Export functions for different periods
export async function exportTodayTransactions(
  transactions: Transaction[],
  branchName?: string,
  cashierDefault?: string,
  isAdmin: boolean = true
): Promise<void> {
  const today = new Date();
  const todayTransactions = filterTodayTransactions(transactions);

  if (todayTransactions.length === 0) {
    throw new Error("Tidak ada transaksi hari ini");
  }

  const { data, rowStripes } = transformTransactions(todayTransactions, branchName, cashierDefault, [], isAdmin);
  if (data.length === 0) {
    throw new Error("Tidak ada data untuk diekspor");
  }

  await exportToExcel({
    title: "Laporan Hari Ini",
    sheetName: "Laporan Hari Ini",
    columns: DEFAULT_COL_WIDTHS,
    data,
    rowStripes,
    filename: `Laporan_HariIni_${formatDateForFileName(today)}.xlsx`,
  });
}

export async function exportThisMonthTransactions(
  transactions: Transaction[],
  branchName?: string,
  cashierDefault?: string,
  isAdmin: boolean = true
): Promise<void> {
  const now = new Date();
  const monthTransactions = filterThisMonthTransactions(transactions);

  if (monthTransactions.length === 0) {
    throw new Error("Tidak ada transaksi bulan ini");
  }

  const { data, rowStripes } = transformTransactions(monthTransactions, branchName, cashierDefault, [], isAdmin);
  if (data.length === 0) {
    throw new Error("Tidak ada data untuk diekspor");
  }
  const monthName = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  await exportToExcel({
    title: "Laporan Bulan Ini",
    sheetName: "Laporan Bulan Ini",
    columns: DEFAULT_COL_WIDTHS,
    data,
    rowStripes,
    filename: `Laporan_Bulan_${monthName.replace(" ", "_")}.xlsx`,
  });
}

export async function exportCustomRangeTransactions(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  branchName?: string,
  cashierDefault?: string,
  isAdmin: boolean = true
): Promise<void> {
  const rangeTransactions = filterTransactionsByRange(transactions, startDate, endDate);

  if (rangeTransactions.length === 0) {
    throw new Error("Tidak ada transaksi dalam periode ini");
  }

  const { data, rowStripes } = transformTransactions(rangeTransactions, branchName, cashierDefault, [], isAdmin);
  if (data.length === 0) {
    throw new Error("Tidak ada data untuk diekspor");
  }
  const startStr = formatDateForFileName(startDate);
  const endStr = formatDateForFileName(endDate);

  await exportToExcel({
    title: "Laporan Custom",
    sheetName: "Laporan Custom",
    columns: DEFAULT_COL_WIDTHS,
    data,
    rowStripes,
    filename: `Laporan_${startStr}_sd_${endStr}.xlsx`,
  });
}

// Download dialog component props
interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  branchName?: string;
  cashierDefault?: string;
  isAdmin?: boolean;
  outlets?: { id: number; name: string }[];
  outletFilter?: string;
  staffList?: any[];
}

// Download dialog component
export function DownloadExcelDialog({
  open,
  onOpenChange,
  transactions,
  branchName = "CV.AULIA USAHA",
  cashierDefault = "Admin Kasir",
  isAdmin = true,
  outlets = [],
  outletFilter: externalOutletFilter,
  staffList = [],
}: DownloadDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<string>("all");
  const [selectedOutlet, setSelectedOutlet] = useState<string>(externalOutletFilter || "all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const { toast } = useToast();

  const { data: filterStaffList } = useListStaff({ outletId: selectedOutlet });

  // Filter out admin staff
  const filteredStaffList = (filterStaffList || []).filter(
    (s: any) => s.role?.toLowerCase() !== 'admin'
  );

  const adminNames = new Set(
    (filterStaffList || [])
      .filter((s: any) => s.role?.toLowerCase() === 'admin')
      .map((s: any) => s.name)
  );

  useEffect(() => {
    if (selectedOutlet !== "all" && selectedCashier !== "all" && filteredStaffList.length > 0) {
      const exists = filteredStaffList.some((s: any) => s.name === selectedCashier);
      if (!exists) {
        setSelectedCashier("all");
      }
    }
  }, [selectedOutlet, filteredStaffList]);

  // Reset tanggal setiap kali pop-up dibuka atau ditutup
  useEffect(() => {
    if (!open) {
      setStartDate("");
      setEndDate("");
    }
  }, [open]);

  // Get unique cashiers from transactions
  const uniqueCashiers = Array.from(
    new Set(
      transactions
        .map((trx) => trx.cashierName || cashierDefault)
        .filter((name) => name && name.trim() !== "")
    )
  ).sort();

  const filteredUniqueCashiers = uniqueCashiers.filter(
    (cashier) =>
      cashier.toLowerCase() !== "admin" &&
      cashier !== "Admin Kasir" &&
      !adminNames.has(cashier)
  );

  const handleDownload = async (
    exportFn: () => Promise<void>,
    successMessage: string
  ) => {
    try {
      setIsDownloading(true);
      await exportFn();
      toast({
        title: "Sukses",
        description: successMessage,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Info",
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengunduh",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Filter transactions by selected cashier and outlet
  const getFilteredTransactions = () => {
    let filtered = transactions;

    // Filter by outlet
    if (selectedOutlet !== "all") {
      const outletId = parseInt(selectedOutlet);
      filtered = filtered.filter((trx) => trx.outletId === outletId);
    }

    // Filter by cashier
    if (selectedCashier !== "all") {
      filtered = filtered.filter((trx) => (trx.cashierName || cashierDefault) === selectedCashier);
    }

    return filtered;
  };

  // Get transaction count for preview
  const filteredTransactions = getFilteredTransactions();

  const handleExportToday = async () => {
    const filtered = getFilteredTransactions();
    const today = new Date();
    const todayTransactions = filterTodayTransactions(filtered);

    if (todayTransactions.length === 0) {
      const outletName = selectedOutlet === "all" ? "semua outlet" : outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet;
      const cashierText = selectedCashier === "all" ? "" : ` kasir ${selectedCashier}`;
      toast({
        title: "Info",
        description: `Tidak ada transaksi${cashierText} di ${outletName} hari ini`,
        variant: "destructive",
      });
      return;
    }

    await handleDownload(
      async () => {
        const { data, rowStripes } = transformTransactions(todayTransactions, branchName, cashierDefault, outlets, isAdmin);
        await exportToExcel({
          title: "Laporan Hari Ini",
          sheetName: "Laporan Hari Ini",
          columns: DEFAULT_COL_WIDTHS,
          data,
          rowStripes,
          filename: `Laporan_HariIni_${formatDateForFileName(today)}.xlsx`,
        });
      },
      `Berhasil download ${todayTransactions.length} transaksi hari ini`
    );
  };

  const handleExportThisMonth = async () => {
    const filtered = getFilteredTransactions();
    const now = new Date();
    const monthTransactions = filterThisMonthTransactions(filtered);

    if (monthTransactions.length === 0) {
      const outletName = selectedOutlet === "all" ? "semua outlet" : outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet;
      const cashierText = selectedCashier === "all" ? "" : ` kasir ${selectedCashier}`;
      toast({
        title: "Info",
        description: `Tidak ada transaksi${cashierText} di ${outletName} bulan ini`,
        variant: "destructive",
      });
      return;
    }

    await handleDownload(
      async () => {
        const { data, rowStripes } = transformTransactions(monthTransactions, branchName, cashierDefault, outlets, isAdmin);
        const monthName = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        await exportToExcel({
          title: "Laporan Bulan Ini",
          sheetName: "Laporan Bulan Ini",
          columns: DEFAULT_COL_WIDTHS,
          data,
          rowStripes,
          filename: `Laporan_Bulan_${monthName.replace(" ", "_")}.xlsx`,
        });
      },
      `Berhasil download ${monthTransactions.length} transaksi bulan ini`
    );
  };

  const handleExportAllTransactions = async () => {
    const pastTransactions = getFilteredTransactions();

    if (pastTransactions.length === 0) {
      const outletName = selectedOutlet === "all" ? "semua outlet" : outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet;
      const cashierText = selectedCashier === "all" ? "" : ` kasir ${selectedCashier}`;
      toast({
        title: "Info",
        description: `Tidak ada transaksi${cashierText} di ${outletName}`,
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    await handleDownload(
      async () => {
        const { data, rowStripes } = transformTransactions(pastTransactions, branchName, cashierDefault, outlets, isAdmin);
        await exportToExcel({
          title: "Laporan Semua Transaksi",
          sheetName: "Semua Transaksi",
          columns: DEFAULT_COL_WIDTHS,
          data,
          rowStripes,
          filename: `Laporan_SemuaTransaksi_${formatDateForFileName(now)}.xlsx`,
        });
      },
      `Berhasil download semua ${pastTransactions.length} transaksi`
    );
  };

  const handleExportCustomDate = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Pilih Tanggal",
        description: "Silakan pilih tanggal mulai dan tanggal akhir",
        variant: "destructive",
      });
      return;
    }

    const filtered = getFilteredTransactions();
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      toast({
        title: "Pilih Tanggal",
        description: "Tanggal akhir harus lebih besar atau sama dengan tanggal mulai",
        variant: "destructive",
      });
      return;
    }

    const rangeTransactions = filterTransactionsByRange(filtered, start, end);

    if (rangeTransactions.length === 0) {
      const outletName = selectedOutlet === "all" ? "semua outlet" : outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet;
      const cashierText = selectedCashier === "all" ? "" : ` kasir ${selectedCashier}`;
      toast({
        title: "Info",
        description: `Tidak ada transaksi${cashierText} di ${outletName} pada rentang tanggal tersebut`,
        variant: "destructive",
      });
      return;
    }

    await handleDownload(
      async () => {
        const { data, rowStripes } = transformTransactions(rangeTransactions, branchName, cashierDefault, outlets, isAdmin);
        const startStr = formatDateForFileName(start);
        const endStr = formatDateForFileName(end);
        await exportToExcel({
          title: "Laporan Custom",
          sheetName: "Laporan Custom",
          columns: DEFAULT_COL_WIDTHS,
          data,
          rowStripes,
          filename: `Laporan_${startStr}_sd_${endStr}.xlsx`,
        });
      },
      `Berhasil download ${rangeTransactions.length} transaksi`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-primary" />
            Download Laporan
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih periode dan filter untuk download laporan Excel
          </DialogDescription>
        </DialogHeader>

        {/* Filter Section - Only show for admin */}
        {isAdmin && (
          <div className="space-y-2 mt-2">


            {/* Cashier Filter */}
            <Select value={selectedCashier} onValueChange={setSelectedCashier}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sales</SelectItem>
                {filteredStaffList && filteredStaffList.length > 0 ? (
                  filteredStaffList.map((staff: any) => (
                    <SelectItem key={staff.email || staff.id} value={staff.name}>
                      {staff.name}
                    </SelectItem>
                  ))
                ) : (
                  filteredUniqueCashiers.map((cashier) => (
                    <SelectItem key={cashier} value={cashier}>
                      {cashier}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date Filter - Available to all users */}
        <div className="space-y-3 mt-4 py-4 border-t">
          <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Pilih Rentang Waktu</Label>
          <div className="flex flex-col gap-3 w-full">
            <div className="space-y-1.5 w-full">
              <Label className="text-xs text-slate-500 font-medium">Dari Tanggal</Label>
              <div className="relative w-full h-11">
                <Input
                  type="text"
                  placeholder="Pilih Tanggal Mulai"
                  value={startDate ? startDate.split('-').reverse().join('-') : ""}
                  readOnly
                  className="absolute inset-0 h-11 w-full rounded-lg text-sm text-center bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium cursor-pointer shadow-sm hover:border-primary transition-colors"
                />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e: any) => {
                    try { e.target.showPicker?.(); } catch (err) { }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Tanggal Mulai"
                />
              </div>
            </div>

            <div className="space-y-1.5 w-full">
              <Label className="text-xs text-slate-500 font-medium">Sampai Tanggal</Label>
              <div className="relative w-full h-11">
                <Input
                  type="text"
                  placeholder="Pilih Tanggal Akhir"
                  value={endDate ? endDate.split('-').reverse().join('-') : ""}
                  readOnly
                  className="absolute inset-0 h-11 w-full rounded-lg text-sm text-center bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium cursor-pointer shadow-sm hover:border-primary transition-colors"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e: any) => {
                    try { e.target.showPicker?.(); } catch (err) { }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Tanggal Akhir"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleExportCustomDate}
            disabled={isDownloading || !startDate || !endDate}
            className="w-full h-12 text-sm font-bold mt-2 shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Laporan Excel
          </Button>

          {/* Transaction count info */}
          {startDate && endDate ? (() => {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            if (start > end) {
              return (
                <p className="text-xs text-red-500 font-medium text-center pt-2">
                  Tanggal akhir harus lebih besar atau sama dengan tanggal mulai
                </p>
              );
            }

            const rangeTransactions = filterTransactionsByRange(filteredTransactions, start, end);
            return (
              <p className="text-xs text-slate-500 font-medium text-center pt-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">{rangeTransactions.length}</span> transaksi ditemukan pada rentang waktu ini.
              </p>
            );
          })() : (
            <p className="text-xs text-slate-500 font-medium text-center pt-2">
              Pilih tanggal untuk melihat jumlah transaksi yang akan didownload.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Batal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export types for external use
export type { Transaction, TransactionItem, ExportOptions, ExportColumn };