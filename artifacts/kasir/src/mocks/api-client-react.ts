import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { applyTenantFilter, applyTenantFilterForTable, withTenantOwner, handleTenantError } from '@/lib/tenant';

// ============== DASHBOARD ==============
const toNumber = (value: any) => {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numberValue) ? numberValue : 0;
};

// Get transaction total with points discount
const getTransactionTotal = (transaction: any, pointsValue: number) => {
  const pointsDiscount = toNumber(transaction.points_used) * pointsValue;
  return Math.max(
    0,
    toNumber(transaction.subtotal) + toNumber(transaction.tax) - toNumber(transaction.discount) - pointsDiscount
  );
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Hook to get distinct cashier names for filter dropdown
export const useGetCashierNames = () => {
  const [data, setData] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCashierNames = async () => {
      try {
        // Get distinct cashier names from transactions (without tenant filter for admin)
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('cashier_name')
          .not('cashier_name', 'is', null);

        if (error) throw error;

        // Get unique names and filter out empty values
        const uniqueNames = [...new Set((transactions || [])
          .map((t: any) => t.cashier_name)
          .filter(Boolean))];

        setData(uniqueNames.sort());
      } catch (err) {
        console.error('Error fetching cashier names:', err);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCashierNames();
  }, []);

  return { data, isLoading };
};

export const useGetDashboardStats = (params?: any) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const todayKey = getLocalDateKey(now);
      
      const isCustomDate = !!params?.startDate || !!params?.endDate;
      let periodStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let periodEndIso = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      if (isCustomDate) {
        const start = params?.startDate ? new Date(params.startDate + "T00:00:00") : new Date(params.endDate + "T00:00:00");
        const end = params?.endDate ? new Date(params.endDate + "T00:00:00") : new Date(params.startDate + "T00:00:00");
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        periodStartIso = start.toISOString();
        periodEndIso = end.toISOString();
      }

      const { count: productsCount, error: productsError } = await applyTenantFilter(
        supabase.from('products').select('id', { count: 'exact', head: true })
      );

      // Build transaction query with optional cashier filter
      let transactionsQuery = applyTenantFilter(
        supabase
          .from('transactions')
          .select('created_at, subtotal, tax, discount, points_used, cashier_name')
          .eq('status', 'completed')
          .gte('created_at', periodStartIso)
          .lt('created_at', periodEndIso)
      );

      // Apply cashier filter if specified (case-insensitive)
      if (params?.cashierFilter && params.cashierFilter !== 'all') {
        transactionsQuery = transactionsQuery.ilike('cashier_name', params.cashierFilter);
      }

      // Apply outlet filter if specified
      if (params?.outletFilter && params.outletFilter !== 'all') {
        transactionsQuery = transactionsQuery.eq('outlet_id', parseInt(params.outletFilter));
      }

      const { data: transactions, error: transactionsError } = await transactionsQuery;

      // Customers adalah data bersama - tidak pakai filter tenant
      const { count: customersCount, error: customersError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });

      const { count: newCustomersCount, error: newCustomersError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', periodStartIso)
        .lt('created_at', periodEndIso);

      if (productsError) throw productsError;
      if (transactionsError) throw transactionsError;
      if (customersError) throw customersError;
      if (newCustomersError) throw newCustomersError;

      const pointsValue = parseInt(localStorage.getItem('pointsValue') || '1000');
      const periodTransactions = transactions || [];
      const todayTransactions = periodTransactions.filter((transaction: any) => {
        if (!transaction.created_at) return false;
        return getLocalDateKey(new Date(transaction.created_at)) === todayKey;
      });
      const totalRevenuePeriod = periodTransactions.reduce((sum: number, transaction: any) => (
        sum + getTransactionTotal(transaction, pointsValue)
      ), 0);
      const totalRevenueToday = todayTransactions.reduce((sum: number, transaction: any) => (
        sum + getTransactionTotal(transaction, pointsValue)
      ), 0);
      const transactionsPeriod = periodTransactions.length;

      setData({
        totalRevenue: totalRevenuePeriod,
        totalTransactions: transactionsPeriod,
        totalProducts: productsCount || 0,
        totalCustomers: customersCount || 0,
        totalRevenueToday: isCustomDate ? totalRevenuePeriod : totalRevenueToday,
        totalRevenueMonth: totalRevenuePeriod,
        transactionsToday: isCustomDate ? transactionsPeriod : todayTransactions.length,
        transactionsMonth: transactionsPeriod,
        newCustomersThisMonth: newCustomersCount || 0,
        averageTransactionValue: transactionsPeriod > 0 ? totalRevenuePeriod / transactionsPeriod : 0,
        isCustomDateRange: isCustomDate
      });
    } catch (err) {
      handleTenantError(err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [params?.cashierFilter, params?.outletFilter]);

  // Realtime subscription for new transactions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.completed'
        },
        () => {
          // Refresh stats when new transaction is added
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params?.cashierFilter, params?.outletFilter]);

  return { data, isLoading, error };
};

