import { useState, useMemo, useEffect } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListReceivables, useListTransactionPayments, useCreateTransactionPayment, useGetTransaction } from "@workspace/api-client-react";
import { formatRupiah, formatInvoiceNumber, formatSimpleDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Calendar, User, ChevronRight, AlertCircle, CheckCircle2, Clock, History, TrendingDown, Receipt, Download, FileDown, Printer } from "lucide-react";
import { TbCoin } from "react-icons/tb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useAuthUserName } from "@/contexts/AuthContext";
import { ADMIN_EMAIL, isAdminMode } from "@/lib/auth";
import * as XLSX from "xlsx-js-style";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { isTauri, tauriSaveFile } from "@/lib/tauri-file";

export default function ReceivablesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const cashierName = useAuthUserName();
  const isAdmin = isAdminMode(user) || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [storeInfo, setStoreInfo] = useState(() => ({
    name: localStorage.getItem('storeName') || 'CV.AULIA USAHA',
    address: localStorage.getItem('storeAddress') || 'Jl. Condongcatur No.123 Yk',
    phone: localStorage.getItem('storePhone') || '',
    footer: localStorage.getItem('footerMessage') || 'Terima Kasih Sudah Melakukan Order',
    bankName: localStorage.getItem('storeBankName') || 'BCA',
    bankAccount: localStorage.getItem('storeBankAccount') || '4451377137',
    bankAccountName: localStorage.getItem('storeBankAccountName') || 'AULIA USAHA'
  }));

  useEffect(() => {
    const syncStoreInfo = () => {
      setStoreInfo({
        name: localStorage.getItem('storeName') || 'CV.AULIA USAHA',
        address: localStorage.getItem('storeAddress') || 'Jl. Condongcatur No.123 Yk',
        phone: localStorage.getItem('storePhone') || '',
        footer: localStorage.getItem('footerMessage') || 'Terima Kasih Sudah Melakukan Order',
        bankName: localStorage.getItem('storeBankName') || 'BCA',
        bankAccount: localStorage.getItem('storeBankAccount') || '4451377137',
        bankAccountName: localStorage.getItem('storeBankAccountName') || 'AULIA USAHA'
      });
    };
    syncStoreInfo();
    window.addEventListener('storage', syncStoreInfo);
    window.addEventListener('storeSettingsChanged', syncStoreInfo);
    window.addEventListener('storeNameChanged', syncStoreInfo);
    return () => {
      window.removeEventListener('storage', syncStoreInfo);
      window.removeEventListener('storeSettingsChanged', syncStoreInfo);
      window.removeEventListener('storeNameChanged', syncStoreInfo);
    };
  }, []);

  const handlePrintInvoice = (trx: any) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast({
        title: "Gagal mencetak",
        description: "Popup diblokir. Izinkan popup untuk mencetak.",
        variant: "destructive"
      });
      return;
    }

    const storeName = storeInfo?.name || "CV AULIA USAHA";
    const storeAddress = storeInfo?.address || "";
    const storePhone = storeInfo?.phone || "";

    const totalTransaction = (trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0);
    const totalPaid = totalTransaction - (trx.remaining_balance || 0);

    let itemsHtml = trx.transaction_items?.map((item: any, index: number) => {
      const productName = item.product_name || 'Unknown';
      
      // Sync quantity, unit name, and price based on UOM conversion factor
      const isUom = item.conversion_factor > 1 && item.unit_name && item.unit_name.toLowerCase() !== 'pcs';
      const displayQty = isUom ? (item.unit_qty || (item.quantity / item.conversion_factor)) : item.quantity;
      const displayUnit = item.unit_name || 'PCS';
      const displayPrice = isUom ? (item.price * item.conversion_factor) : item.price;
      const subtotal = displayPrice * displayQty;

      return `
        <tr>
          <td style="text-align: center; color: #64748b;">${index + 1}</td>
          <td style="font-weight: 600; color: #0f172a;">${productName}</td>
          <td style="text-align: center; font-weight: 600; color: #0f172a;">${displayQty} ${displayUnit}</td>
          <td style="text-align: right; color: #475569;">${formatRupiah(displayPrice)}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatRupiah(subtotal)}</td>
        </tr>`;
    }).join('') || '';

    const itemsCount = trx.transaction_items?.length || 0;
    if (itemsCount < 8) {
      for (let i = itemsCount; i < 8; i++) {
        itemsHtml += `
          <tr class="empty-row">
            <td style="text-align: center; color: #cbd5e1;">${i + 1}</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>`;
      }
    }

    let trxDate = '-';
    if (trx.created_at) {
      const dateObj = new Date(trx.created_at);
      const dateStr = dateObj.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const timeStr = dateObj.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(':', '.');
      trxDate = `${dateStr} ,${timeStr}`;
    }

    const getInvoiceContentHtml = (copyLabel: string) => {
      let statusLabel = 'BELUM BAYAR';
      let badgeClass = 'badge-pending';
      if (trx.payment_status === 'paid') {
        statusLabel = 'LUNAS';
        badgeClass = 'badge-completed';
      } else if (trx.payment_status === 'partial') {
        statusLabel = 'CICILAN';
        badgeClass = 'badge-partial';
      }

      return `
        <div class="invoice-copy">
          <div>
            <table class="info-table">
              <tr>
                <td style="width: 60%; vertical-align: middle;">
                  <table style="border-collapse: collapse; border: none; margin: 0; padding: 0;">
                    <tr>
                      <td style="vertical-align: middle; padding-right: 12px; border: none;">
                        <img src="${import.meta.env.BASE_URL}CV.AULIA.png" alt="Logo" style="height: 40px; width: auto; display: block; position: relative; top: -3px;" onerror="this.style.display='none'" />
                      </td>
                      <td style="vertical-align: middle; border: none; padding: 0; text-align: left;">
                        <div class="company-name">${storeName}</div>
                        ${storeAddress ? `<div class="company-address">${storeAddress}</div>` : ''}
                        ${storePhone ? `<div class="company-contact">Telp: ${storePhone}</div>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="width: 40%; text-align: right; vertical-align: top;">
                  <h1 class="invoice-title">FAKTUR PENAGIHAN</h1>
                  <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 4px; display: inline-flex; gap: 6px; justify-content: flex-end; align-items: center; width: 100%;">
                    <span class="invoice-copy-badge">${copyLabel}</span>
                    <span class="invoice-status-badge ${badgeClass}">${statusLabel}</span>
                  </div>
                </td>
              </tr>
            </table>

            <hr class="header-divider">

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
              <tr>
                <td style="width: 70%; vertical-align: top;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <tr>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 0; color: #475569; font-weight: 500;">Kepada Yth.</td>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 8px 2px 4px; color: #475569;">:</td>
                      <td style="padding: 2px 0; font-weight: 600; color: #0f172a;">${trx.customers?.name || trx.customer?.name || trx.customer_name || 'Pelanggan Umum'}</td>
                    </tr>
                    <tr>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 0; color: #475569; font-weight: 500;">No. Telepon</td>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 8px 2px 4px; color: #475569;">:</td>
                      <td style="padding: 2px 0;">${trx.customers?.phone || trx.customer?.phone || trx.customer_phone || '-'}</td>
                    </tr>
                    <tr>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 0; color: #475569; font-weight: 500;">Alamat</td>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 8px 2px 4px; color: #475569;">:</td>
                      <td style="padding: 2px 0; font-size: 9.5px; line-height: 1.2;">
                        ${trx.customers?.address || trx.customer?.address || trx.customer_address || '-'}
                        ${trx.customers?.district || trx.customer?.district || trx.customer_district ? `, ${trx.customers?.district || trx.customer?.district || trx.customer_district}` : ''}
                        ${trx.customers?.city || trx.customer?.city || trx.customer_city ? `, ${trx.customers?.city || trx.customer?.city || trx.customer_city}` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="width: 2%;"></td>
                <td style="width: 28%; vertical-align: top;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <tr>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 0; color: #475569; font-weight: 500;">No. Invoice</td>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 8px 2px 4px; color: #475569;">:</td>
                      <td style="padding: 2px 0; font-weight: 600; color: #0f172a; white-space: nowrap;">${formatInvoiceNumber(trx.id)}</td>
                    </tr>
                    <tr>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 0; color: #475569; font-weight: 500;">Tanggal</td>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 8px 2px 4px; color: #475569;">:</td>
                      <td style="padding: 2px 0; white-space: nowrap;">${trxDate}</td>
                    </tr>
                    <tr>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 0; color: #475569; font-weight: 500;">Salesman</td>
                      <td style="width: 1%; white-space: nowrap; padding: 2px 8px 2px 4px; color: #475569;">:</td>
                      <td style="padding: 2px 0; white-space: nowrap;">${trx.cashier_name || 'N/A'}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">No</th>
                  <th style="width: 44%; text-align: left;">Nama Produk / Item</th>
                  <th style="width: 15%; text-align: center;">Qty</th>
                  <th style="width: 15%; text-align: right;">Harga Satuan</th>
                  <th style="width: 20%; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
              <tr>
                <td style="width: 70%; vertical-align: top;">
                  <div class="reason-section" style="font-size: 8.5px; border: 1px solid #e2e8f0; padding: 10px 8px; border-radius: 4px; background-color: #f8fafc;">
                    <strong>Jatuh Tempo: ${trx.due_date ? formatSimpleDate(trx.due_date) : '-'}</strong>
                  </div>
                </td>
                <td style="width: 2%;"></td>
                <td style="width: 28%; vertical-align: top;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
                    <tr>
                      <td style="text-align: left; padding: 2px 0; color: #475569; white-space: nowrap;">Subtotal</td>
                      <td style="text-align: right; padding: 2px 0; font-weight: 600;">${formatRupiah(trx.subtotal || 0)}</td>
                    </tr>
                    <tr>
                      <td style="text-align: left; padding: 2px 0; color: #475569; white-space: nowrap;">Sudah Dibayar</td>
                      <td style="text-align: right; padding: 2px 0; font-weight: 600; color: #16a34a;">${formatRupiah(totalPaid)}</td>
                    </tr>
                    <tr style="border-top: 1px solid #cbd5e1;">
                      <td style="text-align: left; padding: 4px 0; font-weight: 700; color: #0f172a; white-space: nowrap;">SISA TAGIHAN</td>
                      <td style="text-align: right; padding: 4px 0; font-weight: 800; color: #ea580c; font-size: 11px;">${formatRupiah(trx.remaining_balance || 0)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <div>
            <table style="width: 100%; margin-top: 12px; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; text-align: center; font-size: 10px; color: #334155; vertical-align: top;">
                  <div>Penerima,</div>
                  <div style="height: 32px;"></div>
                  <div style="color: #0f172a; display: inline-block; min-width: 130px; padding-top: 2px; font-family: monospace;">
                    ( _________________ )
                  </div>
                </td>
                <td style="width: 50%; text-align: center; font-size: 10px; color: #334155; vertical-align: top;">
                  <div>Hormat Kami,</div>
                  <div style="height: 32px;"></div>
                  <div style="color: #0f172a; display: inline-block; min-width: 130px; padding-top: 2px; font-family: monospace;">
                    ( _________________ )
                  </div>
                </td>
              </tr>
            </table>
            
            <div style="text-align: left; font-size: 8px; font-style: italic; color: #475569; margin-top: 10px; line-height: 1.2; width: 100%;">
              Pembayaran Transfer melalui Bank: <strong>${storeInfo?.bankName || 'BCA'} ${storeInfo?.bankAccount || '4451377137'}</strong> a/n <strong>${storeInfo?.bankAccountName || 'AULIA USAHA'}</strong>
            </div>
            
            <div class="footer-divider" style="border-top: 1px solid #cbd5e1; margin-top: 6px; margin-bottom: 2px;"></div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="text-align: center; font-size: 8.5px; color: #64748b;">
                  ${storeInfo?.footer || 'Terima Kasih Sudah Melakukan Order'}
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Faktur Penagihan - ${formatInvoiceNumber(trx.id)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          @media print {
            body { margin: 0; padding: 8mm 10mm; }
            .no-print { display: none !important; }
            .invoice-copy { border: 1px solid transparent !important; }
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            font-size: 10px;
            line-height: 1.35;
            margin: 0;
            padding: 8mm 10mm;
            color: #1e293b;
            background-color: #ffffff;
          }
          .print-wrapper {
            display: flex;
            flex-direction: column;
            height: 270mm;
            justify-content: space-between;
          }
          .invoice-copy {
            height: 129mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            border: 1px dashed #cbd5e1;
            padding: 10px;
            border-radius: 6px;
            background-color: #ffffff;
          }
          .cut-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #94a3b8;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.15em;
            margin: 1mm 0;
            border-top: 1px dashed #cbd5e1;
            position: relative;
            height: 1px;
          }
          .cut-divider span {
            background: #ffffff;
            padding: 0 10px;
            position: absolute;
            top: -6px;
            text-transform: uppercase;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
          }
          .company-name {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .company-address, .company-contact {
            margin: 0;
            font-size: 8.5px;
            color: #475569;
          }
          .invoice-title {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: 0.02em;
          }
          .invoice-copy-badge {
            display: inline-block;
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.05em;
            padding: 1px 5px;
            border-radius: 3px;
            background-color: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
            text-transform: uppercase;
          }
          .invoice-status-badge {
            display: inline-block;
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.05em;
            padding: 1px 5px;
            border-radius: 3px;
            text-transform: uppercase;
          }
          .badge-completed {
            background-color: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
          }
          .badge-pending {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }
          .badge-partial {
            background-color: #fef9c3;
            color: #854d0e;
            border: 1px solid #fef08a;
          }
          .header-divider {
            border: none;
            border-top: 2px double #0f172a;
            margin: 4px 0 6px 0;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
          }
          .items-table th {
            background-color: #f8fafc;
            color: #475569;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 4px 6px;
            border-bottom: 1.5px solid #0f172a;
            border-top: 1px solid #e2e8f0;
          }
          .items-table td {
            padding: 4px 6px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 9px;
            vertical-align: middle;
          }
          .items-table tr.empty-row td {
            border-bottom: 1px solid #f8fafc;
            color: transparent;
            user-select: none;
          }
          .reason-section {
            font-size: 8px;
            line-height: 1.3;
            color: #475569;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${getInvoiceContentHtml('KANTOR')}
          
          <div class="cut-divider">
            <span>Gunting di sini</span>
          </div>

          ${getInvoiceContentHtml('PELANGGAN')}
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };
  const [salesFilter, setSalesFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<'outstanding' | 'history'>('outstanding');
  const { data: receivables, isLoading, refetch } = useListReceivables();

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: paymentsHistory, isLoading: isLoadingHistory } = useListTransactionPayments(selectedTransaction?.id || null);
  const createPayment = useCreateTransactionPayment();

  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const { data: detailTransaction, isLoading: isLoadingDetail } = useGetTransaction(selectedDetailId || 0);

  const uniqueSales = useMemo(() => {
    if (!receivables) return [];
    return Array.from(new Set(receivables.map((r: any) => r.cashier_name).filter(Boolean))) as string[];
  }, [receivables]);

  const { totalPiutang, piutangJatuhTempo, transaksiBerjalan, totalSudahDibayar } = useMemo(() => {
    let tPiutang = 0;
    let tJatuhTempo = 0;
    let tBerjalan = 0;
    let tDibayar = 0;

    if (receivables) {
      receivables.forEach((r: any) => {
        const isOverdue = r.due_date ? new Date(r.due_date) < new Date() : false;

        if (r.payment_status !== 'paid') {
          tPiutang += r.remaining_balance;
          tBerjalan += 1;
          if (isOverdue) tJatuhTempo += r.remaining_balance;
        }

        const totalTagihan = (r.subtotal || 0) + (r.tax || 0) - (r.discount || 0);
        tDibayar += (totalTagihan - r.remaining_balance);
      });
    }

    return { totalPiutang: tPiutang, piutangJatuhTempo: tJatuhTempo, transaksiBerjalan: tBerjalan, totalSudahDibayar: tDibayar };
  }, [receivables]);

  const animatedTotalPiutang = useCountUp(totalPiutang, { duration: 1200 });
  const animatedPiutangJatuhTempo = useCountUp(piutangJatuhTempo, { duration: 1400 });
  const animatedTransaksiBerjalan = useCountUp(transaksiBerjalan, { duration: 1000 });
  const animatedTotalSudahDibayar = useCountUp(totalSudahDibayar, { duration: 1600 });

  const filteredReceivables = receivables?.filter((r: any) => {
    // Filter by tab first:
    if (activeTab === 'outstanding' && r.payment_status === 'paid') return false;
    if (activeTab === 'history' && r.payment_status !== 'paid') return false;

    // Filter by sales
    if (salesFilter !== 'all' && r.cashier_name !== salesFilter) return false;

    // Filter by status
    if (statusFilter !== 'all' && r.payment_status !== statusFilter) return false;

    // Filter by search:
    if (!search || search.length < 3) return true;
    const s = search.toLowerCase();
    const customerName = r.customer?.name?.toLowerCase() || r.customer_name?.toLowerCase() || '';
    const invoiceNum = formatInvoiceNumber(r.id).toLowerCase();
    return customerName.includes(s) || r.id.toString().includes(s) || invoiceNum.includes(s);
  });

  const handleOpenPayment = (trx: any) => {
    setSelectedTransaction(trx);
    setPaymentAmount(trx.remaining_balance.toLocaleString("id-ID"));
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (!value) {
      setPaymentAmount("");
      return;
    }
    const formatted = parseInt(value, 10).toLocaleString("id-ID");
    setPaymentAmount(formatted);
  };

  const handleRowClick = (trx: any) => {
    setSelectedDetailId(trx.id);
    setIsDetailModalOpen(true);
  };

  const handleSubmitPayment = () => {
    const rawAmount = paymentAmount.replace(/\D/g, "");
    const amount = Number(rawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Nominal pembayaran tidak valid", variant: "destructive" });
      return;
    }

    if (amount > selectedTransaction.remaining_balance) {
      toast({ title: "Error", description: "Nominal pembayaran melebihi sisa tagihan", variant: "destructive" });
      return;
    }

    createPayment.mutate({
      transactionId: selectedTransaction.id,
      amount: amount,
      paymentMethod: "cash", // Bawaan cash untuk cicilan, bisa dikembangkan
      cashierName: cashierName,
      notes: paymentNotes
    }, {
      onSuccess: () => {
        toast({ title: "Sukses", description: "Pembayaran berhasil dicatat" });
        setIsPaymentModalOpen(false);
        setSelectedTransaction(null);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Gagal mencatat pembayaran", variant: "destructive" });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'partial') return <Badge className="bg-amber-500 hover:bg-amber-600">Cicilan</Badge>;
    if (status === 'unpaid') return <Badge variant="destructive">Belum Bayar</Badge>;
    return <Badge className="bg-emerald-500 hover:bg-emerald-600">Lunas</Badge>;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'partial') return 'Cicilan';
    if (status === 'unpaid') return 'Belum Bayar';
    return 'Lunas';
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <TbCoin className="w-6 h-6 text-primary" />
            Piutang Pelanggan
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDownloadDialog(true)}
            className="flex items-center gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-600"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </Button>
        </div>

        {/* Tabs Switcher */}
        <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button
            onClick={() => setActiveTab('outstanding')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'outstanding'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Clock className="w-4 h-4" />
            Belum Lunas
            {receivables?.filter((r: any) => r.payment_status !== 'paid').length > 0 && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {receivables.filter((r: any) => r.payment_status !== 'paid').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <History className="w-4 h-4" />
            Riwayat Lunas
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 items-stretch">
            {/* Total Piutang */}
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Piutang Belum Lunas</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatRupiah(animatedTotalPiutang.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <TbCoin className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-blue-200">{receivables?.filter((r: any) => r.payment_status !== 'paid').length || 0} faktur aktif</p>
              </div>
            </div>

            {/* Jatuh Tempo */}
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-red-100 text-xs sm:text-sm font-medium">Piutang Jatuh Tempo</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatRupiah(animatedPiutangJatuhTempo.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-red-200">{receivables?.filter((r: any) => r.payment_status !== 'paid' && r.due_date && new Date(r.due_date) < new Date()).length || 0} faktur menunggak</p>
              </div>
            </div>

            {/* Transaksi Berjalan */}
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-purple-100 text-xs sm:text-sm font-medium">Transaksi Berjalan</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {animatedTransaksiBerjalan.value} <span className="text-sm font-normal text-purple-200">faktur</span>
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Receipt className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-purple-200">total semua transaksi piutang</p>
              </div>
            </div>

            {/* Total Sudah Dibayar */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-emerald-100 text-xs sm:text-sm font-medium">Total Sudah Dibayar</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatRupiah(animatedTotalSudahDibayar.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-emerald-200">dari seluruh tagihan lunas/cicilan</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <Input
                placeholder="Cari ID Transaksi / Nama Pelanggan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div className="w-full sm:w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="paid">Lunas</SelectItem>
                    <SelectItem value="partial">Cicilan</SelectItem>
                    <SelectItem value="unpaid">Belum Bayar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="w-full sm:w-[180px]">
                  <Select value={salesFilter} onValueChange={setSalesFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Sales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Sales</SelectItem>
                      {uniqueSales.map((sales: string) => (
                        <SelectItem key={sales} value={sales}>{sales}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="whitespace-nowrap w-[130px]">ID Transaksi</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[120px]">Tgl Transaksi</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[180px]">Pelanggan</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Jatuh Tempo</TableHead>
                  <TableHead className="whitespace-nowrap text-right min-w-[140px]">Total Transaksi</TableHead>
                  <TableHead className="whitespace-nowrap text-right min-w-[140px]">Sisa Tagihan</TableHead>
                  <TableHead className="whitespace-nowrap text-center min-w-[130px]">Sales</TableHead>
                  <TableHead className="whitespace-nowrap text-center min-w-[110px]">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right min-w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Memuat...</TableCell></TableRow>
                ) : filteredReceivables?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      {activeTab === 'outstanding' ? (
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                          <p className="text-lg font-medium text-slate-900 dark:text-white">Semua Piutang Lunas!</p>
                          <p className="text-sm">Tidak ada pelanggan yang menunggak pembayaran saat ini.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <FileText className="w-12 h-12 text-slate-300 mb-3" />
                          <p className="text-lg font-medium text-slate-900 dark:text-white">Belum Ada Riwayat Pelunasan</p>
                          <p className="text-sm">Riwayat pelunasan piutang yang selesai akan muncul di sini.</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceivables?.map((trx: any) => {
                    const isOverdue = trx.due_date ? new Date(trx.due_date) < new Date() : false;
                    return (
                      <TableRow key={trx.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => handleRowClick(trx)}>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatInvoiceNumber(trx.id)}</TableCell>
                        <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                          {formatSimpleDate(trx.created_at)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap truncate max-w-[200px]">
                          {trx.customer?.name || trx.customer_name || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className={`flex items-center gap-1.5 text-sm ${isOverdue && trx.payment_status !== 'paid' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                            {isOverdue && trx.payment_status !== 'paid' && <AlertCircle className="w-3.5 h-3.5" />}
                            {formatSimpleDate(trx.due_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{formatRupiah((trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0))}</TableCell>
                        <TableCell className={`text-right font-bold whitespace-nowrap ${trx.payment_status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatRupiah(trx.remaining_balance)}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[130px]">{trx.cashier_name || '-'}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">{getStatusBadge(trx.payment_status)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant={activeTab === 'history' ? "outline" : "default"}
                            className={activeTab === 'outstanding' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                            onClick={(e) => { e.stopPropagation(); handleOpenPayment(trx); }}
                          >
                            {activeTab === 'history' ? "Detail" : "Proses Bayar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Payment Modal */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {selectedTransaction?.payment_status === 'paid' ? "Detail Pelunasan Piutang" : "Pembayaran Piutang"}
              </DialogTitle>
              <DialogDescription>
                {selectedTransaction?.payment_status === 'paid'
                  ? "Riwayat lengkap pelunasan piutang pelanggan."
                  : "Catat pembayaran cicilan atau pelunasan hutang pelanggan."}
              </DialogDescription>
            </DialogHeader>

            {selectedTransaction && (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Sisa Tagihan</p>
                    <p className={`font-bold text-lg ${selectedTransaction.payment_status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {selectedTransaction.payment_status === 'paid' ? 'Lunas' : formatRupiah(selectedTransaction.remaining_balance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Pelanggan</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedTransaction.customer?.name || selectedTransaction.customer_name}</p>
                  </div>
                </div>

                {selectedTransaction.payment_status !== 'paid' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nominal Pembayaran</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={paymentAmount}
                        onChange={handlePaymentAmountChange}
                        placeholder="Contoh: 50.000"
                      />
                      <p className="text-xs text-slate-500">Maksimal: {formatRupiah(selectedTransaction.remaining_balance)}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Catatan (Opsional)</label>
                      <Input
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Contoh: Transfer Bank BCA / DP Tahap 2"
                      />
                    </div>
                  </>
                )}

                {/* History Cicilan */}
                {!isLoadingHistory && paymentsHistory && paymentsHistory.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-medium mb-3">Histori Cicilan</p>
                    <div className="space-y-2 max-h-[150px] overflow-auto pr-2">
                      {paymentsHistory.map((p: any) => (
                        <div key={p.id} className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">{formatSimpleDate(p.payment_date)}</p>
                              <div className="mt-1.5">
                                <span className="bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 capitalize">
                                  {p.payment_method === 'cash' ? 'Tunai' : p.payment_method}
                                </span>
                              </div>
                            </div>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">+{formatRupiah(p.amount)}</p>
                          </div>
                          {p.notes && (
                            <div className="bg-slate-50 dark:bg-slate-800/80 rounded px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 w-fit">
                              {p.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {selectedTransaction?.payment_status === 'paid' ? (
                <Button onClick={() => setIsPaymentModalOpen(false)}>Tutup</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Batal</Button>
                  <Button onClick={handleSubmitPayment} disabled={createPayment.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {createPayment.isPending ? "Menyimpan..." : "Simpan Pembayaran"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Rincian Transaksi</DialogTitle>
              <DialogDescription>
                Detail item transaksi untuk Invoice {selectedDetailId ? formatInvoiceNumber(selectedDetailId) : ''}
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetail ? (
              <div className="py-8 flex justify-center items-center text-slate-500">
                Memuat rincian...
              </div>
            ) : detailTransaction ? (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Pelanggan</p>
                    <p className="font-medium text-slate-900 dark:text-white">{detailTransaction.customers?.name || detailTransaction.customer?.name || detailTransaction.customer_name || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Sales</p>
                    <p className="font-medium text-slate-900 dark:text-white">{detailTransaction.cashier_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Tgl Transaksi</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatSimpleDate(detailTransaction.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Jatuh Tempo</p>
                    <p className="font-medium text-slate-900 dark:text-white">{detailTransaction.due_date ? formatSimpleDate(detailTransaction.due_date) : '-'}</p>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800">
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailTransaction.transaction_items?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right">{formatRupiah(item.price)}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right font-medium">{formatRupiah(item.price * item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-slate-500">
                    <p className="text-sm">Subtotal: {formatRupiah(detailTransaction.subtotal)}</p>
                    {detailTransaction.tax > 0 && <p className="text-sm">Pajak: {formatRupiah(detailTransaction.tax)}</p>}
                    {detailTransaction.discount > 0 && <p className="text-sm">Diskon: -{formatRupiah(detailTransaction.discount)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Total Transaksi</p>
                    <p className="text-xl font-bold text-primary">{formatRupiah((detailTransaction.subtotal || 0) + (detailTransaction.tax || 0) - (detailTransaction.discount || 0))}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                Gagal memuat detail transaksi.
              </div>
            )}

            <DialogFooter className="flex flex-row justify-between items-center w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 border-primary text-primary hover:bg-primary/10"
                onClick={() => handlePrintInvoice(detailTransaction)}
              >
                <Printer className="w-4 h-4" />
                Cetak Faktur
              </Button>
              <Button onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DownloadReceivablesExcelDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
          receivables={receivables || []}
          uniqueSales={uniqueSales}
        />
      </div>
    </Sidebar>
  );
}

async function exportReceivablesToExcel(
  filteredList: any[],
  filename: string,
  toast: any
) {
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid" as const, fgColor: { rgb: "000000" } },
    border: {
      top: { style: "thin" as const, color: { rgb: "CCCCCC" } },
      bottom: { style: "thin" as const, color: { rgb: "CCCCCC" } },
      left: { style: "thin" as const, color: { rgb: "CCCCCC" } },
      right: { style: "thin" as const, color: { rgb: "CCCCCC" } },
    },
  };

  const cellStyle = {
    font: {},
    border: {
      top: { style: "thin" as const, color: { rgb: "CCCCCC" } },
      bottom: { style: "thin" as const, color: { rgb: "CCCCCC" } },
      left: { style: "thin" as const, color: { rgb: "CCCCCC" } },
      right: { style: "thin" as const, color: { rgb: "CCCCCC" } },
    },
  };

  const currencyStyle = {
    ...cellStyle,
    numFmt: '#,##0',
  };

  function getColumnAlignment(colIdx: number): "left" | "center" | "right" {
    switch (colIdx) {
      case 2: // Pelanggan
      case 3: // Nama Produk
        return "left";
      case 5: // Harga
      case 6: // Total Transaksi
      case 7: // Sisa Tagihan
      case 8: // Sudah Dibayar
        return "right";
      case 0: // ID Transaksi
      case 1: // Tgl Transaksi
      case 4: // Qty
      case 9: // Sales
      case 10: // Jatuh Tempo
      case 11: // Status
      default:
        return "center";
    }
  }

  const headers = [
    "ID Transaksi", "Tgl Transaksi", "Pelanggan", "Nama Produk", "Qty", "Harga", "Total Transaksi", "Sisa Tagihan", "Sudah Dibayar", "Sales", "Jatuh Tempo", "Status"
  ];

  const rows: any[] = [];
  filteredList.forEach((r: any) => {
    const total = (r.subtotal || 0) + (r.tax || 0) - (r.discount || 0);
    const paid = total - r.remaining_balance;
    const items = r.transaction_items || [];

    if (items.length === 0) {
      rows.push([
        formatInvoiceNumber(r.id),
        formatSimpleDate(r.created_at),
        r.customer?.name || r.customer_name || '-',
        '-',
        0,
        0,
        total,
        r.remaining_balance,
        paid,
        r.cashier_name || '-',
        r.due_date ? formatSimpleDate(r.due_date) : '-',
        r.payment_status === 'partial' ? 'Cicilan' : r.payment_status === 'unpaid' ? 'Belum Bayar' : 'Lunas',
      ]);
    } else {
      items.forEach((item: any, idx: number) => {
        if (idx === 0) {
          rows.push([
            formatInvoiceNumber(r.id),
            formatSimpleDate(r.created_at),
            r.customer?.name || r.customer_name || '-',
            item.product_name || '-',
            item.quantity || 0,
            item.price || 0,
            total,
            r.remaining_balance,
            paid,
            r.cashier_name || '-',
            r.due_date ? formatSimpleDate(r.due_date) : '-',
            r.payment_status === 'partial' ? 'Cicilan' : r.payment_status === 'unpaid' ? 'Belum Bayar' : 'Lunas',
          ]);
        } else {
          rows.push([
            "",
            "",
            "",
            item.product_name || '-',
            item.quantity || 0,
            item.price || 0,
            0,
            0,
            0,
            "",
            "",
            "",
          ]);
        }
      });
    }
  });

  const wsData = [
    headers.map((h, colIdx) => ({
      v: h,
      s: {
        ...headerStyle,
        alignment: { horizontal: getColumnAlignment(colIdx), vertical: "center" as const, wrapText: true }
      }
    })),
    ...rows.map((row: any[], rowIndex) =>
      row.map((cell, colIdx) => {
        const isCurrency = colIdx >= 5 && colIdx <= 8;
        const isQty = colIdx === 4;
        const isEven = rowIndex % 2 === 0;
        const fillStyle = {
          patternType: "solid" as const,
          fgColor: isEven ? { rgb: "FFFFFF" } : { rgb: "F2F2F2" }
        };
        const align = getColumnAlignment(colIdx);
        const cellS = isCurrency ? currencyStyle : cellStyle;
        const currentStyle = {
          ...cellS,
          alignment: { horizontal: align, vertical: "center" as const, wrapText: false },
          fill: fillStyle
        };
        const cellType = (isCurrency || isQty) ? 'n' : 's';
        return { v: cell, t: cellType, s: currentStyle };
      })
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [14, 14, 22, 26, 10, 14, 18, 18, 18, 16, 14, 12].map(w => ({ wch: w }));



  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Piutang");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  if (Capacitor.isNativePlatform()) {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });

    const filePath = await Filesystem.getUri({
      path: filename,
      directory: Directory.Documents,
    });

    await Share.share({
      title: "Download Laporan Piutang",
      url: filePath.uri,
    });
  } else if (isTauri()) {
    await tauriSaveFile(
      excelBuffer,
      filename,
      [{ name: "Excel Files", extensions: ["xlsx"] }]
    );
  } else {
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

interface DownloadReceivablesExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivables: any[];
  uniqueSales: string[];
}

export function DownloadReceivablesExcelDialog({
  open,
  onOpenChange,
  receivables = [],
  uniqueSales = [],
}: DownloadReceivablesExcelDialogProps) {
  const { user } = useAuth();
  const isAdmin = isAdminMode(user) || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedSales, setSelectedSales] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("all");
  const [endDate, setEndDate] = useState<string>("all");
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [tempEndDate, setTempEndDate] = useState<string>("");
  const { toast } = useToast();

  // Reset filter ketika dialog dibuka/ditutup
  useEffect(() => {
    if (!open) {
      setTempStartDate("");
      setTempEndDate("");
      setStartDate("all");
      setEndDate("all");
      setSelectedSales("all");
      setSelectedStatus("all");
    }
  }, [open]);

  // Sync temp dates to state
  useEffect(() => {
    setStartDate(tempStartDate || "all");
  }, [tempStartDate]);

  useEffect(() => {
    setEndDate(tempEndDate || "all");
  }, [tempEndDate]);

  // Filter receivables by selected filters
  const getFilteredReceivables = () => {
    let filtered = receivables;

    // Filter by sales
    if (selectedSales !== "all") {
      filtered = filtered.filter((r: any) => r.cashier_name === selectedSales);
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((r: any) => r.payment_status === selectedStatus);
    }

    // Filter by date range
    if (startDate !== "all" && startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r: any) => new Date(r.created_at) >= start);
    }

    if (endDate !== "all" && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r: any) => new Date(r.created_at) <= end);
    }

    return filtered;
  };

  const filteredList = getFilteredReceivables();

  const handleExport = async () => {
    const dataToExport = getFilteredReceivables();

    if (dataToExport.length === 0) {
      toast({
        title: "Info",
        description: "Tidak ada data piutang dengan kriteria filter tersebut",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloading(true);

      const dateStr = new Date().toISOString().slice(0, 10);
      let filename = `Laporan_Piutang_${dateStr}.xlsx`;
      if (startDate !== "all" && endDate !== "all" && startDate && endDate) {
        filename = `Laporan_Piutang_${startDate}_sd_${endDate}.xlsx`;
      } else if (startDate !== "all" && startDate) {
        filename = `Laporan_Piutang_Mulai_${startDate}.xlsx`;
      } else if (endDate !== "all" && endDate) {
        filename = `Laporan_Piutang_Sampai_${endDate}.xlsx`;
      }

      await exportReceivablesToExcel(dataToExport, filename, toast);

      toast({
        title: "Sukses",
        description: `Berhasil download ${dataToExport.length} data piutang`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat mengunduh",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] w-full mx-auto max-h-[90vh] overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <FileDown className="w-5 h-5 text-primary" />
            Download Laporan Piutang
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih periode dan filter untuk download laporan Excel piutang
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Sales Filter */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 font-medium">Filter Sales</Label>
              <Select value={selectedSales} onValueChange={setSelectedSales}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Semua Sales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sales</SelectItem>
                  {uniqueSales.map((sales: string) => (
                    <SelectItem key={sales} value={sales}>
                      {sales}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-medium">Filter Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
                <SelectItem value="partial">Cicilan</SelectItem>
                <SelectItem value="unpaid">Belum Bayar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Filter */}
        <div className="space-y-3 mt-4 py-4 border-t border-slate-100 dark:border-slate-800">
          <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Pilih Rentang Waktu</Label>
          <div className="flex flex-col gap-3 w-full">
            <div className="space-y-1.5 w-full">
              <Label className="text-xs text-slate-500 font-medium">Dari Tanggal</Label>
              <div className="relative w-full h-11">
                <Input
                  type="text"
                  placeholder="Pilih Tanggal Mulai"
                  value={tempStartDate ? tempStartDate.split('-').reverse().join('-') : ""}
                  readOnly
                  className="absolute inset-0 h-11 w-full rounded-lg text-sm text-center bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium cursor-pointer shadow-sm hover:border-primary transition-colors"
                />
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
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
                  value={tempEndDate ? tempEndDate.split('-').reverse().join('-') : ""}
                  readOnly
                  className="absolute inset-0 h-11 w-full rounded-lg text-sm text-center bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-medium cursor-pointer shadow-sm hover:border-primary transition-colors"
                />
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
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
            onClick={handleExport}
            disabled={isDownloading}
            className="w-full h-12 text-sm font-bold mt-2 shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? "Mengunduh..." : "Download Laporan Excel"}
          </Button>

          {/* Records count info */}
          {(() => {
            if (tempStartDate && tempEndDate) {
              const start = new Date(tempStartDate);
              start.setHours(0, 0, 0, 0);
              const end = new Date(tempEndDate);
              end.setHours(23, 59, 59, 999);

              if (start > end) {
                return (
                  <p className="text-xs text-red-500 font-medium text-center pt-2">
                    Tanggal akhir harus lebih besar atau sama dengan tanggal mulai
                  </p>
                );
              }
            }

            return (
              <p className="text-xs text-slate-500 font-medium text-center pt-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">{filteredList.length}</span> data piutang ditemukan.
              </p>
            );
          })()}
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

