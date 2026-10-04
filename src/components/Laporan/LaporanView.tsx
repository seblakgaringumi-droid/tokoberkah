import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Receipt, 
  Plus, 
  Calendar, 
  Printer, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Eye,
  Package,
  ShoppingBag,
  Filter, 
  CreditCard,
  Edit2,
  CheckCircle2,
  X,
  Target,
  SlidersHorizontal,
  FileText,
  Building2,
  Landmark,
  ShieldCheck,
  AlertTriangle,
  Coins,
  Check,
  Info,
  CalendarRange,
  ArrowRight,
  Clock,
  RefreshCw,
  MessageCircle
} from 'lucide-react';
import { Sale, Expense, StoreWallet, StoreProfile, DebtPayment, DebtCredit, SaleItem, Product } from '../../types';
import { formatRupiah, formatDate, formatDateTime, playBeep, isStockExpense, getLocalDate, isValidSale } from '../../lib/utils';
import { useFinance } from '../../context/FinanceContext';
import { createExpense, deleteExpense, cleanupDuplicateExpenses, updateStoreWallet, upsertStoreWallet, syncCompletedOrdersToSales, getLocalDebtPayments, getSaleDebtInfo, getLocalOrders, getLocalProducts, getLocalSales, parseNotesToItems } from '../../services/api';
import { ReceiptModal } from '../ReceiptModal';
import { ArusKasLaciCard } from './ArusKasLaciCard';
import { SinkingFundCard } from './SinkingFundCard';
import { CadanganAkumulasiCard } from './CadanganAkumulasiCard';
import { TrenChartCard } from './TrenChartCard';
import { AnalisisBEPModal } from './AnalisisBEPModal';
import { OpnameKasModal } from './OpnameKasModal';
import { CetakLaporanModal } from './CetakLaporanModal';
import { CetakBiayaModal } from './CetakBiayaModal';
import { DetailStrukModal } from './DetailStrukModal';
import { CalendarRangeModal } from './CalendarRangeModal';

export { isStockExpense };