export const useGetTopProducts = (params?: any) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchTopProducts = async () => {
    setIsLoading(true);
    try {
      // Get transactions first (to filter by cashier if needed)
      let transactionsQuery = applyTenantFilter(
        supabase
          .from('transactions')
          .select('id, cashier_name')
          .eq('status', 'completed')
      );

      if (params?.startDate || params?.endDate) {
        const start = params?.startDate ? new Date(params.startDate + "T00:00:00") : new Date(params.endDate + "T00:00:00");
        const end = params?.endDate ? new Date(params.endDate + "T00:00:00") : new Date(params.startDate + "T00:00:00");
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        transactionsQuery = transactionsQuery.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      // Apply cashier filter if specified (case-insensitive)
      if (params?.cashierFilter && params.cashierFilter !== 'all') {
        transactionsQuery = transactionsQuery.ilike('cashier_name', params.cashierFilter);
      }

      // Apply outlet filter if specified
      if (params?.outletFilter && params.outletFilter !== 'all') {
        transactionsQuery = transactionsQuery.eq('outlet_id', parseInt(params.outletFilter));
      }

      const { data: transactions, error: transactionsError } = await transactionsQuery;

      if (transactionsError) {
        throw transactionsError;
      }

      const transactionIds = (transactions || []).map((t: any) => t.id);

      if (transactionIds.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // Get transaction items for these transactions
      let itemsQuery = supabase
        .from('transaction_items')
        .select('product_id, product_name, quantity, subtotal')
        .in('transaction_id', transactionIds);

      const { data: items, error } = await itemsQuery;

      if (error) {
        throw error;
      }

      const productIds = Array.from(new Set((items || []).map((item: any) => item.product_id).filter(Boolean)));
      const { data: productRows, error: productsError } = productIds.length > 0
        ? await supabase
          .from('products')
          .select('id, name, image_url')
          .in('id', productIds)
        : { data: [], error: null };

      if (productsError) {
        throw productsError;
      }

      const productsById = new Map((productRows || []).map((product: any) => [product.id, product]));
      const grouped: { [key: number]: any } = {};
      (items || []).forEach((item: any) => {
        const product = productsById.get(item.product_id);
        if (!grouped[item.product_id]) {
          grouped[item.product_id] = {
            productId: item.product_id,
            productName: product?.name || item.product_name,
            totalSold: 0,
            totalRevenue: 0,
            imageUrl: product?.image_url || null
          };
        }
        grouped[item.product_id].totalSold += toNumber(item.quantity);
        grouped[item.product_id].totalRevenue += toNumber(item.subtotal);
      });

      const topProducts = Object.values(grouped)
        .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
        .slice(0, 20);

      setData(topProducts);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopProducts();
  }, [params?.cashierFilter, params?.outletFilter, params?.startDate, params?.endDate]);

  // Realtime subscription for new transactions
  useEffect(() => {
    const channel = supabase
      .channel('top_products_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.completed'
        },
        () => {
          fetchTopProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params?.cashierFilter, params?.outletFilter]);

  return { data, isLoading, error };
};

export const useGetRecentTransactions = (params?: any) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchRecentTransactions = async () => {
    setIsLoading(true);
    try {
      let query = applyTenantFilter(
        supabase
          .from('transactions')
          .select('id, created_at, subtotal, tax, discount, points_used, cashier_name, outlet_id, customers(name)')
          .order('created_at', { ascending: false })
          .limit(20)
      );

      if (params?.startDate || params?.endDate) {
        const start = params?.startDate ? new Date(params.startDate + "T00:00:00") : new Date(params.endDate + "T00:00:00");
        const end = params?.endDate ? new Date(params.endDate + "T00:00:00") : new Date(params.startDate + "T00:00:00");
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      // Apply cashier filter if specified (case-insensitive)
      if (params?.cashierFilter && params.cashierFilter !== 'all') {
        query = query.ilike('cashier_name', params.cashierFilter);
      }

      // Apply outlet filter if specified
      if (params?.outletFilter && params.outletFilter !== 'all') {
        query = query.eq('outlet_id', parseInt(params.outletFilter));
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw error;
      }

      // Fetch outlets for mapping
      const { data: outletsData } = await supabase.from('outlets').select('id, name');
      const outletMap = new Map((outletsData || []).map((o: any) => [o.id, o.name]));

      const pointsValue = parseInt(localStorage.getItem('pointsValue') || '1000');
      const formatted = (transactions || []).map((trx: any) => {
        const pointsDiscount = (trx.points_used || 0) * pointsValue;
        const total = (trx.subtotal || 0) + (trx.tax || 0) - (trx.discount || 0) - pointsDiscount;
        return {
          id: trx.id,
          createdAt: trx.created_at,
          total: total,
          customerName: trx.customers?.name || 'Umum',
          cashierName: trx.cashier_name || 'System',
          outletName: trx.outlet_id ? (outletMap.get(trx.outlet_id) || `Outlet ${trx.outlet_id}`) : '-'
        };
      });

      setData(formatted);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentTransactions();
  }, [params?.cashierFilter, params?.outletFilter, params?.startDate, params?.endDate]);

  // Realtime subscription for new transactions
  useEffect(() => {
    const channel = supabase
      .channel('recent_transactions_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.completed'
        },
        () => {
          // Refresh recent transactions when new one is added
          fetchRecentTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params?.cashierFilter, params?.outletFilter]);

  return { data, isLoading, error };
};

export const useGetRevenueChart = (params?: any) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    try {
      let chartStart = new Date();
      chartStart.setDate(chartStart.getDate() - 6);
      chartStart.setHours(0, 0, 0, 0);
      let chartEnd = new Date();
      chartEnd.setHours(23, 59, 59, 999);
      
      if (params?.startDate || params?.endDate) {
        chartStart = params?.startDate ? new Date(params.startDate + "T00:00:00") : new Date(params.endDate + "T00:00:00");
        chartEnd = params?.endDate ? new Date(params.endDate + "T00:00:00") : new Date(params.startDate + "T00:00:00");
        
        // If only end date, set start to 6 days prior to show a week
        if (!params?.startDate && params?.endDate) {
          chartStart.setDate(chartStart.getDate() - 6);
        }
        
        chartStart.setHours(0, 0, 0, 0);
        chartEnd.setHours(23, 59, 59, 999);
      }

      let query = applyTenantFilter(
        supabase
          .from('transactions')
          .select('created_at, subtotal, tax, discount, points_used')
          .eq('status', 'completed')
          .gte('created_at', chartStart.toISOString())
          .lte('created_at', chartEnd.toISOString())
          .order('created_at', { ascending: true })
      );

      // Apply cashier filter if specified (case-insensitive)
      if (params?.cashierFilter && params.cashierFilter !== 'all') {
        query = query.ilike('cashier_name', params.cashierFilter);
      }

      // Apply outlet filter if specified
      if (params?.outletFilter && params.outletFilter !== 'all') {
        query = query.eq('outlet_id', parseInt(params.outletFilter));
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      const pointsValue = parseInt(localStorage.getItem('pointsValue') || '1000');
      const grouped = new Map<string, { date: string; revenue: number; transactions: number }>();

      // Generate buckets for each day between chartStart and chartEnd
      let currentDay = new Date(chartStart);
      while (currentDay <= chartEnd) {
        const key = getLocalDateKey(currentDay);
        grouped.set(key, { date: key, revenue: 0, transactions: 0 });
        currentDay.setDate(currentDay.getDate() + 1);
      }

      (transactions || []).forEach((trx: any) => {
        if (!trx.created_at) return;
        const key = getLocalDateKey(new Date(trx.created_at));
        const existing = grouped.get(key);
        if (existing) {
          existing.revenue += getTransactionTotal(trx, pointsValue);
          existing.transactions += 1;
        }
      });

      setData(Array.from(grouped.values()));
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
  }, [params?.cashierFilter, params?.outletFilter, params?.startDate, params?.endDate]);

  // Realtime subscription for new transactions
  useEffect(() => {
    const channel = supabase
      .channel('revenue_chart_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.completed'
        },
        () => {
          // Refresh revenue chart when new transaction is added
          fetchRevenueData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params?.cashierFilter, params?.outletFilter]);

  return { data, isLoading, error };
};

export const useHealthCheck = () => {
  return { data: { status: 'ok' }, isLoading: false, error: null };
};

export const useAdvancedAnalytics = (params?: any) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Data untuk wawasan tingkat lanjut diambil secara keseluruhan (All-Time) 
      // agar tidak terpengaruh oleh filter dashboard (tanggal/outlet).

      // Fetch Outlets
      const { data: outlets } = await applyTenantFilterForTable(supabase.from('outlets').select('id, name'), 'outlets');
      const outletMap = new Map((outlets || []).map((o: any) => [o.id, o.name]));

      const { data: productsData } = await applyTenantFilterForTable(supabase.from('products').select('id, image_url'), 'products');
      const productImagesMap = new Map((productsData || []).map((p: any) => [p.id, p.image_url]));

      // Fetch Customers to calculate Member vs Reguler and Top Customers overall
      const { data: allCustomers } = await applyTenantFilterForTable(supabase.from('customers').select('id, name, phone, membership_type, points, total_spent, outlet_id'), 'customers');
      
      let memberCount = 0;
      let regulerCount = 0;
      (allCustomers || []).forEach((c: any) => {
        const type = c.membership_type || c.membershipType || c.membership;
        if (type === "member" || type === "Member" || type === "MEMBER") {
          memberCount++;
        } else {
          regulerCount++;
        }
      });
      
      const totalCustomers = memberCount + regulerCount;
      const memberPercentage = totalCustomers > 0 ? Math.round((memberCount / totalCustomers) * 100) : 0;
      const regulerPercentage = totalCustomers > 0 ? 100 - memberPercentage : 0;

      const topCustomersOutletFilterId = params?.topCustomersOutletFilter && params.topCustomersOutletFilter !== "all" 
        ? parseInt(params.topCustomersOutletFilter) 
        : null;

      const filteredCustomersForTop = topCustomersOutletFilterId !== null 
        ? (allCustomers || []).filter((c: any) => c.outlet_id === topCustomersOutletFilterId)
        : (allCustomers || []);

      const topCustomersAllTime = [...filteredCustomersForTop]
        .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
        .slice(0, 20)
        .map(c => ({
          ...c,
          outletName: c.outlet_id ? (outletMap.get(c.outlet_id) || `Outlet ${c.outlet_id}`) : 'Global'
        }));

      // Fetch Transactions with Items to correlate Products -> Outlets & Customers
      // Tanpa batasan tanggal (.gte dan .lt dihapus) agar menampilkan data all-time
      let trxQuery = applyTenantFilter(
        supabase
          .from('transactions')
          .select('id, outlet_id, customer_id, subtotal, tax, discount, points_used, created_at, transaction_items(product_id, product_name, quantity, subtotal)')
          .eq('status', 'completed')
      );

      const { data: transactions, error } = await trxQuery;
      if (error) throw error;

      const pointsValue = parseInt(localStorage.getItem('pointsValue') || '1000');

      // 1. Outlet Performance
      const outletStats = new Map<number, { id: number, name: string, revenue: number, transactions: number }>();
      
      // 2. Product Analytics (Member)
      const memberProductStats = new Map<number, { 
        id: number, 
        name: string, 
        revenue: number, 
        qty: number,
        outletSales: Map<number, number>, // OutletID -> Qty
        customerSales: Map<number, number> // CustomerID -> Qty
      }>();

      // 2.1 Product Analytics (Umum)
      const generalProductStats = new Map<number, { 
        id: number, 
        name: string, 
        revenue: number, 
        qty: number,
        outletSales: Map<number, number> // OutletID -> Qty
      }>();

      // 3. General Customer Analytics
      let generalRevenue = 0;
      let generalTransactions = 0;
      const generalOutletSales = new Map<number, { revenue: number, transactions: number }>(); // outletId -> data
      const generalProductSales = new Map<number, { name: string, qty: number }>();

      let totalRevenuePeriod = 0;

      // 4. Hourly Analytics
      const hourlyMap = new Map<number, { hour: string, transactions: number, revenue: number }>();
      for (let i = 0; i < 24; i++) {
        hourlyMap.set(i, { hour: `${i.toString().padStart(2, '0')}:00`, transactions: 0, revenue: 0 });
      }

      (transactions || []).forEach((trx: any) => {
        const rev = getTransactionTotal(trx, pointsValue);
        totalRevenuePeriod += rev;
        const oId = trx.outlet_id as number;

        if (oId) {
          const filterValue = params?.outletPerformanceDayFilter;
          const outletPerformanceDayFilterId = (filterValue !== undefined && filterValue !== "all") 
            ? parseInt(filterValue) 
            : null;

          let shouldIncludeOutletStat = true;
          if (outletPerformanceDayFilterId !== null && trx.created_at) {
            const trxDate = new Date(trx.created_at);
            if (trxDate.getDay() !== outletPerformanceDayFilterId) {
              shouldIncludeOutletStat = false;
            }
          }

          if (shouldIncludeOutletStat) {
            if (!outletStats.has(oId)) {
              const outletName = (outletMap.get(oId) as string) || `Outlet ${oId}`;
              outletStats.set(oId, { id: oId, name: outletName, revenue: 0, transactions: 0 });
            }
            const os = outletStats.get(oId)!;
            os.revenue += rev;
            os.transactions += 1;
          }
        }

        // Pelanggan Umum
        if (!trx.customer_id) {
          generalRevenue += rev;
          generalTransactions += 1;
          if (oId) {
            const current = generalOutletSales.get(oId) || { revenue: 0, transactions: 0 };
            generalOutletSales.set(oId, {
              revenue: current.revenue + rev,
              transactions: current.transactions + 1
            });
          }
        }

        const hourlyOutletFilterId = params?.hourlyOutletFilter && params.hourlyOutletFilter !== "all" 
          ? parseInt(params.hourlyOutletFilter) 
          : null;

        const hourlyDayFilterId = params?.hourlyDayFilter && params.hourlyDayFilter !== "all" 
          ? parseInt(params.hourlyDayFilter) 
          : null;

        if (trx.created_at) {
          const trxDate = new Date(trx.created_at);
          const trxDay = trxDate.getDay(); // 0=Minggu, 1=Senin, ..., 6=Sabtu
          
          if ((!hourlyOutletFilterId || oId === hourlyOutletFilterId) &&
              (hourlyDayFilterId === null || trxDay === hourlyDayFilterId)) {
            const hour = trxDate.getHours();
            const hourData = hourlyMap.get(hour);
            if (hourData) {
              hourData.transactions += 1;
              hourData.revenue += rev;
            }
          }
        }

        const trxDate = trx.created_at ? new Date(trx.created_at) : new Date();
        const trxDay = trxDate.getDay();

        (trx.transaction_items || []).forEach((item: any) => {
          const pId = item.product_id;
          const qty = toNumber(item.quantity);
          if (pId) {
            if (trx.customer_id) {
              const memberDayFilterId = params?.memberProductDayFilter && params.memberProductDayFilter !== "all" 
                ? parseInt(params.memberProductDayFilter) : null;
              
              if (memberDayFilterId === null || trxDay === memberDayFilterId) {
                if (!memberProductStats.has(pId)) {
                memberProductStats.set(pId, {
                  id: pId,
                  name: item.product_name,
                  revenue: 0,
                  qty: 0,
                  outletSales: new Map(),
                  customerSales: new Map()
                });
              }
              const ps = memberProductStats.get(pId)!;
              ps.revenue += toNumber(item.subtotal);
              ps.qty += qty;
              
              if (oId) {
                ps.outletSales.set(oId, (ps.outletSales.get(oId) || 0) + qty);
              }
              ps.customerSales.set(trx.customer_id, (ps.customerSales.get(trx.customer_id) || 0) + qty);
              }
            } else {
              // Produk Pelanggan Umum
              const generalDayFilterId = params?.generalProductDayFilter && params.generalProductDayFilter !== "all" 
                ? parseInt(params.generalProductDayFilter) : null;

              if (generalDayFilterId === null || trxDay === generalDayFilterId) {
                if (!generalProductStats.has(pId)) {
                generalProductStats.set(pId, {
                  id: pId,
                  name: item.product_name,
                  revenue: 0,
                  qty: 0,
                  outletSales: new Map()
                });
              }
              const ps = generalProductStats.get(pId)!;
              ps.revenue += toNumber(item.subtotal);
              ps.qty += qty;
              
              if (oId) {
                ps.outletSales.set(oId, (ps.outletSales.get(oId) || 0) + qty);
              }

              // Update simple tracking for the general summary card
              const currentGen = generalProductSales.get(pId) || { name: item.product_name, qty: 0 };
              currentGen.qty += qty;
              generalProductSales.set(pId, currentGen);
              }
            }
          }
        });
      });

      // Format Outlet Stats
      const sortedOutlets = Array.from(outletStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map(o => ({
          ...o,
          percentage: totalRevenuePeriod > 0 ? (o.revenue / totalRevenuePeriod) * 100 : 0
        }));

      // Format Deep Product Analytics (Member)
      const allCustomersMap = new Map((allCustomers || []).map((c: any) => [c.id, c.name]));
      
      const memberOutletFilterId = params?.memberProductOutletFilter && params.memberProductOutletFilter !== "all" 
        ? parseInt(params.memberProductOutletFilter) 
        : null;

      const memberProductAnalytics = Array.from(memberProductStats.values())
        .map(p => {
          let qty = p.qty;
          if (memberOutletFilterId) {
            qty = p.outletSales.get(memberOutletFilterId) || 0;
          }
          return { ...p, sortQty: qty };
        })
        .filter(p => p.sortQty > 0)
        .sort((a, b) => b.sortQty - a.sortQty)
        .slice(0, 20)
        .map(p => {
          let topOutletId = 0;
          let topOutletQty = 0;
          p.outletSales.forEach((qty, oId) => {
            if (qty > topOutletQty) {
              topOutletQty = qty;
              topOutletId = oId;
            }
          });

          let topCustomerId = 0;
          let topCustomerQty = 0;
          p.customerSales.forEach((qty, cId) => {
            if (qty > topCustomerQty) {
              topCustomerQty = qty;
              topCustomerId = cId;
            }
          });

          return {
            ...p,
            qty: p.sortQty, // Gunakan qty hasil filter
            topOutletName: topOutletId ? (outletMap.get(topOutletId) || `Outlet ${topOutletId}`) : '-',
            topOutletQty,
            topCustomerName: topCustomerId ? (allCustomersMap.get(topCustomerId) || 'Member Lain') : '-',
            topCustomerQty,
            imageUrl: productImagesMap.get(p.id) || null
          };
        });


      // Format Deep Product Analytics (Umum)
      const generalOutletFilterId = params?.generalProductOutletFilter && params.generalProductOutletFilter !== "all" 
        ? parseInt(params.generalProductOutletFilter) 
        : null;

      const generalProductAnalytics = Array.from(generalProductStats.values())
        .map(p => {
          let qty = p.qty;
          if (generalOutletFilterId) {
            qty = p.outletSales.get(generalOutletFilterId) || 0;
          }
          return { ...p, sortQty: qty };
        })
        .filter(p => p.sortQty > 0)
        .sort((a, b) => b.sortQty - a.sortQty)
        .slice(0, 20)
        .map(p => {
          let topOutletId = 0;
          let topOutletQty = 0;
          p.outletSales.forEach((qty, oId) => {
            if (qty > topOutletQty) {
              topOutletQty = qty;
              topOutletId = oId;
            }
          });

          return {
            ...p,
            qty: p.sortQty, // Gunakan qty hasil filter
            topOutletName: topOutletId ? (outletMap.get(topOutletId) || `Outlet ${topOutletId}`) : '-',
            topOutletQty,
            imageUrl: productImagesMap.get(p.id) || null
          };
        });

      // Assemble General Customer Analytics
      let topGenOutletId = 0;
      let topGenOutletRev = 0;
      generalOutletSales.forEach((data, oId) => {
        if (data.revenue > topGenOutletRev) {
          topGenOutletRev = data.revenue;
          topGenOutletId = oId;
        }
      });

      let topGenProdId = 0;
      let topGenProdQty = 0;
      let topGenProdName = '';
      generalProductSales.forEach((data, pId) => {
        if (data.qty > topGenProdQty) {
          topGenProdQty = data.qty;
          topGenProdId = pId;
          topGenProdName = data.name;
        }
      });

      let filteredGeneralRevenue = generalRevenue;
      let filteredGeneralTransactions = generalTransactions;
      
      if (generalOutletFilterId) {
        const outletData = generalOutletSales.get(generalOutletFilterId) || { revenue: 0, transactions: 0 };
        filteredGeneralRevenue = outletData.revenue;
        filteredGeneralTransactions = outletData.transactions;
      }

      const generalCustomerAnalytics = {
        revenue: filteredGeneralRevenue,
        transactions: filteredGeneralTransactions,
        percentageOfTotalRevenue: totalRevenuePeriod > 0 ? (filteredGeneralRevenue / totalRevenuePeriod) * 100 : 0,
        topOutletName: topGenOutletId ? (outletMap.get(topGenOutletId) || `Outlet ${topGenOutletId}`) : '-',
        topOutletRevenue: topGenOutletRev,
        topProductName: topGenProdName || '-',
        topProductQty: topGenProdQty
      };

      // Assemble Member Customer Analytics
      let filteredMemberRevenue = totalRevenuePeriod - generalRevenue;
      let filteredMemberTransactions = (transactions?.length || 0) - generalTransactions;

      if (memberOutletFilterId) {
        const os = outletStats.get(memberOutletFilterId);
        const gos = generalOutletSales.get(memberOutletFilterId);
        const totalRev = os ? os.revenue : 0;
        const totalTrx = os ? os.transactions : 0;
        const genRev = gos ? gos.revenue : 0;
        const genTrx = gos ? gos.transactions : 0;
        
        filteredMemberRevenue = totalRev - genRev;
        filteredMemberTransactions = totalTrx - genTrx;
      }

      const memberCustomerAnalytics = {
        revenue: filteredMemberRevenue,
        transactions: filteredMemberTransactions,
        percentageOfTotalRevenue: totalRevenuePeriod > 0 ? (filteredMemberRevenue / totalRevenuePeriod) * 100 : 0
      };

      setData({
        outletPerformance: sortedOutlets,
        topCustomers: topCustomersAllTime,
        memberProductAnalytics,
        generalProductAnalytics,
        customerDemographics: {
          totalCustomers,
          memberCount,
          regulerCount,
          memberPercentage,
          regulerPercentage
        },
        generalCustomerAnalytics,
        memberCustomerAnalytics,
        hourlyAnalytics: Array.from(hourlyMap.values()),
        totalRevenue: totalRevenuePeriod
      });

    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [params?.memberProductOutletFilter, params?.memberProductDayFilter, params?.generalProductOutletFilter, params?.generalProductDayFilter, params?.hourlyOutletFilter, params?.hourlyDayFilter, params?.outletPerformanceDayFilter, params?.topCustomersOutletFilter]);

  // Optionally listen to transactions realtime
  useEffect(() => {
    const channel = supabase
      .channel('advanced_analytics_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: 'status=eq.completed' }, () => {
        fetchAnalytics();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params?.memberProductOutletFilter, params?.generalProductOutletFilter]);

  return { data, isLoading, error };
};

// ============== TRANSACTIONS ==============
export const useListTransactions = (params?: any) => {
  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      // First, get total count with the same filters (but no limit/offset)
      let countQuery = applyTenantFilter(
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
      );

      if (params?.paymentMethod) {
        countQuery = countQuery.eq('payment_method', params.paymentMethod);
      }

      if (params?.cashierFilter && params.cashierFilter !== 'all') {
        countQuery = countQuery.ilike('cashier_name', params.cashierFilter);
      }

      // Apply outlet filter if specified
      if (params?.outletFilter && params.outletFilter !== 'all') {
        countQuery = countQuery.eq('outlet_id', parseInt(params.outletFilter));
      }

      if (params?.startDate || params?.endDate) {
        const start = params?.startDate ? new Date(params.startDate + "T00:00:00") : new Date(params.endDate + "T00:00:00");
        const end = params?.endDate ? new Date(params.endDate + "T00:00:00") : new Date(params.startDate + "T00:00:00");
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        countQuery = countQuery.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Then fetch paginated data
      let query = applyTenantFilter(
        supabase
          .from('transactions')
          .select('*, transaction_items(*), customers(name, membership_type, points)')
          .order('created_at', { ascending: false })
      );

      if (params?.paymentMethod) {
        query = query.eq('payment_method', params.paymentMethod);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 30) - 1);
      }

      // Apply cashier filter if specified (case-insensitive)
      if (params?.cashierFilter && params.cashierFilter !== 'all') {
        query = query.ilike('cashier_name', params.cashierFilter);
      }

      // Apply outlet filter if specified
      if (params?.outletFilter && params.outletFilter !== 'all') {
        query = query.eq('outlet_id', parseInt(params.outletFilter));
      }

      if (params?.startDate || params?.endDate) {
        const start = params?.startDate ? new Date(params.startDate + "T00:00:00") : new Date(params.endDate + "T00:00:00");
        const end = params?.endDate ? new Date(params.endDate + "T00:00:00") : new Date(params.startDate + "T00:00:00");
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setData(data || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [params?.paymentMethod, params?.limit, params?.offset, params?.cashierFilter, params?.outletFilter, params?.startDate, params?.endDate]);

  // Realtime subscription for new transactions
  useEffect(() => {
    const channel = supabase
      .channel('transactions_list_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.completed'
        },
        () => {
          // Refresh transaction list when new transaction is added
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params?.paymentMethod, params?.limit, params?.offset, params?.cashierFilter, params?.outletFilter, params?.startDate, params?.endDate]);

  return { data, totalCount, isLoading, error, refetch: fetchTransactions };
};

export const useGetTransaction = (id: number) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      setIsLoading(true);
      try {
        const { data: transaction, error } = await applyTenantFilter(
          supabase
            .from('transactions')
            .select('*, transaction_items(*), customers(name, membership_type, points)')
            .eq('id', id)
        ).single();

        if (error) throw error;
        setData(transaction);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchTransaction();
    }
  }, [id]);

  return { data, isLoading, error };
};

export const getGetTransactionQueryKey = (id: number) => ['transaction', id];

export const useDeleteTransaction = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: { id: number }, options?: any) => {
      setIsPending(true);
      try {
        const { error: itemsError } = await applyTenantFilter(
          supabase.from('transaction_items').delete().eq('transaction_id', params.id)
        );

        if (itemsError) throw itemsError;

        const { error } = await applyTenantFilter(
          supabase.from('transactions').delete().eq('id', params.id)
        );

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

// ============== PRODUCTS WITH REALTIME (SHARED DATA) ==============
export const useListProducts = (params?: any) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      // Produk adalah data bersama - tidak pakai filter tenant
      let query: any = supabase.from('products').select('*, categories(name)') as any;

      if (params?.search) {
        query = query.ilike('name', `%${params.search}%`);
      }
      if (params?.categoryId) {
        query = query.eq('category_id', params.categoryId);
      }
      if (params?.isActive !== undefined) {
        query = query.eq('is_active', params.isActive);
      }
      if (params?.outletId && params.outletId !== "all" && params.outletId !== "unselected") {
        if (params?.includeShared) {
          // POS mode: tampilkan produk outlet ini + produk umum ("all")
          query = query.or(`allowed_outlets.cs.["${params.outletId}"],allowed_outlets.cs.["all"]`);
        } else {
          // Admin filter mode: tampilkan HANYA produk outlet ini (atau admin mungkin ingin lihat "all" juga)
          query = query.or(`allowed_outlets.cs.["${params.outletId}"],allowed_outlets.cs.["all"]`);
        }
      }

      const { data: products, error } = await query;
      if (error) {
                throw error;
      }

      const formattedProducts = (products as any[])?.map((p: any) => ({
        ...p,
        categoryName: p.categories?.name || null,
        isActive: p.is_active
      })) || [];

      setData(formattedProducts);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [params?.search, params?.categoryId, params?.isActive, params?.outletId]);

  // Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('products_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [params?.search, params?.categoryId, params?.isActive, params?.outletId]);

  return { data, isLoading, error, refetch: fetchProducts };
};

