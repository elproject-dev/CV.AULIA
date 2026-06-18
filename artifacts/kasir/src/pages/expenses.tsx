import { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Edit, Trash2, Wallet, TrendingDown, SlidersHorizontal, Receipt, User, Store, Calendar, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { applyTenantFilter, withTenantOwner, handleTenantError, isTenantSuperAdmin, getTenantOwnerId } from "@/lib/tenant";
import { loadSession } from "@/lib/auth";
import { useListOutlets, useListStaff } from "@/mocks/api-client-react";
import * as XLSX from "xlsx-js-style";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { isTauri, tauriSaveFile } from "@/lib/tauri-file";
import { useCountUp } from "@/hooks/useCountUp";

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
  owner_id?: string;
  outlet_id?: number;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: "operational", name: "Operasional", color: "blue" },
  { id: "inventory", name: "Pengadaan Barang", color: "green" },
  { id: "utilities", name: "Utilitas", color: "yellow" },
  { id: "maintenance", name: "Perawatan", color: "orange" },
  { id: "marketing", name: "Marketing", color: "purple" },
  { id: "salary", name: "Gaji", color: "red" },
  { id: "rent", name: "Sewa", color: "pink" },
  { id: "transport", name: "Transportasi", color: "cyan" },
  { id: "other", name: "Lainnya", color: "slate" },
];

