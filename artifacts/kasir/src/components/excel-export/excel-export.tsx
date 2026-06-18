import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import { FileDown, Calendar, UserCircle, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import {
  formatInvoiceNumber,
  formatMembershipStatus,
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
}

interface Transaction {
  id: string;
  createdAt: string;
  items: TransactionItem[];
  customerName?: string;
  membershipStatus?: string;
  paymentMethod?: string;
  discount?: number;
  discountNote?: string;
  earnedPoints?: number;
  pointsRedeemed?: number;
  totalPointsAfter?: number;
  total: number;
  cashierName?: string;
  outletId?: number;
  pointsDiscount?: number;
  tax?: number;
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
  { header: "Tanggal", key: "Tanggal", width: 14 },
  { header: "Jam", key: "Jam", width: 8 },
  { header: "No. ID", key: "No. ID", width: 14 },
  { header: "Nama Pelanggan", key: "Nama Pelanggan", width: 18 },
  { header: "Status", key: "Status", width: 10 },
  { header: "Penjualan Produk", key: "Penjualan Produk", width: 35 },
  { header: "Total", key: "Total", width: 14 },
  { header: "Diskon", key: "Diskon", width: 10 },
  { header: "Ket. Diskon", key: "Ket. Diskon", width: 18 },
  { header: "PPN", key: "PPN", width: 8 },
  { header: "Tukar Poin", key: "Tukar Poin", width: 10 },
  { header: "Grand Total", key: "Grand Total", width: 14 },
  { header: "Metode", key: "Metode", width: 14 },
  { header: "Kasir", key: "Kasir", width: 14 },
  { header: "Outlet", key: "Outlet", width: 16 },
];

const CENTER_ALIGNED_KEYS = new Set([
  "Tanggal",
  "Jam",
  "No. ID",
  "Status",
  "Diskon",
  "No",
  "Poin",
  "Bergabung Sejak",
]);

const RIGHT_ALIGNED_KEYS = new Set([
  "Total",
  "PPN",
  "Tukar Poin",
  "Grand Total",
  "Metode",
  "Kasir",
  "Outlet",
  "Total Belanja",
]);

// Columns that need thousand separator format (numbers only)
const THOUSAND_FORMAT_KEYS = new Set(["Total", "Diskon", "PPN", "Tukar Poin", "Grand Total", "Total Belanja"]);

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

function addSumRow(
  ws: XLSX.WorkSheet,
  columns: ExportColumn[],
  lastDataRow: number
): void {
  const sumRow = lastDataRow + 1;
  const startRow = 2; // Data starts at row 2 (after header)

  const summaryCol = columns.length - 2;

  // Add SUM formulas for Total, Diskon, Tukar Poin, Grand Total in column M
  const sumItems = [
    { label: "Total", colKey: "Total" },
    { label: "Diskon", colKey: "Diskon" },
    { label: "PPN", colKey: "PPN" },
    { label: "Tukar Poin", colKey: "Tukar Poin" },
    { label: "Grand Total", colKey: "Grand Total" },
  ];

  // No fill - clean look
  const SUM_LABEL_FILL = { patternType: "none" as const, fgColor: { rgb: "FFFFFF" } };
  const SUM_LABEL_FONT = { bold: true, rgb: "000000" };

  sumItems.forEach((item, idx) => {
    const rowNum = sumRow + idx;

    // Get column index for the source column
    const sourceColIndex = columns.findIndex((c) => c.key === item.colKey);
    if (sourceColIndex === -1) return;

    const sourceColLetter = XLSX.utils.encode_col(sourceColIndex);
    const cellRef = XLSX.utils.encode_cell({ r: rowNum, c: summaryCol });

    // Create label
    ws[cellRef] = {
      t: "s",
      v: item.label + "",
    };
    ws[cellRef].s = {
      font: SUM_LABEL_FONT,
      fill: SUM_LABEL_FILL,
      alignment: { horizontal: "right" as const, vertical: "center" as const },
      border: GRID_BORDER,
    };

    // Add the sum value in the next column
    const valueCol = columns.length - 1;
    const valueCellRef = XLSX.utils.encode_cell({ r: rowNum, c: valueCol });
    const formula = `SUM(${sourceColLetter}${startRow}:${sourceColLetter}${lastDataRow})`;

    ws[valueCellRef] = { t: "n", f: formula, v: 0 };
    ws[valueCellRef].s = {
      font: SUM_LABEL_FONT,
      fill: SUM_LABEL_FILL,
      alignment: { horizontal: "right" as const, vertical: "center" as const },
      border: GRID_BORDER,
      numFmt: RUPIAH_FORMAT,
    };
  });

  // Update worksheet range to include all sum rows
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  ws["!ref"] = XLSX.utils.encode_range({
    s: range.s,
    e: { r: sumRow + sumItems.length, c: Math.max(range.e.c, summaryCol + 1) },
  });
}

// Core export function
export async function exportToExcel(options: ExportOptions): Promise<void> {
  const { sheetName, columns, data, rowStripes, filename } = options;

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = columns.map((col) => ({ wch: col.width }));
  const { lastDataRow } = applyWorksheetStyles(ws, columns, rowStripes);

  // Add sum row if there's data
  if (lastDataRow > 1) {
    addSumRow(ws, columns, lastDataRow);
  }

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
      directory: Directory.Documents,
      recursive: true,
    });

    const filePath = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Documents,
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