export const useCreateProduct = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        const payload: any = {
          name: params.data.name,
          price: params.data.price,
          is_active: params.data.isActive === true
        };

        if (params.data.categoryId && params.data.categoryId !== "none") {
          payload.category_id = parseInt(params.data.categoryId);
        }

        // Simpan image_url jika ada
        if (params.data.imageUrl && params.data.imageUrl.trim() !== "") {
          payload.image_url = params.data.imageUrl.trim();
        }

        if (params.data.allowedOutlets && Array.isArray(params.data.allowedOutlets) && params.data.allowedOutlets.length > 0) {
          payload.allowed_outlets = params.data.allowedOutlets;
        } else {
          payload.allowed_outlets = ["all"];
        }

        // Produk adalah data bersama - tidak pakai owner_id
        const { data, error } = await supabase
          .from('products')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const formattedData = {
          ...data,
          isActive: data.is_active
        };

        if (options?.onSuccess) options.onSuccess(formattedData);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useUpdateProduct = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        const payload: any = {
          name: params.data.name,
          price: params.data.price,
          is_active: params.data.isActive === true
        };

        if (params.data.categoryId && params.data.categoryId !== "none") {
          payload.category_id = parseInt(params.data.categoryId);
        }

        // Simpan image_url jika ada
        if (params.data.imageUrl && params.data.imageUrl.trim() !== "") {
          payload.image_url = params.data.imageUrl.trim();
        }

        if (params.data.allowedOutlets && Array.isArray(params.data.allowedOutlets) && params.data.allowedOutlets.length > 0) {
          payload.allowed_outlets = params.data.allowedOutlets;
        } else {
          payload.allowed_outlets = ["all"];
        }

        // Produk adalah data bersama - tidak pakai filter tenant
        const { data, error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', params.id)
          .select()
          .single();

        if (error) throw error;

        const formattedData = {
          ...data,
          isActive: data.is_active
        };

        if (options?.onSuccess) options.onSuccess(formattedData);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useDeleteProduct = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        // Produk adalah data bersama - tidak pakai filter tenant
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', params.id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

// ============== CATEGORIES WITH REALTIME (SHARED DATA) ==============
export const useListCategories = (params?: { outletId?: string }) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      let query: any = supabase.from('categories').select('*').order('name');

      if (params?.outletId && params.outletId !== "all" && params.outletId !== "unselected") {
        query = query.or(`allowed_outlets.cs.["${params.outletId}"],allowed_outlets.cs.["all"]`);
      }

      const { data: categories, error } = await query;

      if (error) throw error;
      setData(categories || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('categories_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories'
        },
        () => {
                    fetchCategories();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { data, isLoading, error, refetch: fetchCategories };
};

export const useCreateCategory = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        // Kategori adalah data bersama - tidak pakai owner_id
        const { data, error } = await supabase
          .from('categories')
          .insert({ 
            name: params.data.name,
            allowed_outlets: params.data.allowedOutlets || ["all"]
          })
          .select()
          .single();

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    }, 
    isPending, 
    error: null 
  };
};