export default function ExpensesPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>(DEFAULT_CATEGORIES);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [totalExpense, setTotalExpense] = useState(0);

  // User filter state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  // Staff data hook
  const { data: allStaff } = useListStaff();

  // Outlet filter state
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");
  const { data: outlets } = useListOutlets();

  // Date filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Download dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadDateRange, setDownloadDateRange] = useState<"today" | "thisMonth" | "custom">("thisMonth");
  const [downloadStartDate, setDownloadStartDate] = useState("");
  const [downloadEndDate, setDownloadEndDate] = useState("");

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    return isTenantSuperAdmin();
  }, [currentUser]);

  const currentUserId = useMemo(() => {
    return currentUser?.id || getTenantOwnerId();
  }, [currentUser]);

  // Check font size for responsive layout adjustments
  const currentFontSize = typeof window !== 'undefined' ? localStorage.getItem('fontSize') || 'small' : 'small';
  const isSmallFont = currentFontSize === 'small' || currentFontSize === 'xsmall';

  // Get current outlet from localStorage
  const currentOutletId = useMemo(() => {
    const outletId = localStorage.getItem('selectedOutletId');
    return outletId ? parseInt(outletId) : null;
  }, []);

  const [formData, setFormData] = useState({
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("id-ID").format(num);
  };

  const parseFormattedNumber = (str: string) => {
    return str.replace(/\./g, "");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFormattedNumber(e.target.value);
    if (rawValue === "" || /^\d+$/.test(rawValue)) {
      const numericValue = rawValue === "" ? "" : parseInt(rawValue, 10);
      setFormData({ ...formData, amount: numericValue.toString() });
    }
  };

  const getFormattedAmount = () => {
    if (formData.amount === "") return "";
    return formatNumber(parseInt(formData.amount, 10));
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    const newId = newCategoryName.toLowerCase().replace(/\s+/g, '-');

    if (categories.some(c => c.id === newId)) {
      toast({ title: "Error", description: "Kategori sudah ada", variant: "destructive" });
      return;
    }

    const colors = ["blue", "green", "yellow", "orange", "purple", "red", "pink", "cyan", "slate"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newCategory: ExpenseCategory = {
      id: newId,
      name: newCategoryName.trim(),
      color: randomColor,
    };

    // Optimistic update
    const updated = [...categories, newCategory];
    setCategories(updated);
    setNewCategoryName("");
    toast({ title: "Sukses", description: "Kategori berhasil ditambahkan" });

    // Save to DB
    const { error } = await supabase.from('expense_categories').insert([newCategory]);
    if (error) {
      toast({ title: "Error", description: "Gagal menyimpan kategori ke database", variant: "destructive" });
      fetchCategories(); // Revert optimistic update
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const isUsed = expenses.some((e) => e.category === id);
    if (isUsed) {
      toast({
        title: "Kategori Digunakan",
        description: "Tidak dapat menghapus kategori yang sedang digunakan oleh pengeluaran.",
        variant: "destructive",
      });
      return;
    }

    // Optimistic update
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);

    // Delete from DB
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Gagal menghapus kategori", variant: "destructive" });
      fetchCategories(); // Revert
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('expense_categories').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        setCategories(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch categories and listen for changes
  useEffect(() => {
    fetchCategories();

    const channel = supabase
      .channel('expense_categories_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_categories' },
        () => {
          fetchCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCategories]);

  // Initial fetch for expenses & users
  useEffect(() => {
    fetchExpenses();
  }, []);

  // Refresh users list when expenses or staff list changes
  useEffect(() => {
    if (expenses.length > 0 || (allStaff && allStaff.length > 0)) {
      fetchUsers();
    }
  }, [expenses, allStaff]);

  // Fetch users for filter dropdown (admin only)
  const fetchUsers = async () => {
    try {
      if (expenses.length === 0) return;

      // 1. Get unique owner_ids from expenses table
      const uniqueOwnerIds = [...new Set(expenses.map(d => d.owner_id).filter(Boolean) as string[])];

      if (uniqueOwnerIds.length === 0) {
        setUsers([]);
        return;
      }

      // 2. Try to get mapping from transactions table (backup source)
      const { data: txs } = await supabase
        .from("transactions")
        .select("owner_id, cashier_name")
        .not("owner_id", "is", null)
        .in("owner_id", uniqueOwnerIds);

      const ownerMap = new Map<string, string>();
      
      // Populate map from staff table (best source)
      if (allStaff && allStaff.length > 0) {
        allStaff.forEach(s => {
          // Priority 1: Direct owner_id column
          if (s.owner_id) {
            ownerMap.set(s.owner_id, s.name);
          }
          // Priority 2: Extract from avatar_url
          if (s.avatar_url) {
            const match = s.avatar_url.match(/\/avatars\/([0-9a-f-]{36})_/i);
            if (match && match[1]) {
              ownerMap.set(match[1].toLowerCase(), s.name);
            }
          }
        });
      }

      // Populate map from transactions (Secondary source)
      if (txs) {
        txs.forEach(tx => {
          if (tx.cashier_name && !ownerMap.has(tx.owner_id)) {
            ownerMap.set(tx.owner_id.toLowerCase(), tx.cashier_name);
          }
        });
      }

      const userOptions: UserOption[] = uniqueOwnerIds.map((id, index) => {
        const lowerId = id.toLowerCase();
        
        // If it's the current user, we can use their name from session
        const isCurrentUser = lowerId === currentUserId?.toLowerCase();
        const currentSessionName = isCurrentUser ? currentUser?.name : null;
        
        // Find staff record from allStaff list
        const staff = allStaff?.find(s => 
          (s.owner_id && s.owner_id.toLowerCase() === lowerId) || 
          (s.avatar_url && s.avatar_url.toLowerCase().includes(lowerId))
        );

        const mappedName = currentSessionName || staff?.name || ownerMap.get(lowerId);

        return {
          id,
          name: mappedName || `Staff ${index + 1}`,
          email: staff?.email || "",
        };
      });

      setUsers(userOptions);
    } catch (error: any) {
      console.error("Error fetching users:", error?.message || error);
      setUsers([]);
    }
  };

  const getStaffNameDisplay = useCallback((ownerId?: string) => {
    if (!ownerId) return "Admin";
    const lowerId = ownerId.toLowerCase();
    
    if (lowerId === currentUserId?.toLowerCase()) {
      return currentUser?.name || "Anda";
    }
    
    // 1. Look in allStaff first (direct and URL extraction)
    const staff = allStaff?.find(s => 
      (s.owner_id && s.owner_id.toLowerCase() === lowerId) || 
      (s.avatar_url && s.avatar_url.toLowerCase().includes(lowerId))
    );
    if (staff) return staff.name;

    // 2. Look in users state
    const mappedUser = users.find(u => u.id.toLowerCase() === lowerId);
    if (mappedUser && !mappedUser.name.startsWith("Staff ")) {
      return mappedUser.name;
    }
    
    return mappedUser?.name || "Staff";
  }, [currentUserId, currentUser, allStaff, users]);

  useEffect(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    setTotalExpense(total);
  }, [expenses]);

  const fetchExpenses = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      let query = supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });

      // Apply tenant filter (already handles admin vs kasir logic)
      query = applyTenantFilter(query);

      // If admin and specific user selected, filter by that user
      if (isAdmin && selectedUserId !== "all") {
        query = query.eq("owner_id", selectedUserId);
      }

      // If specific outlet selected, filter by outlet
      if (selectedOutlet !== "all") {
        query = query.eq("outlet_id", parseInt(selectedOutlet));
      }

      // Date filters
      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      if (showLoading) {
        toast({ title: "Error", description: "Gagal memuat data pengeluaran", variant: "destructive" });
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [isAdmin, selectedUserId, selectedOutlet, startDate, endDate, applyTenantFilter, toast]);

  // Refetch when user or outlet filter changes, and setup realtime subscription
  useEffect(() => {
    fetchExpenses();

    const channel = supabase
      .channel('expenses_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        (payload) => {
          // Fetch silently when realtime update occurs
          fetchExpenses(false);
        }
      )
      .subscribe((status) => {
        // Silently handle subscription status
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses]);

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(search.toLowerCase()) ||
      expense.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        category: expense.category,
        description: expense.description,
        amount: expense.amount.toString(),
        date: expense.date,
      });
    } else {
      setEditingExpense(null);
      setFormData({
        category: "",
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.category || !formData.description || !formData.amount) {
      toast({ title: "Error", description: "Semua field wajib diisi", variant: "destructive" });
      return;
    }

    const payload = withTenantOwner({
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount),
      date: formData.date,
      outlet_id: currentOutletId || undefined,
    }, "expenses");

    try {
      if (editingExpense) {
        const query = applyTenantFilter(
          supabase
            .from("expenses")
            .update(payload)
            .eq("id", editingExpense.id)
        );
        const { error } = await query;

        if (error) throw error;
        toast({ title: "Sukses", description: "Pengeluaran berhasil diperbarui" });
      } else {
        const { error } = await supabase.from("expenses").insert(payload);

        if (error) throw error;
        toast({ title: "Sukses", description: "Pengeluaran berhasil ditambahkan" });
      }

      setIsDialogOpen(false);
      fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      handleTenantError(error);
      toast({ title: "Error", description: "Gagal menyimpan pengeluaran", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus pengeluaran ini?")) return;

    try {
      const query = applyTenantFilter(
        supabase.from("expenses").delete().eq("id", id)
      );
      const { error } = await query;
      if (error) throw error;
      toast({ title: "Sukses", description: "Pengeluaran berhasil dihapus" });
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      handleTenantError(error);
      toast({ title: "Error", description: "Gagal menghapus pengeluaran", variant: "destructive" });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportExpenses = async (period: 'today' | 'thisMonth') => {
    try {
      setDownloadLoading(true);

      let filtered = expenses; // expenses is already filtered by API for outlet/user

      const now = new Date();
      if (period === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter(e => new Date(e.date) >= today);
      } else if (period === 'thisMonth') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        filtered = filtered.filter(e => new Date(e.date) >= firstDayOfMonth);
      }

      if (filtered.length === 0) {
        toast({ title: "Info", description: `Tidak ada pengeluaran untuk periode ini`, variant: "destructive" });
        return;
      }

      // Format Data for Excel
      const data = filtered.map((exp, index) => {
        const staffName = getStaffNameDisplay(exp.owner_id);
        const outletName = outlets?.find(o => o.id === exp.outlet_id)?.name || "Semua Outlet";
        return {
          "No": index + 1,
          "Tanggal": formatDate(exp.date),
          "Kategori": getCategoryLabel(exp.category),
          "Deskripsi": exp.description,
          "Staff": staffName,
          "Outlet": outletName,
          "Jumlah": exp.amount
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);

      // Add column widths
      ws["!cols"] = [
        { wch: 5 },  // No
        { wch: 15 }, // Tanggal
        { wch: 20 }, // Kategori
        { wch: 40 }, // Deskripsi
        { wch: 15 }, // Staff
        { wch: 20 }, // Outlet
        { wch: 20 }, // Jumlah
      ];

      // Styles
      const HEADER_STYLE = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        }
      };

      const STRIPE_WHITE = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
      const STRIPE_GRAY = { patternType: "solid", fgColor: { rgb: "F2F2F2" } };
      const GRID_BORDER = {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } },
      };

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:G1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = { c: C, r: R };
          const cellRef = XLSX.utils.encode_cell(cellAddress);
          if (!ws[cellRef]) {
            ws[cellRef] = { t: "s", v: "" };
          }
          const cell = ws[cellRef];

          let horizontalAlign: "left" | "center" | "right" = "left";
          if (C === 0 || C === 1) horizontalAlign = "center"; // No, Tanggal
          else if (C === 6) horizontalAlign = "right"; // Jumlah (last column index G = 6)

          if (R === 0) {
            // Header
            cell.s = {
              ...HEADER_STYLE,
              alignment: { horizontal: horizontalAlign, vertical: "center", wrapText: false }
            };
          } else {
            // Data
            const stripe = (R - 1) % 2 === 0 ? STRIPE_WHITE : STRIPE_GRAY;
            cell.s = {
              alignment: { horizontal: horizontalAlign, vertical: "center", wrapText: false },
              fill: stripe,
              border: GRID_BORDER
            };

            if (C === 6) { // Jumlah
              cell.s.numFmt = "#,##0";
              if (typeof cell.v === 'number' || !isNaN(Number(cell.v))) {
                if (typeof cell.v !== 'number') {
                  cell.v = Number(cell.v);
                }
                cell.t = 'n';
              }
            }
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pengeluaran");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const fileName = `Laporan_Pengeluaran_${period === 'today' ? 'HariIni' : 'BulanIni'}_${now.getTime()}.xlsx`;

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          await Filesystem.writeFile({
            path: fileName,
            data: base64data,
            directory: Directory.Documents,
            recursive: true
          });
          const filePath = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Documents
          });
          await Share.share({
            title: "Download Laporan Pengeluaran",
            url: filePath.uri
          });
        };
      } else if (isTauri()) {
        // Tauri desktop: Use native save dialog
        await tauriSaveFile(
          excelBuffer,
          fileName,
          [{ name: "Excel Files", extensions: ["xlsx"] }]
        );
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast({ title: "Sukses", description: `Berhasil download laporan pengeluaran` });
      setShowDownloadDialog(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Gagal mendownload laporan", variant: "destructive" });
    } finally {
      setDownloadLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getCategoryLabel = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    const color = category?.color || "slate";

    const colorMap: Record<string, string> = {
      blue: "bg-blue-600 dark:bg-blue-700 text-white",
      green: "bg-green-600 dark:bg-green-700 text-white",
      yellow: "bg-yellow-500 dark:bg-yellow-600 text-white",
      orange: "bg-orange-500 dark:bg-orange-600 text-white",
      purple: "bg-purple-600 dark:bg-purple-700 text-white",
      red: "bg-red-600 dark:bg-red-700 text-white",
      pink: "bg-pink-600 dark:bg-pink-700 text-white",
      cyan: "bg-cyan-600 dark:bg-cyan-700 text-white",
      slate: "bg-slate-600 dark:bg-slate-700 text-white",
    };
    return colorMap[color] || colorMap.slate;
  };

  const getBadgeDotColor = (color: string) => {
    const map: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      purple: "bg-purple-500",
      red: "bg-red-500",
      pink: "bg-pink-500",
      cyan: "bg-cyan-500",
      slate: "bg-slate-500",
    };
    return map[color] || map.slate;
  };

  // Hitung metrik hari ini dan bulan ini
  const { todayTotal, todayCount, thisMonthTotal, thisMonthCount, currentDay } = useMemo(() => {
    const now = new Date();
    // Gunakan format YYYY-MM-DD lokal
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonthLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let tTotal = 0;
    let tCount = 0;
    let mTotal = 0;
    let mCount = 0;

    expenses.forEach(e => {
      if (e.date === todayLocal) {
        tTotal += e.amount;
        tCount++;
      }
      if (e.date.startsWith(currentMonthLocal)) {
        mTotal += e.amount;
        mCount++;
      }
    });

    const cDay = now.getDate();
    return {
      todayTotal: tTotal,
      todayCount: tCount,
      thisMonthTotal: mTotal,
      thisMonthCount: mCount,
      currentDay: cDay
    };
  }, [expenses]);

  const animatedTodayTotal = useCountUp(todayTotal, { duration: 1200 });
  const animatedThisMonthTotal = useCountUp(thisMonthTotal, { duration: 1600 });
  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map((e) => e.amount)) : 0;
  const animatedMaxExpense = useCountUp(maxExpense, { duration: 1400 });
  const animatedTotalExpense = useCountUp(totalExpense, { duration: 1800 });
  
  const animatedTodayCount = useCountUp(todayCount, { duration: 1000 });
  const animatedThisMonthCount = useCountUp(thisMonthCount, { duration: 1200 });
  const animatedTotalCount = useCountUp(expenses.length, { duration: 1400 });

  return (
    <Sidebar>
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Wallet className="w-6 h-6 text-primary" />
                Pengeluaran
              </h1>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto mt-3 sm:mt-0">
              <Button variant="outline" onClick={() => setShowDownloadDialog(true)} className="w-full sm:w-auto">
                <FileDown className="w-4 h-4 mr-2" />
                Download
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} className="w-full sm:w-auto">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Kategori
                </Button>
              )}
              <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Pengeluaran
              </Button>
            </div>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-5 items-stretch">
            {/* Pengeluaran Hari Ini */}
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">Pengeluaran Hari Ini</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatCurrency(animatedTodayTotal.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-blue-200">{animatedTodayCount.value} transaksi hari ini</p>
              </div>
            </div>

            {/* Pengeluaran Bulan Ini */}
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-purple-100 text-xs sm:text-sm font-medium">Pengeluaran Bulan Ini</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {formatCurrency(animatedThisMonthTotal.value)}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Receipt className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-purple-200">{animatedThisMonthCount.value} transaksi bulan ini</p>
              </div>
            </div>

            {/* Tertinggi */}
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-amber-100 text-xs sm:text-sm font-medium">Tertinggi</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1 truncate">
                      {expenses.length > 0 ? formatCurrency(animatedMaxExpense.value) : "Rp 0"}
                    </p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-amber-200">single transaction</p>
              </div>
            </div>

            {/* Total Pengeluaran */}
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg h-full">
              <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-red-100 text-xs sm:text-sm font-medium">Total Pengeluaran</p>
                    <p className="text-lg sm:text-lg md:text-xl font-bold text-white leading-tight mt-1">{formatCurrency(animatedTotalExpense.value)}</p>
                  </div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
                <p className="text-xs mt-3 text-red-200">{animatedTotalCount.value} transaksi</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Cari pengeluaran..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-full sm:w-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4 mr-2 text-primary" />
                  <span className="font-medium">Filter</span>

                  {/* Indicator if any filter is active */}
                  {(selectedCategory !== "all" || selectedOutlet !== "all" || selectedUserId !== "all" || startDate !== "" || endDate !== "") && (
                    <span className="ml-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] sm:w-[380px] p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  Filter Pengeluaran
                </div>

                <div className="space-y-4">
                  {/* Date Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">Rentang Tanggal</Label>
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
                          onChange={(e: any) => setStartDate(e.target.value)}
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
                          onChange={(e: any) => setEndDate(e.target.value)}
                          onClick={(e: any) => {
                            try { e.target.showPicker?.(); } catch (err) { }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Tanggal Akhir"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">Kategori</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="Semua Kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Outlet Filter (Admin Only) */}
                  {isAdmin && outlets && outlets.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-500">Outlet / Cabang</Label>
                      <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                        <SelectTrigger className="w-full h-9">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Semua Outlet" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Outlet</SelectItem>
                          {outlets.map((outlet: any) => (
                            <SelectItem key={outlet.id} value={outlet.id.toString()}>
                              {outlet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* User Filter (Admin Only) */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-500">Staff / Kasir</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="w-full h-9">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Semua Staff" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Staff</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Reset Button */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs"
                    onClick={() => {
                      setSelectedCategory("all");
                      setSelectedOutlet("all");
                      setSelectedUserId("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                    disabled={selectedCategory === "all" && selectedOutlet === "all" && selectedUserId === "all" && !startDate && !endDate}
                  >
                    Atur Ulang Filter
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* ── MOBILE & TABLET: Card List ── */}
          <div className="flex flex-col gap-3 lg:hidden pb-6">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                  <p>Memuat data...</p>
                </div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-10 text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Belum ada data pengeluaran</p>
                    <p className="text-sm text-slate-400 mt-1">Tambahkan pengeluaran pertama Anda</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog()} className="mt-2">
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Pengeluaran
                  </Button>
                </div>
              </div>
            ) : (
              filteredExpenses.map((expense) => {
                const staffName = getStaffNameDisplay(expense.owner_id);
                return (
                  <div key={expense.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        {formatDate(expense.date)}
                      </div>
                      <div className="font-bold text-red-600 dark:text-red-400 text-base whitespace-nowrap text-right">
                        {formatCurrency(expense.amount)}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-slate-700 dark:text-slate-300 font-medium break-words flex-1">
                        {expense.description}
                      </div>
                      <div className="shrink-0">
                        <span className={`inline-flex px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full ${getCategoryColor(expense.category)}`}>
                          {getCategoryLabel(expense.category)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {staffName}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5" />
                            {outlets?.find(o => o.id === expense.outlet_id)?.name || "Semua Outlet"}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(expense)}
                            className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(expense.id)}
                            className="h-8 w-8 text-red-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── DESKTOP LARGE: Table (hidden on tablet and below) ── */}
          <div className="hidden lg:block rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Daftar Pengeluaran</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableHead className="w-12 font-semibold">No</TableHead>
                  <TableHead className="font-semibold">Tanggal</TableHead>
                  <TableHead className="text-center font-semibold">Kategori</TableHead>
                  <TableHead className="font-semibold">Deskripsi</TableHead>
                  <TableHead className="font-semibold">Staff</TableHead>
                  {isAdmin && <TableHead className="font-semibold">Outlet</TableHead>}
                  <TableHead className="text-right font-semibold">Jumlah</TableHead>
                  {isAdmin && <TableHead className="text-right w-28 font-semibold">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-16 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                        <p>Memuat data...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-16 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                          <Wallet className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-300">Belum ada data pengeluaran</p>
                          <p className="text-sm text-slate-400 mt-1">Tambahkan pengeluaran pertama Anda</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog()} className="mt-2">
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Pengeluaran
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense, index) => (
                    <TableRow key={expense.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm relative hover:z-10 transition-all duration-200 cursor-pointer">
                      <TableCell className="text-slate-400 font-medium">{index + 1}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {formatDate(expense.date)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex px-3 py-1.5 text-xs font-medium rounded-full ${getCategoryColor(
                            expense.category
                          )}`}
                        >
                          {getCategoryLabel(expense.category)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-white font-medium max-w-[200px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {getStaffNameDisplay(expense.owner_id)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {outlets?.find(o => o.id === expense.outlet_id)?.name || "Semua Outlet"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(expense)}
                              className="h-8 w-8 sm:h-9 sm:w-9"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(expense.id)}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Pengeluaran" : "Tambah Pengeluaran Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">Kategori</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category" className="h-11">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Deskripsi</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Contoh: Beli ATK, Bayar listrik"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium">Jumlah (Rp)</Label>
              <Input
                id="amount"
                type="text"
                value={getFormattedAmount()}
                onChange={handleAmountChange}
                placeholder="0"
                className="h-11 text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">Tanggal</Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-11 pr-10 w-full custom-date-input"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11">
              Batal
            </Button>
            <Button onClick={handleSubmit} className="h-11 px-6">
              {editingExpense ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kelola Kategori Pengeluaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nama kategori baru..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddCategory();
                  }
                }}
              />
              <Button onClick={handleAddCategory}>Tambah</Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg group">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${getBadgeDotColor(cat.color)}`} />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{cat.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-4">Belum ada kategori</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Excel Dialog for Expenses */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" />
              Download Laporan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih periode untuk download pengeluaran (Excel)
            </DialogDescription>
          </DialogHeader>

          {isAdmin && (
            <div className="space-y-2 mt-2">
              {outlets && outlets.length > 0 && (
                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Semua Outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Outlet</SelectItem>
                    {outlets.map((outlet: any) => (
                      <SelectItem key={outlet.id} value={outlet.id.toString()}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Semua Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Staff</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 py-4">
            <button
              onClick={() => handleExportExpenses('today')}
              disabled={downloadLoading || isLoading}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors border-2 border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-slate-700">Hari Ini</p>
                <p className="text-xs text-slate-500 font-normal truncate">
                  {selectedOutlet === "all" ? "Semua outlet" : `Outlet: ${outlets?.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet}`}
                  {selectedUserId !== "all" && ` | Staff: ${users.find(u => u.id === selectedUserId)?.name || selectedUserId}`}
                </p>
              </div>
            </button>

            <button
              onClick={() => handleExportExpenses('thisMonth')}
              disabled={downloadLoading || isLoading}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors border-2 border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-slate-700">Bulan Ini</p>
                <p className="text-xs text-slate-500 font-normal truncate">
                  {selectedOutlet === "all" ? "Semua outlet" : `Outlet: ${outlets?.find(o => o.id.toString() === selectedOutlet)?.name || selectedOutlet}`}
                  {selectedUserId !== "all" && ` | Staff: ${users.find(u => u.id === selectedUserId)?.name || selectedUserId}`}
                </p>
              </div>
            </button>

            <p className="text-xs text-slate-500 text-center pt-2">
              {expenses.length} pengeluaran ditemukan pada filter saat ini
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDownloadDialog(false)}
              className="w-full"
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