function buildExportRow(
  trx: Transaction,
  branchName: string,
  cashierDefault: string,
  outletName?: string
): Record<string, unknown> {
  const transactionId = Number(trx.id);

  const discountNote = trx.discountNote?.trim();

  // Format Penjualan Produk: "1x es teh, 1x es jeruk, 2x bakso"
  const itemsList = trx.items || [];
  const penjualanProduk = itemsList
    .map(item => `${item.quantity}x ${item.productName}`)
    .join(", ");

  // Hitung Total (jumlah dari qty * harga per item)
  const totalBelanja = itemsList.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);

  return {
    Tanggal: formatDateForExcel(trx.createdAt),
    Jam: formatTimeForExcel(trx.createdAt),
    "No. ID": Number.isFinite(transactionId) ? formatInvoiceNumber(transactionId) : "-",
    "Nama Pelanggan": trx.customerName || "Umum",
    Status: trx.membershipStatus || "Reguler",
    "Penjualan Produk": penjualanProduk || "-",
    Total: formatExcelRupiah(totalBelanja),
    Diskon: formatExcelRupiah(trx.discount),
    "Ket. Diskon": discountNote || "-",
    PPN: formatExcelRupiah(trx.tax),
    "Tukar Poin": formatExcelRupiah(trx.pointsDiscount),
    "Grand Total": formatExcelRupiah(trx.total),
    Metode: formatPaymentMethod(trx.paymentMethod),
    Kasir: trx.cashierName || cashierDefault,
    Outlet: outletName || branchName,
  };
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
  outlets: Outlet[] = []
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
  const actualBranchName = selectedOutletName || (typeof storedBranch === 'string' && storedBranch.trim()) || (typeof storedAddress === 'string' && storedAddress.trim()) || branchName || "SBAGIAMU";

  transactions.forEach((trx, trxIndex) => {
    const stripe = trxIndex % 2;
    // Get outlet name from outletId, fallback to actualBranchName
    const outletName = trx.outletId ? outletMap.get(trx.outletId) || actualBranchName : actualBranchName;

    const row = buildExportRow(trx, actualBranchName, cashierDefault, outletName);
    data.push(row);
    rowStripes.push(stripe);
  });

  return { data, rowStripes };
}