export type DateFilterType = 'hari_ini' | 'minggu_ini' | 'pilih_bulan' | 'pilih_tahun' | 'custom_range' | 'semua';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface LaporanViewProps {
  sales: Sale[];
  expenses: Expense[];
  wallet: StoreWallet | null;
  products?: Product[];
  onRefresh: () => Promise<void>;
  debts?: DebtCredit[];
  debtPayments?: DebtPayment[];
  storeProfile?: StoreProfile;
  onUpdateStoreProfile?: (profile: StoreProfile) => void;
  onExpenseCreated?: (expense: Expense) => void;
  onExpenseDeleted?: (id: string) => void;
  onWalletUpdated?: (wallet: StoreWallet) => void;
  onSaleUpdated?: (updatedSale: Sale) => void;
  onDebtPaid?: (payment: any) => void;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  sales,
  expenses,
  wallet,
  products = [],
  onRefresh,
  debts = [],
  debtPayments,
  storeProfile,
  onUpdateStoreProfile,
  onExpenseCreated,
  onExpenseDeleted,
  onWalletUpdated,
  onSaleUpdated,
  onDebtPaid,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ringkasan' | 'penjualan' | 'pengeluaran' | 'dompet'>('ringkasan');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('hari_ini');

  // Month & Year selection state
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Custom Date Range state (YYYY-MM-DD)
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Dynamically compute list of years from data + reasonable range
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set<number>([currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]);
    sales.forEach(s => {
      if (s.created_at) {
        const y = new Date(s.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    expenses.forEach(e => {
      if (e.created_at) {
        const y = new Date(e.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [sales, expenses]);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<'STOK' | 'OPERASIONAL'>('STOK');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | string>('');
  const [expenseCategory, setExpenseCategory] = useState('OPERASIONAL');
  const [expenseSource, setExpenseSource] = useState<'LACI' | 'KAS_BESAR'>('LACI');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Expense Source Filter for "Pengeluaran" tab
  const [expenseSourceFilter, setExpenseSourceFilter] = useState<'semua' | 'LACI' | 'KAS_BESAR'>('semua');

  // Quick Action Modals
  const [isBEPModalOpen, setIsBEPModalOpen] = useState(false);
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [isCetakModalOpen, setIsCetakModalOpen] = useState(false);
  const [isCetakBiayaModalOpen, setIsCetakBiayaModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // Store Wallet Edit Modal
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletForm, setWalletForm] = useState<StoreWallet>({
    id: 1,
    initial_cash: 500000,
    shopping_budget: 2000000,
    operational_budget: 750000,
    owner_budget: 1000000,
  });
  const [isSubmittingWallet, setIsSubmittingWallet] = useState(false);

  // Receipt reprint modal & detail modal
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState<Sale | null>(null);
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(new Set());

  // Global QRIS balance adjustment state via FinanceContext
  const { manualQrisBalance, updateManualQrisBalance } = useFinance();
  const handleUpdateQrisBalance = updateManualQrisBalance;

  // Auto-Sync Retroactive Online Orders state
  const [isSyncingOnline, setIsSyncingOnline] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Auto-sync completed online orders on mount
  useEffect(() => {
    let isMounted = true;
    const autoSync = async () => {
      try {
        setIsSyncingOnline(true);
        const res = await syncCompletedOrdersToSales();
        if (isMounted && res.syncedCount > 0) {
          setSyncStatusMsg(`Sinkronisasi Berhasil: ${res.syncedCount} pesanan online selesai telah dibukukan otomatis ke laporan.`);
          await onRefresh();
        }
      } catch (err) {
        console.warn('Auto sync completed orders note:', err);
      } finally {
        if (isMounted) setIsSyncingOnline(false);
      }
    };
    autoSync();
    return () => { isMounted = false; };
  }, []);

  const handleManualSyncOnline = async () => {
    try {
      setIsSyncingOnline(true);
      const res = await syncCompletedOrdersToSales();
      if (res.syncedCount > 0) {
        setSyncStatusMsg(`Berhasil membukukan ${res.syncedCount} pesanan online selesai ke laporan!`);
        playBeep('success');
      } else {
        setSyncStatusMsg('Semua pesanan online selesai sudah sinkron & tercatat dalam laporan.');
      }
      await onRefresh();
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      alert(`Gagal sinkronisasi pesanan online: ${err.message}`);
    } finally {
      setIsSyncingOnline(false);
    }
  };

  const toggleExpandSale = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Date filtering helper with precise Asia/Jakarta (WIB) timezone matching
  const filterByDate = (dateStr?: string | null) => {
    if (dateFilter === 'semua') return true;
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim() || dateStr.trim() === '-' || dateStr.trim() === 'null') return false;
    const txDateStr = getLocalDate(dateStr.trim());
    if (!txDateStr) return false;

    const todayStr = getLocalDate(new Date());

    if (dateFilter === 'hari_ini') {
      return txDateStr === todayStr;
    }

    if (dateFilter === 'minggu_ini') {
      const [y, m, d] = (todayStr || '2026-09-07').split('-').map(Number);
      const start7 = new Date(y, m - 1, d - 6);
      const startKey = `${start7.getFullYear()}-${String(start7.getMonth() + 1).padStart(2, '0')}-${String(start7.getDate()).padStart(2, '0')}`;
      return txDateStr >= startKey && txDateStr <= todayStr;
    }

    if (dateFilter === 'pilih_bulan') {
      const targetMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      return txDateStr.startsWith(targetMonthStr);
    }

    if (dateFilter === 'pilih_tahun') {
      return txDateStr.startsWith(`${selectedYear}-`);
    }

    if (dateFilter === 'custom_range') {
      if (customStartDate && txDateStr < customStartDate) return false;
      if (customEndDate && txDateStr > customEndDate) return false;
      return true;
    }

    return true;
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => isValidSale(s) && filterByDate(s.created_at));
  }, [sales, dateFilter, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => filterByDate(e.created_at));
  }, [expenses, dateFilter, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Financial Metrics
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  }, [filteredSales]);

  // Helper to determine if a debt payment is a status correction or for a past debt created before today's shift
  const isPastDebtPayment = (dp: DebtPayment): boolean => {
    if (!dp) return false;

    const method = (dp.payment_method || '').toUpperCase();
    const notes = (dp.notes || '').toLowerCase();

    // Check if explicitly marked as past adjustment, correction, or menu utang adjustment
    if (
      method.includes('KOREKSI') ||
      method.includes('NON_KAS') ||
      method.includes('MASA_LALU') ||
      notes.includes('koreksi') ||
      notes.includes('pembukuan masa lalu') ||
      notes.includes('tanpa masuk laci') ||
      notes.includes('menu utang') ||
      notes.includes('utang masa lalu') ||
      notes.includes('pelunasan nota') ||
      notes.includes('pelunasan piutang') ||
      notes.includes('pelunasan utang')
    ) {
      return true;
    }

    // Check if associated debt or sale was created before today
    const dpDebtId = String(dp.debt_id || '').toLowerCase();
    const todayStr = getLocalDate();

    const matchedDebt = (debts || []).find((d) => {
      if (!d) return false;
      const dId = String(d.id || '').toLowerCase();
      if (dpDebtId && (dId === dpDebtId || dpDebtId.includes(dId) || dId.includes(dpDebtId))) return true;
      if (notes && d.notes && notes.includes(d.notes.toLowerCase())) return true;
      return false;
    });

    if (matchedDebt && matchedDebt.created_at) {
      const debtDateStr = matchedDebt.created_at.substring(0, 10);
      if (debtDateStr < todayStr) {
        return true;
      }
    }

    const matchedSale = (sales || []).find((s) => {
      if (!s) return false;
      const sId = String(s.id || '').toLowerCase();
      const shortId = sId.slice(0, 8);
      if (dpDebtId && (dpDebtId === sId || dpDebtId.includes(shortId))) return true;
      if (notes && (notes.includes(sId) || notes.includes(shortId))) return true;
      return false;
    });

    if (matchedSale && matchedSale.created_at) {
      const saleDateStr = matchedSale.created_at.substring(0, 10);
      if (saleDateStr < todayStr) {
        return true;
      }
    }

    return false;
  };

  // Pelunasan Utang Pelanggan (Buku Utang)
  const effectiveDebtPayments = useMemo(() => {
    if (debtPayments && Array.isArray(debtPayments)) {
      return debtPayments;
    }
    return getLocalDebtPayments();
  }, [debtPayments]);

  const filteredDebtPayments = useMemo(() => {
    return effectiveDebtPayments.filter((dp) => filterByDate(dp.created_at));
  }, [effectiveDebtPayments, dateFilter, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const debtPaymentsCash = useMemo(() => {
    return filteredDebtPayments
      .filter((dp) => {
        const m = (dp.payment_method || 'TUNAI').toUpperCase();
        if (m.includes('KOREKSI') || m.includes('NON_KAS') || m.includes('MASA_LALU')) return false;

        // On today's shift cash drawer view (Hari Ini), exclude past debt status adjustments
        if (dateFilter === 'hari_ini') {
          const notes = (dp.notes || '').toLowerCase();
          const isExplicitShiftCash = notes.includes('laci shift') || notes.includes('kasir shift');
          const isPastDebt = isPastDebtPayment(dp);
          if (isPastDebt && !isExplicitShiftCash) {
            return false;
          }
        }

        return m === 'TUNAI' || m === 'CASH';
      })
      .reduce((acc, dp) => acc + (Number(dp.amount) || 0), 0);
  }, [filteredDebtPayments, dateFilter, debts, sales]);

  const debtPaymentsQris = useMemo(() => {
    return filteredDebtPayments
      .filter((dp) => {
        const m = (dp.payment_method || '').toUpperCase();
        if (m.includes('KOREKSI') || m.includes('NON_KAS') || m.includes('MASA_LALU')) return false;

        if (dateFilter === 'hari_ini') {
          const notes = (dp.notes || '').toLowerCase();
          const isExplicitShiftCash = notes.includes('laci shift') || notes.includes('kasir shift');
          const isPastDebt = isPastDebtPayment(dp);
          if (isPastDebt && !isExplicitShiftCash) {
            return false;
          }
        }

        return m === 'QRIS' || m === 'BANK' || m === 'TRANSFER';
      })
      .reduce((acc, dp) => acc + (Number(dp.amount) || 0), 0);
  }, [filteredDebtPayments, dateFilter, debts, sales]);

  const totalDebtPayments = debtPaymentsCash + debtPaymentsQris;

  const totalCost = useMemo(() => {
    let cost = 0;
    for (const sale of filteredSales) {
      if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
        for (const it of sale.items) {
          cost += (Number(it.cost_price) || 0) * (Number(it.qty_kg || it.qty) || 0);
        }
      } else if (sale.sale_items && Array.isArray(sale.sale_items) && sale.sale_items.length > 0) {
        for (const it of sale.sale_items) {
          cost += (Number(it.cost_price) || 0) * (Number(it.qty_kg || it.qty) || 0);
        }
      } else {
        cost += (Number(sale.total_amount) || 0) * 0.8;
      }
    }
    return cost;
  }, [filteredSales]);

  const totalGrossProfit = Math.max(0, totalRevenue - totalCost);

  // 1. Modul Ringkasan Kas & Arus Kas Laci
  const initialCash = wallet?.initial_cash ?? 500000;

  const cashSales = useMemo(() => {
    return filteredSales
      .filter((s) => {
        const m = (s.payment_method || '').toUpperCase();
        return m === 'CASH' || m === 'TUNAI';
      })
      .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  }, [filteredSales]);

  // Saldo Transaksi QRIS / Non-Tunai Otomatis dari Penjualan + Pelunasan QRIS
  const autoQrisSales = useMemo(() => {
    const qrisFromSales = filteredSales
      .filter((s) => {
        const m = (s.payment_method || '').toUpperCase();
        return m === 'QRIS' || m === 'BANK' || m === 'TRANSFER' || m === 'NON_TUNAI' || m.includes('QRIS') || m.includes('TRANSFER');
      })
      .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    return qrisFromSales + debtPaymentsQris;
  }, [filteredSales, debtPaymentsQris]);

  // Saldo QRIS efektif (menggunakan penyesuaian manual jika diset, atau otomatis dari penjualan)
  const effectiveQrisBalance = manualQrisBalance !== null ? manualQrisBalance : autoQrisSales;

  // Expenses grouped by source (Laci vs Kas Besar) and category (Belanja Stok vs Biaya Operasional)
  const drawerOperationalExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => {
        const isDrawer = (e.source || 'LACI') === 'LACI';
        return isDrawer && !isStockExpense(e);
      })
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const drawerStockExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => {
        const isDrawer = (e.source || 'LACI') === 'LACI';
        return isDrawer && isStockExpense(e);
      })
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const totalOperationalExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => !isStockExpense(e))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const totalStockExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => isStockExpense(e))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const kasBesarExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => (e.source || '').toUpperCase() === 'KAS_BESAR')
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  // FORMULA 1: TOTAL UANG FISIK AKTUAL LACI
  // = Modal Awal + Penjualan Tunai + Pelunasan Utang Tunai - Biaya Operasional Laci - Belanja Stok Laci
  // *Catatan: Pengeluaran dari Kas Besar TIDAK mengurangi uang fisik laci kasir harian!*
  const totalActualDrawerCash = initialCash + cashSales + debtPaymentsCash - drawerOperationalExpenses - drawerStockExpenses;

  // FORMULA 2: TOTAL KAS TOKO (TUNAI + QRIS)
  // = Modal Awal + Penjualan Tunai + Saldo QRIS + Pelunasan Utang - Biaya Operasional Laci - Belanja Stok Laci
  // *Pelunasan Tunai menambah uang fisik laci, Pelunasan QRIS menambah Saldo QRIS Toko.*
  const totalKasToko = initialCash + cashSales + effectiveQrisBalance + debtPaymentsCash - drawerOperationalExpenses - drawerStockExpenses;

  // FORMULA 3: ESTIMASI LABA BERSIH (PERBAIKAN RUMUS)
  // Laba Bersih = Laba Kotor - Biaya Operasional
  // *Catatan Penting: Belanja Stok (Restok) adalah konversi Kas menjadi Aset Persediaan/Inventory.
  // HPP barang sudah otomatis terhitung saat produk terjual (Laba Kotor).
  // Oleh karena itu, Belanja Stok TIDAK boleh memotong Laba Bersih.*
  const dailyDrawerNetProfit = totalGrossProfit - drawerOperationalExpenses;
  const netProfit = totalGrossProfit - totalOperationalExpenses;

  // 2. Modul Alokasi Kewajiban & Reservasi Dana (Sinking Fund)
  const DAILY_RENT_TARGET = 22000; // Rp 8.000.000 / tahun
  const DAILY_BANK_TARGET = 173400; // Rp 5.200.000 / bulan
  const TOTAL_DAILY_OBLIGATIONS = DAILY_RENT_TARGET + DAILY_BANK_TARGET; // Rp 195.400 / hari

  const netCashFlow = cashSales + debtPaymentsCash - drawerOperationalExpenses - drawerStockExpenses;
  const netAvailableCash = totalActualDrawerCash - TOTAL_DAILY_OBLIGATIONS;

  // Average margin for BEP analysis
  const averageMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 18.5;
  const averageDailyExpense = drawerOperationalExpenses || 25000;

  // Breakdown by payment method
  const paymentMethodStats = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const s of filteredSales) {
      const m = s.payment_method || 'CASH';
      if (!map[m]) map[m] = { count: 0, total: 0 };
      map[m].count += 1;
      map[m].total += Number(s.total_amount) || 0;
    }
    return map;
  }, [filteredSales]);

  // Filtered expense list for tab view
  const displayedExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => {
      if (expenseSourceFilter === 'semua') return true;
      const src = e.source || 'LACI';
      return src === expenseSourceFilter;
    });
  }, [filteredExpenses, expenseSourceFilter]);

  // Identification of duplicate expenses (same title, amount, and date YYYY-MM-DD)
  const duplicateExpensesMap = useMemo(() => {
    const seenMap = new Map<string, string>();
    const dupIds = new Set<string>();

    const sorted = [...filteredExpenses].sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

    for (const exp of sorted) {
      if (!exp || !exp.id) continue;
      const cleanTitle = (exp.title || '').trim().toLowerCase();
      const dateDay = exp.created_at ? exp.created_at.substring(0, 10) : '';
      const amountVal = Number(exp.amount) || 0;
      const key = `${cleanTitle}_${amountVal}_${dateDay}`;

      if (seenMap.has(key)) {
        dupIds.add(exp.id);
      } else {
        seenMap.set(key, exp.id);
      }
    }

    return dupIds;
  }, [filteredExpenses]);

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const handleCleanupDuplicates = async () => {
    const count = duplicateExpensesMap.size;
    if (count === 0) {
      alert('Tidak ditemukan transaksi duplikat pada periode ini.');
      return;
    }

    if (!window.confirm(`Ditemukan ${count} transaksi Biaya Toko duplikat (produk/nominal/tanggal sama).\n\nHapus ${count} transaksi duplikat ini dan sisakan 1 transaksi asli?`)) {
      return;
    }

    try {
      setIsCleaningDuplicates(true);
      const res = await cleanupDuplicateExpenses();
      playBeep('success');
      alert(`Berhasil membersihkan ${res.totalRemoved} transaksi pengeluaran duplikat! Data Laporan Biaya Toko kini sudah bersih dan valid.`);
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal membersihkan duplikat: ${err.message}`);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  // Handle Add Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!expenseTitle.trim() || isNaN(amt) || amt <= 0) {
      alert('Lengkapi judul dan nominal pengeluaran!');
      return;
    }

    const finalCategory = expenseType === 'STOK' ? 'BELANJA_STOK' : (expenseCategory || 'OPERASIONAL');

    try {
      setIsSubmittingExpense(true);
      const created = await createExpense({
        title: expenseTitle.trim(),
        amount: amt,
        category: finalCategory,
        source: expenseSource,
      });
      playBeep('success');
      setIsExpenseModalOpen(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseCategory('OPERASIONAL');
      setExpenseType('STOK');
      setExpenseSource('LACI');
      if (onExpenseCreated && created) onExpenseCreated(created);
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menyimpan pengeluaran: ${err.message}`);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string, title: string) => {
    if (!window.confirm(`Hapus catatan pengeluaran "${title}"?`)) return;
    try {
      await deleteExpense(id);
      playBeep('beep');
      if (onExpenseDeleted) onExpenseDeleted(id);
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menghapus pengeluaran: ${err.message}`);
    }
  };

  // Handle Save Wallet
  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingWallet(true);
      const updated = await upsertStoreWallet(walletForm);
      playBeep('success');
      setIsWalletModalOpen(false);
      if (onWalletUpdated && updated) onWalletUpdated(updated);
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menyimpan dompet toko: ${err.message}`);
    } finally {
      setIsSubmittingWallet(false);
    }
  };

  const getPeriodLabel = () => {
    if (dateFilter === 'hari_ini') return 'Hari Ini (' + formatDate(new Date().toISOString()) + ')';
    if (dateFilter === 'minggu_ini') return '7 Hari Terakhir';
    if (dateFilter === 'pilih_bulan') return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    if (dateFilter === 'pilih_tahun') return `Tahun ${selectedYear}`;
    if (dateFilter === 'custom_range') {
      const s = customStartDate ? formatDate(customStartDate) : 'Awal';
      const e = customEndDate ? formatDate(customEndDate) : 'Sekarang';
      return `${s} s/d ${e}`;
    }
    return 'Semua Waktu';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Filter & Subtabs Navigation */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Sub-tabs */}
          <div className="flex gap-1.5 p-1.5 bg-white border border-gray-200/80 rounded-full shadow-xs overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'ringkasan', label: 'Ringkasan & Kas Laci', icon: BarChart3 },
              { id: 'penjualan', label: 'Riwayat Transaksi', icon: Receipt },
              { id: 'pengeluaran', label: 'Biaya Toko', icon: TrendingDown },
              { id: 'dompet', label: 'Pos Anggaran', icon: Wallet },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2E7D32] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Date Filter selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Calendar className="w-4 h-4 text-[#1B5E20] shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => {
                const val = e.target.value as DateFilterType;
                setDateFilter(val);
                if (val === 'custom_range') {
                  setIsCalendarModalOpen(true);
                }
              }}
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs sm:text-sm font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
            >
              <option value="hari_ini">Hari Ini</option>
              <option value="minggu_ini">7 Hari Terakhir</option>
              <option value="pilih_bulan">Pilih Bulan</option>
              <option value="pilih_tahun">Pilih Tahun</option>
              <option value="custom_range">Pilih Tanggal / Custom Range (Kalender)</option>
              <option value="semua">Semua Waktu</option>
            </select>
          </div>
        </div>

        {/* Dynamic Contextual Date Range Selector Bar (When Pilih Bulan, Pilih Tahun, or Custom Range is active) */}
        {(dateFilter === 'pilih_bulan' || dateFilter === 'pilih_tahun' || dateFilter === 'custom_range') && (
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            {/* Opsi 1: Pilih Bulan */}
            {dateFilter === 'pilih_bulan' && (
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1B5E20]" />
                  Pilih Bulan & Tahun:
                </span>
                {/* Month Dropdown */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 font-bold text-emerald-950 shadow-2xs focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                {/* Year Dropdown */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 font-bold text-emerald-950 shadow-2xs focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Opsi 2: Pilih Tahun */}
            {dateFilter === 'pilih_tahun' && (
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1B5E20]" />
                  Pilih Tahun Pembukuan:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-emerald-300 font-bold text-emerald-950 shadow-2xs focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Opsi 3: Custom Range Datepicker */}
            {dateFilter === 'custom_range' && (
              <div className="flex flex-wrap items-center gap-2.5 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-[#1B5E20]" />
                    Rentang Tanggal:
                  </span>
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[11px] text-gray-400 font-medium">Dari:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-transparent font-semibold text-gray-800 outline-none text-xs cursor-pointer"
                    />
                  </div>
                  <span className="text-gray-400 font-bold">s/d</span>
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[11px] text-gray-400 font-medium">Sampai:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-transparent font-semibold text-gray-800 outline-none text-xs cursor-pointer"
                    />
                  </div>

                  {/* Open Visual Calendar Modal Button */}
                  <button
                    type="button"
                    onClick={() => setIsCalendarModalOpen(true)}
                    className="px-3 py-1 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                    title="Buka Kalender Visual Rentang Tanggal"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Buka Kalender</span>
                  </button>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <span className="text-[11px] text-emerald-800 font-medium">Preset:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setCustomStartDate(today);
                      setCustomEndDate(today);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d = new Date();
                      d.setDate(d.getDate() - 6);
                      setCustomStartDate(d.toISOString().split('T')[0]);
                      setCustomEndDate(now.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                      const today = now.toISOString().split('T')[0];
                      setCustomStartDate(firstDay);
                      setCustomEndDate(today);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d = new Date();
                      d.setDate(d.getDate() - 29);
                      setCustomStartDate(d.toISOString().split('T')[0]);
                      setCustomEndDate(now.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    30 Hari
                  </button>
                </div>
              </div>
            )}

            {/* Active Range Summary Badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 ml-auto">
              <Clock className="w-3 h-3 text-[#1B5E20]" />
              <span>{getPeriodLabel()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-emerald-950 text-white rounded-2xl shadow-xs">
        <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider px-2 hidden md:inline">
          Aksi Cepat:
        </span>
        <button
          onClick={() => {
            setExpenseTitle('');
            setExpenseAmount('');
            setExpenseCategory('OPERASIONAL');
            setExpenseSource('LACI');
            setIsExpenseModalOpen(true);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Catat Pengeluaran</span>
        </button>

        <button
          onClick={() => setIsBEPModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer"
        >
          <Target className="w-3.5 h-3.5 text-emerald-300" />
          <span>Analisis BEP</span>
        </button>

        <button
          onClick={() => setIsOpnameModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-300" />
          <span>Opname Kas Laci</span>
        </button>

        <button
          onClick={handleManualSyncOnline}
          disabled={isSyncingOnline}
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer disabled:opacity-50"
          title="Sinkronkan pesanan online berstatus Selesai ke Laporan Omzet Penjualan"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isSyncingOnline ? 'animate-spin' : ''}`} />
          <span>{isSyncingOnline ? 'Menyinkronkan...' : 'Sinkron Pesanan Online'}</span>
        </button>

        <button
          onClick={() => setIsCetakModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer ml-auto"
        >
          <Printer className="w-3.5 h-3.5 text-amber-300" />
          <span>Cetak PDF Laporan</span>
        </button>
      </div>

      {/* Sync Notification Banner if active */}
      {syncStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
          <button
            onClick={() => setSyncStatusMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Tab: Ringkasan & Kas Laci */}
      {activeSubTab === 'ringkasan' && (
        <div className="space-y-6">
          {/* 4 Standard Financial Highlight Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Omzet / Revenue - Clickable to Riwayat Transaksi */}
            <div 
              id="card-total-penjualan-summary"
              onClick={() => setActiveSubTab('penjualan')}
              className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group flex flex-col justify-between"
              title="Klik untuk melihat riwayat"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-emerald-700 transition-colors">
                    Total Penjualan
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-[#1B5E20] transition-colors">
                  {formatRupiah(totalRevenue)}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-1 border-t border-gray-50">
                <span>{filteredSales.length} transaksi kasir</span>
                <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                  Klik untuk melihat riwayat <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Estimasi Laba Kotor */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">Estimasi Laba Kotor</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-bold text-blue-900">{formatRupiah(totalGrossProfit)}</p>
              </div>
              <div className="text-[11px] text-gray-500 mt-2 pt-1 border-t border-gray-50">
                <span>Margin Toko: ~{averageMarginPct.toFixed(1)}%</span>
              </div>
            </div>

            {/* Total Pengeluaran - Clickable to Biaya Toko */}
            <div 
              id="card-total-pengeluaran-summary"
              onClick={() => setActiveSubTab('pengeluaran')}
              className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs cursor-pointer hover:border-rose-400 hover:shadow-md transition-all group flex flex-col justify-between"
              title="Klik untuk rincian pengeluaran"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-rose-700 transition-colors">
                    Total Pengeluaran Kas
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-100 group-hover:scale-105 transition-all">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-bold text-rose-900 group-hover:text-rose-950 transition-colors">
                  {formatRupiah(totalExpenseAmount)}
                </p>
              </div>
              <div className="text-[10px] text-gray-500 mt-2 space-y-0.5 pt-1.5 border-t border-gray-100">
                <div className="flex justify-between">
                  <span className="text-rose-600 font-medium">• Biaya Operasional:</span>
                  <span className="font-semibold text-rose-700">{formatRupiah(totalOperationalExpenses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700 font-medium">• Belanja Stok (Aset):</span>
                  <span className="font-semibold text-amber-800">{formatRupiah(totalStockExpenses)}</span>
                </div>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    Klik untuk rincian pengeluaran <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>

            {/* Estimasi Laba Bersih Harian */}
            <div className="bg-emerald-800 text-white rounded-2xl p-4 shadow-sm shadow-emerald-900/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-emerald-200">Estimasi Laba Bersih</span>
                  <div className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">{formatRupiah(dailyDrawerNetProfit)}</p>
              </div>
              <div className="text-[10px] text-emerald-200 mt-2 pt-1.5 border-t border-emerald-700/60">
                <span>Rumus: Laba Kotor - Biaya Operasional ({formatRupiah(drawerOperationalExpenses)})</span>
                <p className="text-[9.5px] text-emerald-300/80 mt-0.5">
                  *Belanja stok tidak memotong laba bersih (dihitung saat terjual).
                </p>
              </div>
            </div>
          </div>

          {/* Module 1: Ringkasan Kas & Arus Kas Laci */}
          <ArusKasLaciCard
            initialCash={initialCash}
            cashSales={cashSales}
            qrisSales={effectiveQrisBalance}
            debtPaymentsCash={debtPaymentsCash}
            debtPaymentsQris={debtPaymentsQris}
            operationalExpenses={drawerOperationalExpenses}
            stockExpenses={drawerStockExpenses}
            totalActualDrawerCash={totalActualDrawerCash}
            totalKasToko={totalKasToko}
            onOpenOpnameModal={() => setIsOpnameModalOpen(true)}
            isManualQris={manualQrisBalance !== null}
            onUpdateQrisBalance={handleUpdateQrisBalance}
          />

          {/* Module 2: Alokasi Kewajiban & Reservasi Dana (Sinking Fund) */}
          <SinkingFundCard
            totalActualDrawerCash={totalActualDrawerCash}
            netCashFlow={netCashFlow}
            dailyRentTarget={DAILY_RENT_TARGET}
            dailyBankTarget={DAILY_BANK_TARGET}
          />

          {/* Module 3: Estimasi Reservasi Dana Akumulasi */}
          <CadanganAkumulasiCard
            currentCash={totalActualDrawerCash}
          />

          {/* Module 4: Grafik Tren Omzet vs Laba Bersih & Target BEP */}
          <TrenChartCard
            sales={sales}
            expenses={expenses}
            onOpenBEPModal={() => setIsBEPModalOpen(true)}
            onRefresh={onRefresh}
          />

          {/* Payment Method Distribution & Wallet Glance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Metrik Metode Pembayaran */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#2E7D32]" />
                <span>Distribusi Metode Pembayaran</span>
              </h3>

              <div className="space-y-3">
                {Object.keys(paymentMethodStats).length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Belum ada transaksi di periode ini.</p>
                ) : (
                  (Object.entries(paymentMethodStats) as [string, { count: number; total: number }][]).map(([method, data]) => {
                    const pct = totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0;
                    return (
                      <div key={method} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="font-bold text-gray-800">{method} ({data.count}x)</span>
                          <span className="font-mono text-gray-900">
                            {formatRupiah(data.total)} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#2E7D32] h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Dompet Toko Snapshot */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#2E7D32]" />
                    <span>Saldo & Anggaran Toko Berkah</span>
                  </h3>
                  <button
                    onClick={() => {
                      if (wallet) setWalletForm(wallet);
                      setIsWalletModalOpen(true);
                    }}
                    className="text-xs text-[#2E7D32] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Kelola Pos</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-emerald-700 block font-medium">Kas Laci Kasir:</span>
                    <span className="font-bold text-base text-emerald-950 font-mono">
                      {formatRupiah(initialCash)}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-blue-700 block font-medium">Pos Kulakan / Stok:</span>
                    <span className="font-bold text-base text-blue-950 font-mono">
                      {formatRupiah(wallet?.shopping_budget || 0)}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-amber-700 block font-medium">Pos Operasional:</span>
                    <span className="font-bold text-base text-amber-950 font-mono">
                      {formatRupiah(wallet?.operational_budget || 0)}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <span className="text-purple-700 block font-medium">Pos Hak Pemilik:</span>
                    <span className="font-bold text-base text-purple-950 font-mono">
                      {formatRupiah(wallet?.owner_budget || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
                Pemisahan anggaran memastikan kas belanja stok dan kewajiban sewa/bank selalu terjaga aman.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab: Riwayat Transaksi Penjualan */}
      {activeSubTab === 'penjualan' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#1B5E20]" />
              <h3 className="font-bold text-gray-900 text-sm">
                Daftar Penjualan Kasir ({filteredSales.length} Transaksi)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100/90 text-[#1B5E20] border border-emerald-200 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Periode: {getPeriodLabel()}
              </span>
              <span className="text-xs text-gray-600 font-medium">
                Total Omzet: <strong className="text-[#1B5E20] font-mono text-sm font-bold">{formatRupiah(totalRevenue)}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/70 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-3 py-3 text-center w-14">Nomor</th>
                  <th className="px-4 py-3">ID Nota</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Rincian Item</th>
                  <th className="px-4 py-3 text-right">Total Belanja</th>
                  <th className="px-4 py-3">Pelanggan/Catatan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400 text-xs">
                      Belum ada riwayat penjualan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale, index) => {
                    const allProducts = (products && products.length > 0) 
                      ? products 
                      : (typeof getLocalProducts === 'function' ? getLocalProducts() : []);
                    const items: SaleItem[] = (() => {
                      let candidateItems: SaleItem[] = [];
                      if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
                        candidateItems = sale.items;
                      } else if (sale.sale_items && Array.isArray(sale.sale_items) && sale.sale_items.length > 0) {
                        candidateItems = sale.sale_items;
                      }

                      const isDummyName = (it: SaleItem) => {
                        if (!it || !it.product || !it.product.name) return true;
                        const nm = it.product.name.trim().toLowerCase();
                        return nm === 'barang sembako' || nm.includes('belanjaan sembako') || nm.includes('belanjaan toko') || nm.includes('belanjaan pesanan online');
                      };

                      const hasGeneric = candidateItems.length > 0 && candidateItems.every(isDummyName);
                      if (candidateItems.length > 0 && !hasGeneric) {
                        return candidateItems;
                      }

                      // 1. Cek di local sales cache berdasarkan ID / Timestamp + Total Amount
                      const localSalesList = getLocalSales();
                      const matchedLocal = localSalesList.find((ls) => {
                        if (!ls || (!ls.items?.length && !ls.sale_items?.length)) return false;
                        if (ls.id === sale.id || (ls.id && sale.id && (ls.id.startsWith(sale.id.slice(0, 8)) || sale.id.startsWith(ls.id.slice(0, 8))))) return true;
                        const tL = ls.created_at ? new Date(ls.created_at).getTime() : 0;
                        const tS = sale.created_at ? new Date(sale.created_at).getTime() : 0;
                        return Math.abs(tL - tS) < 180000 && Number(ls.total_amount) === Number(sale.total_amount);
                      });
                      if (matchedLocal?.items && matchedLocal.items.length > 0 && !matchedLocal.items.every(isDummyName)) {
                        return matchedLocal.items;
                      }
                      if (matchedLocal?.sale_items && matchedLocal.sale_items.length > 0 && !matchedLocal.sale_items.every(isDummyName)) {
                        return matchedLocal.sale_items;
                      }

                      // 2. Cek dari catatan pesanan online (#ORD-xxx)
                      const orderMatch = (sale.notes || '').match(/#ORD-(\d+)/i) || (sale.notes || '').match(/ORD-(\d+)/i) || sale.id.match(/sale_online_(\d+)/i);
                      if (orderMatch && orderMatch[1]) {
                        const ordId = Number(orderMatch[1]);
                        const localOrders = getLocalOrders();
                        const matchedOrder = localOrders.find((o) => o.id === ordId);
                        if (matchedOrder && matchedOrder.items_json) {
                          let raw: any[] = [];
                          if (Array.isArray(matchedOrder.items_json)) raw = matchedOrder.items_json;
                          else if (typeof matchedOrder.items_json === 'string') {
                            try { raw = JSON.parse(matchedOrder.items_json); } catch {}
                          }
                          if (raw.length > 0) {
                            return raw.map((it: any, idx: number) => ({
                              id: `order_item_${ordId}_${idx}`,
                              sale_id: sale.id,
                              product_id: it.product_id || it.id || String(idx),
                              qty_kg: Number(it.quantity || it.qty || it.qty_kg || 1),
                              qty: Number(it.quantity || it.qty || it.qty_kg || 1),
                              subtotal: Number(it.subtotal || (Number(it.price || it.selling_price || 0) * Number(it.quantity || it.qty || 1))),
                              cost_price: Number(it.cost_price || 0),
                              original_qty: Number(it.quantity || it.qty || it.qty_kg || 1),
                              unit: it.unit || 'pcs',
                              product: it.product || allProducts.find(p => p.id === it.product_id) || {
                                id: it.product_id || it.id,
                                name: it.product_name || it.name || 'Barang Sembako',
                                unit: it.unit || 'pcs',
                                selling_price: it.price || it.selling_price || 0,
                                cost_price: 0,
                                stock_kg: 0,
                                min_stock: 0,
                                is_active: true,
                                category: 'Sembako',
                                image_url: null,
                                barcode: null,
                              },
                            }));
                          }
                        }
                      }

                      // 3. Robust parser dari catatan transaksi (notes) & master produk
                      const parsedFromNotes = parseNotesToItems(sale.notes, Number(sale.total_amount), allProducts);
                      if (parsedFromNotes.length > 0) {
                        return parsedFromNotes;
                      }

                      return candidateItems;
                    })();

                    const effectiveSale = { ...sale, items, sale_items: items };
                    const isExpanded = expandedSaleIds.has(sale.id);
                    const totalQty = items.reduce((acc, it) => acc + (Number(it.qty_kg || it.qty) || 1), 0);

                    // Formatted summary text e.g. "Beras Heler Pulen (1 kg) x1, Bawang Merah (250 gr) x1"
                    const summaryText = items.length > 0 
                      ? items.map(it => {
                          const name = it.product?.name || 'Barang Sembako';
                          const qty = it.qty_kg || it.qty || 1;
                          const unit = it.unit || it.product?.unit || 'kg';
                          return `${name} (${qty} ${unit})`;
                        }).join(', ')
                      : '1 Transaksi Penjualan';

                    // Online Order recognition
                    const onlineOrderMatch = (sale.notes || '').match(/#ORD-(\d+)/i) || (sale.notes || '').match(/ORD-(\d+)/i);
                    const isOnlineOrder = sale.id.startsWith('sale_online_') || Boolean(onlineOrderMatch) || (sale.notes || '').toLowerCase().includes('pesanan online');
                    const displayOrderCode = onlineOrderMatch ? `#ORD-${onlineOrderMatch[1]}` : (isOnlineOrder ? `#ORD-${sale.id.replace('sale_online_', '').slice(0, 5)}` : `#${sale.id.slice(0, 8).toUpperCase()}`);

                    return (
                      <React.Fragment key={sale.id}>
                        <tr 
                          onClick={() => setSelectedSaleForDetail(effectiveSale)}
                          className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          {/* Chevron Expand Toggle */}
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => toggleExpandSale(sale.id, e)}
                              className="p-1 rounded-md text-gray-400 hover:text-[#1B5E20] hover:bg-emerald-100/50 transition-colors"
                              title={isExpanded ? 'Tutup Rincian' : 'Buka Rincian'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-[#1B5E20]" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Nomor Urut */}
                          <td className="px-3 py-3 text-center font-mono font-semibold text-xs text-gray-500 whitespace-nowrap">
                            {index + 1}
                          </td>

                          {/* ID Nota */}
                          <td className="px-4 py-3 font-mono font-bold text-xs">
                            {isOnlineOrder ? (
                              <span 
                                className="inline-flex items-center gap-1 bg-emerald-100/80 text-[#1B5E20] border border-emerald-300/80 px-2 py-0.5 rounded-md font-bold text-[11px] shadow-2xs hover:bg-emerald-200/80 transition-colors"
                                title="Pesanan Online (Sudah Dibukukan)"
                              >
                                🛵 {displayOrderCode}
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1 text-gray-900 hover:text-[#1B5E20] underline decoration-dotted underline-offset-4"
                                title="Klik untuk lihat struk belanja lengkap"
                              >
                                {displayOrderCode}
                              </span>
                            )}
                          </td>

                          {/* Waktu */}
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {formatDateTime(sale.created_at)}
                          </td>

                          {/* Metode */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {sale.payment_method === 'UTANG' ? (
                              (() => {
                                const debtInfo = getSaleDebtInfo(sale, debts);
                                if (debtInfo.isLunas) {
                                  return (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-emerald-50 text-[#1B5E20] border-emerald-300 flex items-center gap-1 w-fit">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Utang (Lunas)</span>
                                    </span>
                                  );
                                }
                                if (debtInfo.isPartial) {
                                  return (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-300 flex items-center gap-1 w-fit">
                                      <Clock className="w-3 h-3 text-blue-500" />
                                      <span>Utang (Dicicil)</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    <span>Utang (Belum Lunas)</span>
                                  </span>
                                );
                              })()
                            ) : (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                                sale.payment_method === 'CASH' || sale.payment_method === 'TUNAI'
                                  ? 'bg-emerald-50 text-[#1B5E20] border-emerald-200'
                                  : sale.payment_method === 'QRIS'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}>
                                {sale.payment_method}
                              </span>
                            )}
                          </td>

                          {/* RINCIAN ITEM (Summary List & Badges) */}
                          <td className="px-4 py-3 max-w-xs md:max-w-sm">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {items.length > 0 ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100/60 text-[#1B5E20] px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                    <Package className="w-3 h-3" />
                                    {items.length} Item ({totalQty})
                                  </span>
                                  <span 
                                    className="text-xs text-gray-700 truncate block max-w-[200px] sm:max-w-[260px]"
                                    title={summaryText}
                                  >
                                    {summaryText}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  Transaksi Penjualan Kasir
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Total Belanja */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                            {formatRupiah(sale.total_amount)}
                          </td>

                          {/* Keterangan / Pelanggan */}
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">
                            {sale.notes || sale.customer_name || '-'}
                          </td>

                          {/* Action Buttons */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedSaleForDetail(effectiveSale)}
                                title="Lihat Rincian Struk"
                                className="px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Eye className="w-3 h-3 text-gray-500" />
                                <span className="hidden sm:inline">Rincian</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSaleForReceipt(effectiveSale)}
                                title="Cetak Ulang Struk Kasir"
                                className="px-2.5 py-1 text-xs rounded-lg bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-medium inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Printer className="w-3 h-3" />
                                <span className="hidden sm:inline">Cetak</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Accordion Row for itemized breakdown */}
                        {isExpanded && (
                          <tr className="bg-emerald-50/20 border-b border-emerald-100">
                            <td colSpan={9} className="p-3 sm:px-6">
                              <div className="bg-white rounded-xl p-3.5 border border-emerald-200/80 shadow-2xs space-y-2.5">
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-[#1B5E20]" />
                                      Rincian Pembelian ({items.length} Macam Barang • Total Qty: {totalQty})
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSaleForDetail(effectiveSale)}
                                    className="text-xs text-[#2E7D32] hover:text-[#1B5E20] font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Buka Modal Struk</span>
                                  </button>
                                </div>

                                {items.length === 0 ? (
                                  <div className="py-2 text-xs flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                                    <span className="font-semibold text-gray-700">Ringkasan Transaksi Kasir</span>
                                    <span className="font-mono font-bold text-gray-900">{formatRupiah(sale.total_amount)}</span>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="space-y-2 divide-y divide-gray-100">
                                      {items.map((it, idx) => {
                                        const pName = it.product?.name || 'Barang Sembako';
                                        const u = it.unit || it.product?.unit || 'pcs';
                                        const unitPrice = it.product?.selling_price || (it.qty_kg > 0 ? it.subtotal / it.qty_kg : it.subtotal);
                                        const qtyDisplay = (it as any).qty_display || `${it.qty_kg || it.qty || 1} ${u}`;

                                        return (
                                          <div 
                                            key={idx} 
                                            className="pt-2 first:pt-0 flex items-center justify-between text-xs hover:bg-emerald-50/30 p-1.5 rounded-lg transition-colors"
                                          >
                                            <div className="min-w-0 pr-2">
                                              <p className="font-bold text-gray-900 text-xs sm:text-sm">{pName}</p>
                                              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                                                {qtyDisplay} x {formatRupiah(unitPrice)}
                                              </p>
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-2.5">
                                              <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">
                                                {formatRupiah(it.subtotal)}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedSaleForDetail(effectiveSale);
                                                }}
                                                title="Hapus / kelola rincian item"
                                                className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Bottom Footer Actions inside accordion */}
                                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSaleForDetail(effectiveSale);
                                          }}
                                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                          title="Kelola Transaksi"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const storeName = storeProfile?.store_name || 'TOKO BERKAH';
                                            const timeStr = formatDateTime(sale.created_at);
                                            const itemsText = items.map((it) => {
                                              const pName = it.product?.name || 'Barang';
                                              const u = it.unit || it.product?.unit || 'pcs';
                                              const q = it.qty_kg || it.qty || 1;
                                              const unitPrice = it.product?.selling_price || (it.qty_kg > 0 ? it.subtotal / it.qty_kg : it.subtotal);
                                              return `• ${pName} (${q} ${u}) = ${formatRupiah(it.subtotal)}`;
                                            }).join('\n');

                                            const text = `*${storeName}*\n_Struk Transaksi_\n\n📅 Waktu: ${timeStr}\n💳 Metode: ${sale.payment_method}\n\n*Rincian Belanja:*\n${itemsText}\n\n*Total Bayar: ${formatRupiah(sale.total_amount)}*\n\nTerima kasih atas kunjungan Anda! 🙏`;

                                            const phone = sale.customer_phone ? sale.customer_phone.replace(/\D/g, '') : '';
                                            const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
                                            const url = cleanPhone 
                                              ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
                                              : `https://wa.me/?text=${encodeURIComponent(text)}`;
                                            
                                            window.open(url, '_blank');
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#1B5E20] hover:bg-emerald-100 font-bold text-xs border border-emerald-200 transition-colors cursor-pointer"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>Kirim Nota WA</span>
                                        </button>
                                      </div>

                                      <div className="text-right">
                                        <span className="text-[11px] text-gray-500 font-medium block">Total Bayar</span>
                                        <span className="text-sm sm:text-base font-extrabold font-mono text-[#2E7D32]">
                                          {formatRupiah(sale.total_amount)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Catatan Pengeluaran (Expenses) */}
      {activeSubTab === 'pengeluaran' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Biaya & Pengeluaran Toko</h3>
              <p className="text-xs text-gray-500">Catatan operasional, belanja stok laci, listrik, bensin, plastik, dan kas besar.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {duplicateExpensesMap.size > 0 && (
                <button
                  type="button"
                  onClick={handleCleanupDuplicates}
                  disabled={isCleaningDuplicates}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  title="Klik untuk menghapus transaksi duplikat dan menyisakan 1 transaksi asli"
                >
                  <AlertTriangle className="w-4 h-4 text-white animate-bounce" />
                  <span>{isCleaningDuplicates ? 'Membersihkan...' : `Bersihkan ${duplicateExpensesMap.size} Transaksi Duplikat`}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCetakBiayaModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-800 text-xs sm:text-sm font-semibold flex items-center gap-1.5 border border-gray-300 shadow-2xs cursor-pointer transition-colors"
                title="Cetak PDF Laporan Biaya & Pengeluaran"
              >
                <Printer className="w-4 h-4 text-emerald-700" />
                <span>Cetak PDF Laporan Biaya</span>
              </button>
              <button
                onClick={() => {
                  setExpenseTitle('');
                  setExpenseAmount('');
                  setExpenseCategory('OPERASIONAL');
                  setExpenseSource('LACI');
                  setIsExpenseModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Pengeluaran Baru</span>
              </button>
            </div>
          </div>

          {duplicateExpensesMap.size > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-medium">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Terdeteksi <strong>{duplicateExpensesMap.size} transaksi pengeluaran duplikat</strong> (produk, nominal, dan tanggal transaksi sama). Klik tombol di atas untuk menghapus duplikat secara otomatis.
                </span>
              </div>
              <button
                type="button"
                onClick={handleCleanupDuplicates}
                disabled={isCleaningDuplicates}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer transition-colors"
              >
                Hapus Duplikat Now
              </button>
            </div>
          )}

          {/* Filter Source Tabs & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-semibold text-rose-800 block">Biaya Operasional (Beban):</span>
              <span className="text-lg font-bold font-mono text-rose-950 block mt-0.5">
                {formatRupiah(totalOperationalExpenses)}
              </span>
              <span className="text-[10px] text-rose-700">Memotong Estimasi Laba Bersih</span>
            </div>

            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 shadow-xs">
              <span className="text-[11px] font-semibold text-amber-800 block">Belanja Stok (Aset/Kulakan):</span>
              <span className="text-lg font-bold font-mono text-amber-950 block mt-0.5">
                {formatRupiah(totalStockExpenses)}
              </span>
              <span className="text-[10px] text-amber-700">Aset Toko (Tidak potong laba bersih)</span>
            </div>

            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-800 block">Keluar Dari Laci Kasir:</span>
              <span className="text-lg font-bold font-mono text-[#1B5E20] block mt-0.5">
                {formatRupiah(drawerOperationalExpenses + drawerStockExpenses)}
              </span>
              <span className="text-[10px] text-emerald-700">Mengurangi uang fisik kasir</span>
            </div>

            <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-[11px] font-semibold text-blue-800 block">Dari Kas Besar / Cadangan:</span>
              <span className="text-lg font-bold font-mono text-blue-900 block mt-0.5">
                {formatRupiah(kasBesarExpenses)}
              </span>
              <span className="text-[10px] text-blue-700">Tidak memotong kas fisik laci</span>
            </div>
          </div>

          {/* Source Filter Buttons */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">Filter Sumber Dana:</span>
            {[
              { id: 'semua', label: 'Semua Sumber' },
              { id: 'LACI', label: 'Laci Kasir' },
              { id: 'KAS_BESAR', label: 'Kas Besar / Cadangan' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setExpenseSourceFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  expenseSourceFilter === f.id
                    ? 'bg-[#2E7D32] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-gray-100">
              {displayedExpenses.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Belum ada catatan pengeluaran pada filter ini.
                </div>
              ) : (
                displayedExpenses.map((exp) => {
                  const isKasBesar = (exp.source || '').toUpperCase() === 'KAS_BESAR';
                  const isStock = isStockExpense(exp);
                  const isDuplicate = duplicateExpensesMap.has(exp.id);

                  return (
                    <div
                      key={exp.id}
                      className={`p-4 flex items-center justify-between transition-colors ${
                        isDuplicate ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-amber-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 uppercase ${
                            isStock
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {isStock ? <ShoppingBag className="w-3 h-3 text-amber-700" /> : <Receipt className="w-3 h-3 text-rose-600" />}
                            <span>{isStock ? 'Belanja Stok (Aset)' : 'Biaya Operasional'}</span>
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                            isKasBesar
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-[#1B5E20] border border-emerald-200'
                          }`}>
                            {isKasBesar ? <Landmark className="w-2.5 h-2.5" /> : <Wallet className="w-2.5 h-2.5" />}
                            <span>{isKasBesar ? 'Kas Besar' : 'Laci Kasir'}</span>
                          </span>

                          {isDuplicate && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-800" />
                              <span>Duplikat</span>
                            </span>
                          )}

                          <span className={`text-[9.5px] font-medium ${isStock ? 'text-amber-800' : 'text-rose-600'}`}>
                            {isStock ? '• Tidak potong Laba Bersih' : '• Beban (Memotong Laba Bersih)'}
                          </span>
                        </div>

                        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span>{exp.title}</span>
                          {isDuplicate && <span className="text-xs text-amber-800 font-normal">(Transaksi Duplikat)</span>}
                        </h4>
                        <p className="text-xs text-gray-400">{formatDateTime(exp.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-rose-600 text-sm sm:text-base">
                          -{formatRupiah(exp.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isDuplicate
                              ? 'text-rose-700 bg-rose-100 hover:bg-rose-200 font-bold border border-rose-300'
                              : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={isDuplicate ? 'Hapus transaksi duplikat ini' : 'Hapus catatan pengeluaran'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab: Pos Anggaran Toko Details */}
      {activeSubTab === 'dompet' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Manajemen Pos Kas Toko (Store Wallets)</h3>
              <p className="text-xs text-gray-500">
                Alokasi dana untuk menjaga kestabilan modal belanja barang, kewajiban sinking fund, dan operasional Toko Berkah.
              </p>
            </div>
            <button
              onClick={() => {
                if (wallet) setWalletForm(wallet);
                setIsWalletModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              Ubah Alokasi Anggaran
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-sm font-semibold">Uang Kas Tunai (Laci Kasir)</span>
                <Wallet className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-emerald-950 font-mono">
                {formatRupiah(wallet?.initial_cash || 500000)}
              </p>
              <p className="text-xs text-emerald-700">Modal awal fisik yang ada di laci kasir untuk kembalian.</p>
            </div>

            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="flex items-center justify-between text-blue-800">
                <span className="text-sm font-semibold">Anggaran Belanja / Kulakan</span>
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-blue-950 font-mono">
                {formatRupiah(wallet?.shopping_budget || 0)}
              </p>
              <p className="text-xs text-blue-700">Dana khusus untuk membeli kembali sembako & stok dari supplier.</p>
            </div>

            <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-2">
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-sm font-semibold">Anggaran Operasional</span>
                <TrendingDown className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-amber-950 font-mono">
                {formatRupiah(wallet?.operational_budget || 0)}
              </p>
              <p className="text-xs text-amber-700">Dana cadangan untuk listrik, kantong kresek, dan biaya harian.</p>
            </div>

            <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/50 space-y-2">
              <div className="flex items-center justify-between text-purple-800">
                <span className="text-sm font-semibold">Alokasi / Prive Pemilik</span>
                <DollarSign className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-purple-950 font-mono">
                {formatRupiah(wallet?.owner_budget || 0)}
              </p>
              <p className="text-xs text-purple-700">Keuntungan bersih yang siap ditarik oleh pemilik toko.</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal with Distinct Belanja Stok vs Biaya Operasional Selection */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Catat Pengeluaran Toko</h3>
                <p className="text-xs text-gray-500">Pemisahan akurat antara Belanja Stok (Aset) vs Biaya Operasional (Beban)</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs sm:text-sm">
              {/* 1. Kategori / Jenis Pengeluaran Selection */}
              <div className="space-y-2">
                <label className="block text-gray-800 font-bold text-xs uppercase tracking-wider">
                  1. Kategori Pengeluaran <span className="text-rose-500">*</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option A: Belanja Stok / Kulakan Laci */}
                  <div
                    onClick={() => {
                      setExpenseType('STOK');
                      setExpenseCategory('BELANJA_STOK');
                    }}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      expenseType === 'STOK'
                        ? 'border-amber-600 bg-amber-50/70 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                        <ShoppingBag className={`w-4 h-4 ${expenseType === 'STOK' ? 'text-amber-700' : 'text-gray-400'}`} />
                        <span>Belanja Stok / Kulakan Laci</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        expenseType === 'STOK' ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-300'
                      }`}>
                        {expenseType === 'STOK' && <Check className="w-3 h-3 stroke-3" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-snug">
                      Untuk pembelian/restok barang dagangan toko (misal: <strong>penambahan beras 25 kg</strong>, minyak, telur, sembako).
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-900">
                      Masuk Kolom 4 (Aset Stok)
                    </span>
                  </div>

                  {/* Option B: Biaya Operasional */}
                  <div
                    onClick={() => {
                      setExpenseType('OPERASIONAL');
                      if (expenseCategory === 'BELANJA_STOK') setExpenseCategory('OPERASIONAL');
                    }}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      expenseType === 'OPERASIONAL'
                        ? 'border-rose-600 bg-rose-50/70 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 font-bold text-xs text-rose-950">
                        <Receipt className={`w-4 h-4 ${expenseType === 'OPERASIONAL' ? 'text-rose-600' : 'text-gray-400'}`} />
                        <span>Biaya Operasional</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        expenseType === 'OPERASIONAL' ? 'border-rose-600 bg-rose-600 text-white' : 'border-gray-300'
                      }`}>
                        {expenseType === 'OPERASIONAL' && <Check className="w-3 h-3 stroke-3" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-rose-900 leading-snug">
                      Untuk biaya non-stok harian (listrik, bensin kulakan, plastik kemasan, gaji, konsumsi, dll.).
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200/70 text-rose-900">
                      Masuk Kolom 3 (Beban Operasional)
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-Kategori Operasional (hanya jika Biaya Operasional dipilih) */}
              {expenseType === 'OPERASIONAL' && (
                <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-1.5 animate-in fade-in">
                  <label className="block text-rose-900 font-bold text-xs">
                    Rincian Sub-Kategori Operasional:
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white focus:border-rose-600 outline-none text-xs"
                  >
                    <option value="OPERASIONAL">OPERASIONAL UMUM TOKO</option>
                    <option value="LISTRIK_AIR">LISTRIK, AIR & WIFI</option>
                    <option value="PACKAGING">KEMASAN / PLASTIK KRESEK</option>
                    <option value="TRANSPORT">TRANSPORTASI / BENSIN KULAKAN</option>
                    <option value="GAJI">GAJI / UPAH KARYAWAN</option>
                    <option value="MAKAN">KONSUMSI / MAKAN KARYAWAN</option>
                    <option value="LAIN_LAIN">BIAYA LAIN-LAIN</option>
                  </select>
                </div>
              )}

              {/* Quick Chip Suggestions for Belanja Stok */}
              {expenseType === 'STOK' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-amber-800 font-semibold">Contoh Cepat:</span>
                  {[
                    'Beras Gunung Cupu 25 kg',
                    'Beras Heler Pulen 50 kg',
                    'Minyak Goreng Curah',
                    'Telur Ayam Ras 15 kg',
                    'Gula Pasir 50 kg',
                    'Sembako Toko',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExpenseTitle(preset)}
                      className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              )}

              {/* 2. Sumber Dana Pengeluaran */}
              <div className="space-y-1.5">
                <label className="block text-gray-800 font-bold text-xs uppercase tracking-wider">
                  2. Sumber Dana Pengeluaran <span className="text-rose-500">*</span>
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setExpenseSource('LACI')}
                    className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      expenseSource === 'LACI'
                        ? 'border-[#2E7D32] bg-emerald-50/70'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-[#2E7D32]" />
                        Laci Kasir Harian
                      </span>
                      {expenseSource === 'LACI' && <Check className="w-3 h-3 text-[#2E7D32] stroke-3" />}
                    </div>
                    <span className="text-[10px] text-gray-500 block mt-0.5">Memotong uang fisik di laci</span>
                  </div>

                  <div
                    onClick={() => setExpenseSource('KAS_BESAR')}
                    className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      expenseSource === 'KAS_BESAR'
                        ? 'border-blue-600 bg-blue-50/70'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900 flex items-center gap-1">
                        <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        Kas Besar / Cadangan
                      </span>
                      {expenseSource === 'KAS_BESAR' && <Check className="w-3 h-3 text-blue-600 stroke-3" />}
                    </div>
                    <span className="text-[10px] text-gray-500 block mt-0.5">Tidak memotong kas fisik laci</span>
                  </div>
                </div>
              </div>

              {/* 3. Judul / Keperluan */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  3. Judul / Keperluan Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    expenseType === 'STOK'
                      ? 'Contoh: Beras Gunung Cupu 25 kg / Kulakan Minyak Goreng'
                      : 'Contoh: Token Listrik / Beli Plastik Kresek / Bensin'
                  }
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm"
                />
              </div>

              {/* 4. Nominal Biaya */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  4. Nominal Biaya (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Contoh: 355000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 font-mono font-bold text-rose-600 focus:border-[#2E7D32] outline-none text-base"
                />
              </div>

              {/* Real-Time Impact & Accounting Formula Alert */}
              <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${
                expenseType === 'STOK'
                  ? 'bg-amber-50 border border-amber-200 text-amber-950'
                  : 'bg-rose-50 border border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Dampak Alokasi Pembukuan & Kas:</span>
                </div>
                <div className="text-[11px] space-y-1 pl-6">
                  <p>
                    • <strong>Kas Fisik Laci:</strong>{' '}
                    {expenseSource === 'LACI'
                      ? `Uang fisik kasir akan berkurang ${expenseAmount ? formatRupiah(Number(expenseAmount)) : 'Rp 0'}.`
                      : 'Uang fisik kasir tetap utuh (dibayar dari Kas Besar).'}
                  </p>
                  <p>
                    • <strong>Dampak Laba Bersih:</strong>{' '}
                    {expenseType === 'STOK' ? (
                      <span className="text-[#1B5E20] font-bold">
                        TIDAK MEMOTONG Laba Bersih Toko (karena ini adalah konversi kas menjadi Aset Stok/Persediaan; HPP dihitung saat barang terjual).
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold">
                        MEMOTONG Estimasi Laba Bersih Toko sebesar {expenseAmount ? formatRupiah(Number(expenseAmount)) : 'Rp 0'} (beban operasional langsung).
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="flex-1 py-3 rounded-2xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Store Wallet Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Perbarui Saldo Dompet Toko</h3>
                <p className="text-xs text-gray-500">Tabel store_wallets</p>
              </div>
              <button onClick={() => setIsWalletModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Kas Laci Saat Ini (Rp)</label>
                <input
                  type="number"
                  value={walletForm.initial_cash}
                  onChange={(e) => setWalletForm({ ...walletForm, initial_cash: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-2xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Anggaran Belanja / Kulakan (Rp)</label>
                <input
                  type="number"
                  value={walletForm.shopping_budget}
                  onChange={(e) => setWalletForm({ ...walletForm, shopping_budget: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-2xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Anggaran Operasional (Rp)</label>
                <input
                  type="number"
                  value={walletForm.operational_budget}
                  onChange={(e) => setWalletForm({ ...walletForm, operational_budget: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-2xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Anggaran Pemilik (Rp)</label>
                <input
                  type="number"
                  value={walletForm.owner_budget}
                  onChange={(e) => setWalletForm({ ...walletForm, owner_budget: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-2xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWallet}
                  className="flex-1 py-2.5 rounded-2xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold transition-colors cursor-pointer"
                >
                  {isSubmittingWallet ? 'Menyimpan...' : 'Simpan Alokasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Action Modal: Analisis BEP */}
      <AnalisisBEPModal
        isOpen={isBEPModalOpen}
        onClose={() => setIsBEPModalOpen(false)}
        todayRevenue={totalRevenue}
        averageMarginPct={averageMarginPct}
        averageDailyExpense={averageDailyExpense}
      />

      {/* Quick Action Modal: Opname Kas Laci */}
      <OpnameKasModal
        isOpen={isOpnameModalOpen}
        onClose={() => setIsOpnameModalOpen(false)}
        systemCash={totalActualDrawerCash}
        initialCash={initialCash}
        wallet={wallet}
        onRefresh={onRefresh}
        onWalletUpdated={onWalletUpdated}
      />

      {/* Quick Action Modal: Cetak PDF Laporan Keuangan */}
      <CetakLaporanModal
        isOpen={isCetakModalOpen}
        onClose={() => setIsCetakModalOpen(false)}
        periodLabel={getPeriodLabel()}
        totalRevenue={totalRevenue}
        totalGrossProfit={totalGrossProfit}
        totalExpenseAmount={totalExpenseAmount}
        netProfit={netProfit}
        initialCash={initialCash}
        cashSales={cashSales}
        debtPaymentsCash={debtPaymentsCash}
        operationalExpenses={drawerOperationalExpenses}
        stockExpenses={drawerStockExpenses}
        totalActualDrawerCash={totalActualDrawerCash}
        dailyRentTarget={DAILY_RENT_TARGET}
        dailyBankTarget={DAILY_BANK_TARGET}
        totalDailyObligations={TOTAL_DAILY_OBLIGATIONS}
        netAvailableCash={netAvailableCash}
        salesCount={filteredSales.length}
        expensesCount={filteredExpenses.length}
        storeProfile={storeProfile}
      />

      {/* Quick Action Modal: Cetak PDF Laporan Biaya & Pengeluaran Toko */}
      <CetakBiayaModal
        isOpen={isCetakBiayaModalOpen}
        onClose={() => setIsCetakBiayaModalOpen(false)}
        periodLabel={getPeriodLabel()}
        expenses={displayedExpenses}
        totalExpenseAmount={totalExpenseAmount}
        totalOperationalExpenses={totalOperationalExpenses}
        totalStockExpenses={totalStockExpenses}
        drawerOperationalExpenses={drawerOperationalExpenses}
        drawerStockExpenses={drawerStockExpenses}
        kasBesarExpenses={kasBesarExpenses}
        storeProfile={storeProfile}
        sourceFilter={expenseSourceFilter}
      />

      {/* Detail Struk Modal */}
      {selectedSaleForDetail && (
        <DetailStrukModal
          isOpen={!!selectedSaleForDetail}
          onClose={() => setSelectedSaleForDetail(null)}
          sale={selectedSaleForDetail}
          debts={debts}
          onPrintReceipt={(sale) => {
            setSelectedSaleForReceipt(sale);
          }}
          onSaleUpdated={(updatedSale) => {
            setSelectedSaleForDetail(updatedSale);
            if (onSaleUpdated) {
              onSaleUpdated(updatedSale);
            }
            onRefresh().catch(console.warn);
          }}
          onDebtPaid={(payment) => {
            if (onDebtPaid) {
              onDebtPaid(payment);
            }
            onRefresh().catch(console.warn);
          }}
        />
      )}

      {/* Struk Reprint Modal */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          isOpen={!!selectedSaleForReceipt}
          onClose={() => setSelectedSaleForReceipt(null)}
          saleId={selectedSaleForReceipt.id}
          status={selectedSaleForReceipt.status}
          debts={debts}
          items={(selectedSaleForReceipt.items || []).map((it) => {
            const rawQty = it.qty_kg ?? it.qty ?? it.original_qty ?? 1;
            const parsedQty = Number(rawQty) || 1;
            return {
              product: it.product || {
                id: it.product_id,
                name: 'Barang Sembako',
                category: 'Sembako',
                cost_price: it.cost_price || 0,
                selling_price: it.subtotal / parsedQty,
                stock_kg: 0,
                min_stock: 0,
                is_active: true,
                image_url: null,
                unit: it.unit || 'kg',
                barcode: null,
              },
              qty: parsedQty,
              quantity: parsedQty,
              qty_kg: parsedQty,
              unit: it.unit || 'kg',
              subtotal: it.subtotal,
            };
          })}
          totalAmount={selectedSaleForReceipt.total_amount}
          cashReceived={selectedSaleForReceipt.cash_received}
          changeAmount={selectedSaleForReceipt.change_amount}
          paymentMethod={selectedSaleForReceipt.payment_method}
          customerName={selectedSaleForReceipt.customer_name || selectedSaleForReceipt.notes || undefined}
          customerPhone={selectedSaleForReceipt.customer_phone || undefined}
          date={selectedSaleForReceipt.created_at}
          storeProfile={storeProfile}
          onUpdateStoreProfile={onUpdateStoreProfile}
        />
      )}

      {/* Visual Calendar Date Range Picker Modal */}
      <CalendarRangeModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        startDate={customStartDate}
        endDate={customEndDate}
        onApply={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
          setDateFilter('custom_range');
        }}
      />
    </div>
  );
};
