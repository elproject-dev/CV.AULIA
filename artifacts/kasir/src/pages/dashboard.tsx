import { useGetDashboardStats, useGetTopProducts, useGetRecentTransactions, useGetRevenueChart, useHealthCheck } from "@workspace/api-client-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah, formatDate } from "@/lib/formatters";
import { Activity, CreditCard, DollarSign, Package, Users, BarChart3, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: stats } = useGetDashboardStats();
  const { data: topProducts } = useGetTopProducts({ limit: 5 });
  const { data: recentTransactions } = useGetRecentTransactions({ limit: 5 });
  const { data: revenueChart } = useGetRevenueChart({ days: 7 });
  const { data: health } = useHealthCheck();

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto bg-slate-50 p-6 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          {health?.status === "ok" && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <ShieldCheck className="w-4 h-4 mr-1" /> Sistem Online
            </Badge>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pendapatan Hari Ini</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatRupiah(stats?.totalRevenueToday || 0)}</div>
              <p className="text-xs text-slate-500 mt-1">
                Total bln ini: {formatRupiah(stats?.totalRevenueMonth || 0)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Transaksi Hari Ini</CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats?.transactionsToday || 0}</div>
              <p className="text-xs text-slate-500 mt-1">
                Total bln ini: {stats?.transactionsMonth || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Pelanggan</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalCustomers || 0}</div>
              <p className="text-xs text-emerald-600 mt-1 font-medium">
                +{stats?.newCustomersThisMonth || 0} bulan ini
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Rata-rata Transaksi</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formatRupiah(stats?.averageTransactionValue || 0)}</div>
              <p className="text-xs text-slate-500 mt-1">
                Per struk
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Grafik Pendapatan (7 Hari Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-2 pt-4">
              {revenueChart?.map((point) => {
                const maxRev = Math.max(...(revenueChart.map(p => p.revenue) || [0]), 1);
                const height = `${(point.revenue / maxRev) * 100}%`;
                return (
                  <div key={point.date} className="flex-1 flex flex-col justify-end items-center group">
                    <div className="w-full bg-primary/20 hover:bg-primary/80 transition-all rounded-t-md relative" style={{ height }}>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                        {formatRupiah(point.revenue)}<br/>{point.transactions} trx
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 font-medium truncate w-full text-center">
                      {new Date(point.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                    </div>
                  </div>
                );
              })}
              {(!revenueChart || revenueChart.length === 0) && (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  Tidak ada data untuk ditampilkan
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {topProducts?.map((product, i) => (
                  <div key={product.productId} className="flex items-center">
                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center mr-4">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} className="w-full h-full object-cover rounded" alt={product.productName} />
                      ) : (
                        <Package className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{product.productName}</p>
                      <p className="text-xs text-slate-500">{product.totalSold} terjual</p>
                    </div>
                    <div className="font-medium text-sm">
                      {formatRupiah(product.totalRevenue)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaksi Terakhir</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions?.map((trx) => (
                    <TableRow key={trx.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(trx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {trx.customerName || "Umum"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm text-primary">
                        {formatRupiah(trx.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}