export const useUpdateCategory = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        const { data, error } = await supabase
          .from('categories')
          .update({ 
            name: params.data.name,
            allowed_outlets: params.data.allowedOutlets
          })
          .eq('id', params.id)
          .select()
          .single();

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    }, 
    isPending, 
    error: null 
  };
};

export const useDeleteCategory = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        // Kategori adalah data bersama - tidak pakai filter tenant
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', params.id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    }, 
    isPending, 
    error: null 
  };
};

// ============== QUERY KEYS ==============
export const getListProductsQueryKey = () => ['products'];
export const getListCategoriesQueryKey = () => ['categories'];

// ============== CUSTOMERS WITH REALTIME (SHARED DATA) ==============
export const useListCustomers = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      // Pelanggan adalah data bersama - tidak pakai filter tenant
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setData(customers || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Realtime subscription dengan smart update
  useEffect(() => {
    let subscription: any;
    let retryCount = 0;
    const maxRetries = 5;

    const setupSubscription = () => {
      try {
        subscription = supabase
          .channel(`customers_realtime_${Math.random().toString(36).substring(2, 9)}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'customers'
            },
            (payload: any) => {
                            const newCustomer = payload.new;
              setData(prevData => {
                const exists = prevData.some(c => c.id === newCustomer.id);
                if (exists) return prevData;
                // Insert in sorted order by name
                const updatedData = [...prevData, newCustomer];
                return updatedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'customers'
            },
            (payload: any) => {
                            const updatedCustomer = payload.new;
              setData(prevData =>
                prevData.map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
              );
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'customers'
            },
            (payload: any) => {
                            const deletedId = payload.old.id;
              setData(prevData => prevData.filter(c => c.id !== deletedId));
            }
          )
          .subscribe((status: any) => {
            if (status === 'SUBSCRIBED') {
              retryCount = 0;
            } else if (status === 'CHANNEL_ERROR') {
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(() => {
                  if (subscription) supabase.removeChannel(subscription);
                  setupSubscription();
                }, 2000);
              }
            }
          });
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => {
                        setupSubscription();
          }, 2000);
        }
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  return { data, isLoading, error, refetch: fetchCustomers };
};

export const useCreateCustomer = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        // Pelanggan adalah data bersama - tidak pakai owner_id
        const { data, error } = await supabase
          .from('customers')
          .insert({
            name: params.data.name,
            phone: params.data.phone || null,
            membership_type: params.data.membershipType || params.data.membership_type || 'non_member',
            points: 0,
            ...(params.data.outlet_id !== undefined ? { outlet_id: params.data.outlet_id } : {})
          })
          .select()
          .single();

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useUpdateCustomer = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        // Pelanggan adalah data bersama - tidak pakai filter tenant
        const { data, error } = await supabase
          .from('customers')
          .update({
            name: params.data.name,
            phone: params.data.phone || null,
            membership_type: params.data.membershipType || params.data.membership_type || 'non_member',
            ...(params.data.outlet_id !== undefined ? { outlet_id: params.data.outlet_id } : {})
          })
          .eq('id', params.id)
          .select()
          .single();

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useDeleteCustomer = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        // Pelanggan adalah data bersama - tidak pakai filter tenant
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', params.id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useLookupCustomer = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  return { data, isLoading, error };
};

export const getListCustomersQueryKey = () => ['customers'];

// ============== TRANSACTION (Create) ==============
export const useCreateTransaction = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        const customerType = params.data.customerType === 'member' ? 'member' : 'non_member';
        const selectedOutletId = localStorage.getItem('selectedOutletId');
        const basePayload = {
          customer_id: params.data.customerId || null,
          cashier_name: params.data.cashierName,
          payment_method: params.data.paymentMethod,
          subtotal: params.data.subtotal,
          tax: params.data.tax,
          discount: params.data.discount || 0,
          amount_paid: params.data.amountPaid,
          change: params.data.change || 0,
          points_used: params.data.pointsRedeemed || 0,
          points_earned: params.data.earnedPoints || 0,
          status: params.data.status || 'completed',
          outlet_id: selectedOutletId ? parseInt(selectedOutletId) : null,
        };
        const extendedPayload = {
          ...basePayload,
          discount_note: params.data.discountNote?.trim() || null,
          customer_type: customerType,
        };

        let { data, error } = await supabase
          .from('transactions')
          .insert(withTenantOwner(extendedPayload))
          .select()
          .single();

        if (
          error &&
          (error.code === 'PGRST204' ||
            error.message?.includes('discount_note') ||
            error.message?.includes('customer_type') ||
            error.message?.includes('outlet_id'))
        ) {
          // Try without outlet_id if it's not supported yet
          const { outlet_id, ...payloadWithoutOutlet } = extendedPayload;
          ({ data, error } = await supabase
            .from('transactions')
            .insert(withTenantOwner(payloadWithoutOutlet))
            .select()
            .single());
        }

        if (error) throw error;

        if (data && params.data.items) {
          const items = params.data.items.map((item: any) =>
            withTenantOwner({
              transaction_id: data.id,
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.price * item.quantity,
            })
          );

          const { error: itemsError } = await supabase
            .from('transaction_items')
            .insert(items);

          if (itemsError) throw itemsError;
        }

        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

// ============== OUTLETS ==============
export const useListOutlets = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchOutlets = async () => {
    setIsLoading(true);
    try {
      const { data: outlets, error } = await supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        // Fallback: use localStorage values if table doesn't exist
        const storeName = localStorage.getItem('storeName') || 'Toko Utama';
        const storeAddress = localStorage.getItem('storeAddress') || '';
        const storePhone = localStorage.getItem('storePhone') || '';
        setData([{ id: 1, name: storeName, address: storeAddress, phone: storePhone }]);
        setError(null);
        return;
      }
      setData(outlets || []);
      setError(null);
    } catch (err) {
      // Fallback: use localStorage values on error
      const storeName = localStorage.getItem('storeName') || 'Toko Utama';
      const storeAddress = localStorage.getItem('storeAddress') || '';
      const storePhone = localStorage.getItem('storePhone') || '';
      setData([{ id: 1, name: storeName, address: storeAddress, phone: storePhone }]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  return { data, isLoading, error, refetch: fetchOutlets };
};

export const useGetCurrentOutletId = () => {
  const [outletId, setOutletId] = useState<string | null>(() => localStorage.getItem('selectedOutletId'));

  useEffect(() => {
    const handleOutletChange = () => {
      setOutletId(localStorage.getItem('selectedOutletId'));
    };

    window.addEventListener('outletChanged', handleOutletChange);
    return () => window.removeEventListener('outletChanged', handleOutletChange);
  }, []);

  return outletId;
};

// ============== STAFF ==============
export const useListStaff = (params?: { outletId?: string | number }) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('staff').select('*, outlets(name)');

      if (params?.outletId && params.outletId !== 'all') {
        query = query.eq('outlet_id', params.outletId);
      }

      const { data: staff, error } = await query.order('name');
      if (error) throw error;

      setData(staff || []);
      setError(null);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [params?.outletId]);

  // Realtime subscription
  useEffect(() => {
    let subscription: any;
    let retryCount = 0;
    const maxRetries = 5;

    const setupSubscription = () => {
      try {
        subscription = supabase
          .channel(`staff_realtime_${Math.random().toString(36).substring(2, 9)}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'staff'
            },
            () => {
              // Refetch to get the joined outlet name properly
              fetchStaff();
            }
          )
          .subscribe((status: any) => {
            if (status === 'SUBSCRIBED') {
              retryCount = 0;
            } else if (status === 'CHANNEL_ERROR') {
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(() => {
                  if (subscription) supabase.removeChannel(subscription);
                  setupSubscription();
                }, 2000);
              }
            }
          });
      } catch (err) {
        console.error("Realtime staff setup failed:", err);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [params?.outletId]);

  return { data, isLoading, error, refetch: fetchStaff };
};

export const useCreateStaff = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: { data: any }, options?: any) => {
      setIsPending(true);
      try {
        const payload = { ...params.data };
        if (payload.outlet_id === "all" || payload.outlet_id === "none" || !payload.outlet_id) {
          payload.outlet_id = null;
        }

        const { data, error } = await supabase
          .from('staff')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending
  };
};