// Hitung total poin pelanggan setelah setiap transaksi (dari saldo saat ini mundur)
function calculateTotalPointsAfter(
  transactions: Record<string, unknown>[]
): (number | undefined)[] {
  const result: (number | undefined)[] = new Array(transactions.length);
  const byCustomer = new Map<number, number[]>();

  transactions.forEach((trx, index) => {
    const customerId = Number(trx.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      result[index] = undefined;
      return;
    }
    if (!byCustomer.has(customerId)) byCustomer.set(customerId, []);
    byCustomer.get(customerId)!.push(index);
  });

  for (const indices of byCustomer.values()) {
    const sample = transactions[indices[0]];
    const customer = sample.customers as { points?: number; membership_type?: string } | null;
    const isMember =
      String(sample.customer_type ?? "").toLowerCase() === "member" ||
      customer?.membership_type === "member";

    if (!isMember) {
      indices.forEach((index) => {
        result[index] = undefined;
      });
      continue;
    }

    let balance = Number(customer?.points) || 0;
    const sortedIndices = [...indices].sort((a, b) => {
      const dateA = new Date(String(transactions[a].created_at ?? transactions[a].createdAt ?? "")).getTime();
      const dateB = new Date(String(transactions[b].created_at ?? transactions[b].createdAt ?? "")).getTime();
      return dateB - dateA;
    });

    sortedIndices.forEach((index) => {
      result[index] = balance;
      const earned = Number(transactions[index].points_earned ?? transactions[index].earnedPoints) || 0;
      const redeemed = Number(transactions[index].points_used ?? transactions[index].pointsRedeemed) || 0;
      balance = Math.max(0, balance - earned + redeemed);
    });
  }

  return result;
}

