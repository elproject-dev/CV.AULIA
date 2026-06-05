import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useListTransactions } from "@workspace/api-client-react";
import { formatRupiah, formatDate } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight, CreditCard, Banknote, QrCode } from "lucide-react";

export default function TransactionsPage() {
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  
  const { data: transactions, isLoading } = useListTransactions({ 
    paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
    limit: 50
  });

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4 text-emerald-600" />;
      case 'qris': return <QrCode className="w-4 h-4 text-blue-600" />;
      default: return <CreditCard className="w-4 h-4 text-slate-600" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Tunai';
      case 'debit_card': return 'Debit';
      case 'credit_card': return 'Kredit';
      case 'qris': return 'QRIS';
      case 'transfer': return 'Transfer';
      default: return method;
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Riwayat Transaksi</h1>
          <div className="flex gap-4">
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Semua Metode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Metode</SelectItem>
                <SelectItem value="cash">Tunai</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
                <SelectItem value="debit_card">Debit</SelectItem>
                <SelectItem value="credit_card">Kredit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>ID / Waktu</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Metode Pembayaran</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell></TableRow>
                ) : transactions?.map(trx => (
                  <TableRow key={trx.id}>
                    <TableCell>
                      <div className="font-medium">#{trx.id}</div>
                      <div className="text-xs text-slate-500">{formatDate(trx.createdAt)}</div>
                    </TableCell>
                    <TableCell>{trx.customerName || "Umum"}</TableCell>
                    <TableCell className="text-slate-600">{trx.cashierName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 w-max rounded text-sm font-medium">
                        {getPaymentIcon(trx.paymentMethod)}
                        {getPaymentLabel(trx.paymentMethod)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatRupiah(trx.total)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/transactions/${trx.id}`}>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {transactions?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Tidak ada transaksi ditemukan</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