export const useUpdateStaff = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: { id: number; data: any }, options?: any) => {
      setIsPending(true);
      try {
        const payload = { ...params.data };
        if (payload.outlet_id === "all" || payload.outlet_id === "none" || !payload.outlet_id) {
          payload.outlet_id = null;
        }

        const { data, error } = await supabase
          .from('staff')
          .update(payload)
          .eq('id', params.id)
          .select()
          .single();

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess(data);
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending
  };
};

export const useDeleteStaff = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: { id: number }, options?: any) => {
      setIsPending(true);
      try {
        const { error } = await supabase
          .from('staff')
          .delete()
          .eq('id', params.id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending
  };
};

// ============== POINT SETTINGS ==============

export const useListPointsSettings = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from('point_settings')
        .select(`
          *,
          outlets (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formatted = (settings || []).map((s: any) => ({
        id: s.id,
        outletId: s.outlet_id,
        outletName: s.outlets?.name || 'Semua Outlet',
        staffEmail: s.staff_email,
        staffName: s.staff_email || 'Semua Kasir',
        enablePoints: s.enable_points,
        pointsValue: s.points_value?.toString() || '1000',
        pointsBaseType: s.points_base_type || '10000',
        pointsBaseCustom: s.points_base_custom?.toString() || '5000',
        pointsEarnRate: s.points_earn_rate?.toString() || '1',
        maxPointsPerTransaction: s.max_points_per_transaction?.toString() || '1000'
      }));
      
      setData(formatted);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { data, isLoading, error, refetch: fetchSettings };
};

export const useSavePointsSettings = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        const payload: any = {
          enable_points: params.enablePoints,
          points_value: parseInt(params.pointsValue) || 1000,
          points_base_type: params.pointsBaseType,
          points_base_custom: parseInt(params.pointsBaseCustom) || 5000,
          points_earn_rate: parseInt(params.pointsEarnRate) || 1,
          max_points_per_transaction: parseInt(params.maxPointsPerTransaction) || 1000,
          updated_at: new Date().toISOString()
        };

        if (params.outletId && params.outletId !== 'all') {
          payload.outlet_id = parseInt(params.outletId);
        } else {
          payload.outlet_id = null;
        }

        if (params.staffEmail && params.staffEmail !== 'all') {
          payload.staff_email = params.staffEmail;
        } else {
          payload.staff_email = null;
        }

        let query = supabase.from('point_settings').select('id');
        
        if (payload.outlet_id) {
          query = query.eq('outlet_id', payload.outlet_id);
        } else {
          query = query.is('outlet_id', null);
        }
        
        if (payload.staff_email) {
          query = query.eq('staff_email', payload.staff_email);
        } else {
          query = query.is('staff_email', null);
        }
        
        const { data: existing, error: findError } = await query.maybeSingle();
        
        if (findError) throw findError;

        let resultError;
        if (existing) {
          const { error } = await supabase
            .from('point_settings')
            .update(payload)
            .eq('id', existing.id);
          resultError = error;
        } else {
          const { error } = await supabase
            .from('point_settings')
            .insert([payload]);
          resultError = error;
        }

        if (resultError) throw resultError;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useDeletePointsSettings = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (id: number, options?: any) => {
      setIsPending(true);
      try {
        const { error } = await supabase
          .from('point_settings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useListDiscountSettings = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from('discount_settings')
        .select(`
          *,
          outlets (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formatted = (settings || []).map((s: any) => ({
        id: s.id,
        outletId: s.outlet_id ? s.outlet_id.toString() : 'all',
        outletName: s.outlets?.name || 'Semua Outlet',
        staffEmail: s.staff_email || 'all',
        staffName: s.staff_email || 'Semua Kasir',
        enableDiscount: s.enable_discount,
        defaultDiscountPrice: s.default_discount_price?.toString() || '0',
        enablePPN: s.enable_ppn,
        ppnPercentage: s.ppn_percentage?.toString() || '11',
        allowedPromos: Array.isArray(s.allowed_promos) ? s.allowed_promos : []
      }));
      
      setData(formatted);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { data, isLoading, error, refetch: fetchSettings };
};

export const useSaveDiscountSettings = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (params: any, options?: any) => {
      setIsPending(true);
      try {
        const payload: any = {
          enable_discount: params.enableDiscount,
          default_discount_price: parseFloat(params.defaultDiscountPrice) || 0,
          enable_ppn: params.enablePPN,
          ppn_percentage: parseFloat(params.ppnPercentage) || 0,
          allowed_promos: Array.isArray(params.allowedPromos) ? params.allowedPromos : [],
          updated_at: new Date().toISOString()
        };

        if (params.outletId && params.outletId !== 'all') {
          payload.outlet_id = parseInt(params.outletId);
        } else {
          payload.outlet_id = null;
        }

        if (params.staffEmail && params.staffEmail !== 'all') {
          payload.staff_email = params.staffEmail;
        } else {
          payload.staff_email = null;
        }

        let query = supabase.from('discount_settings').select('id');
        
        if (payload.outlet_id) {
          query = query.eq('outlet_id', payload.outlet_id);
        } else {
          query = query.is('outlet_id', null);
        }
        
        if (payload.staff_email) {
          query = query.eq('staff_email', payload.staff_email);
        } else {
          query = query.is('staff_email', null);
        }
        
        const { data: existing, error: findError } = await query.maybeSingle();
        
        if (findError) throw findError;

        let resultError;
        if (existing) {
          const { error } = await supabase
            .from('discount_settings')
            .update(payload)
            .eq('id', existing.id);
          resultError = error;
        } else {
          const { error } = await supabase
            .from('discount_settings')
            .insert([payload]);
          resultError = error;
        }

        if (resultError) throw resultError;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useDeleteDiscountSettings = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (id: number, options?: any) => {
      setIsPending(true);
      try {
        const { error } = await supabase
          .from('discount_settings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useListDiscountCategories = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data: categories, error } = await supabase
        .from('discount_categories')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setData(categories || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { data, isLoading, error, refetch: fetchCategories };
};

export const useSaveDiscountCategory = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (note: string, options?: any) => {
      setIsPending(true);
      try {
        const { error } = await supabase
          .from('discount_categories')
          .insert([{ note }]);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};

export const useDeleteDiscountCategory = () => {
  const [isPending, setIsPending] = useState(false);

  return {
    mutate: async (id: number, options?: any) => {
      setIsPending(true);
      try {
        const { error } = await supabase
          .from('discount_categories')
          .delete()
          .eq('id', id);

        if (error) throw error;
        if (options?.onSuccess) options.onSuccess();
      } catch (err) {
        if (options?.onError) options.onError(err);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
    error: null
  };
};