// Map raw Supabase/API transactions to export format
export function mapApiTransactionsToExport(
  transactions: Record<string, unknown>[],
  options?: { pointsValue?: number }
): Transaction[] {
  const pointsValue =
    options?.pointsValue ?? parseInt(localStorage.getItem("pointsValue") || "1000", 10);

  const totalPointsAfterList = calculateTotalPointsAfter(transactions || []);

  return (transactions || []).map((trx, index) => {
    const subtotal = Number(trx.subtotal) || 0;
    const tax = Number(trx.tax) || 0;
    const discount = Number(trx.discount) || 0;
    const pointsUsed = Number(trx.points_used ?? trx.pointsRedeemed) || 0;
    const pointsDiscount = pointsUsed * pointsValue;
    const total = Math.max(0, subtotal + tax - discount - pointsDiscount);

    const rawItems = (trx.transaction_items || trx.items || []) as Record<string, unknown>[];
    const customer = trx.customers as { name?: string; membership_type?: string } | null | undefined;
    const customerType = String(trx.customer_type ?? "").trim() || undefined;
    const discountNote = String(trx.discount_note ?? trx.discountNote ?? "").trim() || undefined;

    return {
      id: String(trx.id ?? ""),
      createdAt: String(trx.created_at ?? trx.createdAt ?? ""),
      customerName: customer?.name || (trx.customerName as string | undefined) || "Umum",
      membershipStatus: formatMembershipStatus(customerType, customer?.membership_type),
      paymentMethod: String(trx.payment_method ?? trx.paymentMethod ?? ""),
      items: rawItems.map((item) => ({
        productName: String(item.product_name ?? item.productName ?? "-"),
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
      })),
      discount,
      discountNote,
      tax,
      earnedPoints: Number(trx.points_earned ?? trx.earnedPoints) || 0,
      pointsRedeemed: pointsUsed,
      totalPointsAfter: totalPointsAfterList[index],
      total,
      cashierName: (trx.cashier_name ?? trx.cashierName) as string | undefined,
      outletId: Number(trx.outlet_id ?? trx.outletId) || undefined,
      pointsDiscount,
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
  cashierDefault?: string
): Promise<void> {
  const today = new Date();
  const todayTransactions = filterTodayTransactions(transactions);

  if (todayTransactions.length === 0) {
    throw new Error("Tidak ada transaksi hari ini");
  }

  const { data, rowStripes } = transformTransactions(todayTransactions, branchName, cashierDefault);
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
  cashierDefault?: string
): Promise<void> {
  const now = new Date();
  const monthTransactions = filterThisMonthTransactions(transactions);

  if (monthTransactions.length === 0) {
    throw new Error("Tidak ada transaksi bulan ini");
  }

  const { data, rowStripes } = transformTransactions(monthTransactions, branchName, cashierDefault);
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
  cashierDefault?: string
): Promise<void> {
  const rangeTransactions = filterTransactionsByRange(transactions, startDate, endDate);

  if (rangeTransactions.length === 0) {
    throw new Error("Tidak ada transaksi dalam periode ini");
  }

  const { data, rowStripes } = transformTransactions(rangeTransactions, branchName, cashierDefault);
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
  branchName = "SBAGIAMU",
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

  useEffect(() => {
    if (selectedOutlet !== "all" && selectedCashier !== "all" && filterStaffList && filterStaffList.length > 0) {
      const exists = filterStaffList.some((s: any) => s.name === selectedCashier);
      if (!exists) {
        setSelectedCashier("all");
      }
    }
  }, [selectedOutlet, filterStaffList]);

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
        const { data, rowStripes } = transformTransactions(todayTransactions, branchName, cashierDefault, outlets);
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
        const { data, rowStripes } = transformTransactions(monthTransactions, branchName, cashierDefault, outlets);
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
        const { data, rowStripes } = transformTransactions(pastTransactions, branchName, cashierDefault, outlets);
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
        const { data, rowStripes } = transformTransactions(rangeTransactions, branchName, cashierDefault, outlets);
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
            {/* Outlet Filter */}
            {outlets.length > 0 && (
              <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Outlet</SelectItem>
                  {outlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id.toString()}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Cashier Filter */}
            <Select value={selectedCashier} onValueChange={setSelectedCashier}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Kasir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kasir</SelectItem>
                {filterStaffList && filterStaffList.length > 0 ? (
                  filterStaffList.map((staff: any) => (
                    <SelectItem key={staff.email || staff.id} value={staff.name}>
                      {staff.name}
                    </SelectItem>
                  ))
                ) : (
                  uniqueCashiers.map((cashier) => (
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
        <div className="space-y-2 mt-3">
          <Label className="text-xs font-medium text-slate-500">Rentang Tanggal (Opsional)</Label>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <div className="relative w-full h-9">
              <Input
                type="text"
                placeholder="Tanggal Mulai"
                value={startDate ? startDate.split('-').reverse().join('-') : ""}
                readOnly
                className="absolute inset-0 h-9 w-full rounded-md text-sm text-center bg-transparent focus:ring-0 cursor-pointer"
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
            <span className="text-slate-400 text-sm hidden sm:block">-</span>
            <div className="relative w-full h-9">
              <Input
                type="text"
                placeholder="Tanggal Akhir"
                value={endDate ? endDate.split('-').reverse().join('-') : ""}
                readOnly
                className="absolute inset-0 h-9 w-full rounded-md text-sm text-center bg-transparent focus:ring-0 cursor-pointer"
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
          {startDate && endDate && (
            <Button
              onClick={handleExportCustomDate}
              disabled={isDownloading}
              className="w-full h-9 text-xs mt-1"
            >
              Download Laporan (Rentang Tanggal)
            </Button>
          )}
        </div>

        <div className="space-y-3 py-4 border-t mt-4">
          <button
            onClick={handleExportToday}
            disabled={isDownloading}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors border-2 border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium text-slate-700 truncate">Hari Ini</p>
              <p className="text-xs text-slate-500 font-normal truncate">
                {selectedOutlet === "all" ? "Semua outlet" : `Outlet: ${outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet}`}
                {selectedCashier !== "all" && ` | Kasir: ${selectedCashier}`}
              </p>
            </div>
          </button>

          <button
            onClick={handleExportThisMonth}
            disabled={isDownloading}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors border-2 border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium text-slate-700 truncate">Bulan Ini</p>
              <p className="text-xs text-slate-500 font-normal truncate">
                {selectedOutlet === "all" ? "Semua outlet" : `Outlet: ${outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet}`}
                {selectedCashier !== "all" && ` | Kasir: ${selectedCashier}`}
              </p>
            </div>
          </button>

          <button
            onClick={handleExportAllTransactions}
            disabled={isDownloading}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors border-2 border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
              <History className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium text-slate-700 truncate">Semua Transaksi</p>
              <p className="text-xs text-slate-500 font-normal truncate">
                {selectedOutlet === "all" ? "Semua outlet" : `Outlet: ${outlets.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet}`}
                {selectedCashier !== "all" && ` | Kasir: ${selectedCashier}`}
              </p>
            </div>
          </button>

          {/* Transaction count below buttons */}
          <p className="text-xs text-slate-500 text-center pt-2">
            {filteredTransactions.length} transaksi ditemukan
          </p>
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