import React, { useState, useMemo } from 'react';
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
  Info
} from 'lucide-react';
import { Sale, Expense, StoreWallet, StoreProfile } from '../../types';
import { formatRupiah, formatDate, formatDateTime, playBeep } from '../../lib/utils';
import { createExpense, deleteExpense, updateStoreWallet, upsertStoreWallet } from '../../services/api';
import { ReceiptModal } from '../ReceiptModal';
import { ArusKasLaciCard } from './ArusKasLaciCard';
import { SinkingFundCard } from './SinkingFundCard';
import { CadanganAkumulasiCard } from './CadanganAkumulasiCard';
import { TrenChartCard } from './TrenChartCard';
import { AnalisisBEPModal } from './AnalisisBEPModal';
import { OpnameKasModal } from './OpnameKasModal';
import { CetakLaporanModal } from './CetakLaporanModal';
import { DetailStrukModal } from './DetailStrukModal';

interface LaporanViewProps {
  sales: Sale[];
  expenses: Expense[];
  wallet: StoreWallet | null;
  onRefresh: () => Promise<void>;
  storeProfile?: StoreProfile;
  onUpdateStoreProfile?: (profile: StoreProfile) => void;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  sales,
  expenses,
  wallet,
  onRefresh,
  storeProfile,
  onUpdateStoreProfile,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ringkasan' | 'penjualan' | 'pengeluaran' | 'dompet'>('ringkasan');
  const [dateFilter, setDateFilter] = useState<'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'semua'>('hari_ini');

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
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

  // Date filtering helper
  const filterByDate = (dateStr: string) => {
    if (dateFilter === 'semua') return true;
    const date = new Date(dateStr);
    const now = new Date();

    if (dateFilter === 'hari_ini') {
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }
    if (dateFilter === 'minggu_ini') {
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    if (dateFilter === 'bulan_ini') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => filterByDate(s.created_at));
  }, [sales, dateFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => filterByDate(e.created_at));
  }, [expenses, dateFilter]);

  // Financial Metrics
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  }, [filteredSales]);

  const totalCost = useMemo(() => {
    let cost = 0;
    for (const sale of filteredSales) {
      if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
        for (const it of sale.items) {
          cost += (it.cost_price || 0) * (it.qty_kg || 0);
        }
      } else {
        cost += (Number(sale.total_amount) || 0) * 0.8;
      }
    }
    return cost;
  }, [filteredSales, totalRevenue]);

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

  // Expenses grouped by source: Laci vs Kas Besar
  const drawerOperationalExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => {
        const isDrawer = (e.source || 'LACI') === 'LACI';
        const cat = (e.category || '').toUpperCase();
        return isDrawer && cat !== 'STOK' && cat !== 'KULAKAN';
      })
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const drawerStockExpenses = useMemo(() => {
    return filteredExpenses
      .filter((e) => {
        const isDrawer = (e.source || 'LACI') === 'LACI';
        const cat = (e.category || '').toUpperCase();
        return isDrawer && (cat === 'STOK' || cat === 'KULAKAN');
      })
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
  // = Modal Awal + Penjualan Tunai - Pengeluaran Operasional (Laci) - Belanja Stok Laci
  // *Catatan: Pengeluaran dari Kas Besar TIDAK mengurangi uang fisik laci kasir harian!*
  const totalActualDrawerCash = initialCash + cashSales - drawerOperationalExpenses - drawerStockExpenses;

  // FORMULA 2: ESTIMASI LABA BERSIH HARIAN
  // Laba Bersih Harian (Kasir/Laci) = Laba Kotor - Pengeluaran Operasional Laci
  // Laba Bersih Konsolidasi = Laba Kotor - Total Semua Pengeluaran
  const dailyDrawerNetProfit = totalGrossProfit - drawerOperationalExpenses;
  const netProfit = totalGrossProfit - totalExpenseAmount;

  // 2. Modul Alokasi Kewajiban & Reservasi Dana (Sinking Fund)
  const DAILY_RENT_TARGET = 22000; // Rp 8.000.000 / tahun
  const DAILY_BANK_TARGET = 173400; // Rp 5.200.000 / bulan
  const TOTAL_DAILY_OBLIGATIONS = DAILY_RENT_TARGET + DAILY_BANK_TARGET; // Rp 195.400 / hari

  const netCashFlow = cashSales - drawerOperationalExpenses - drawerStockExpenses;
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

  // Handle Add Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!expenseTitle.trim() || isNaN(amt) || amt <= 0) {
      alert('Lengkapi judul dan nominal pengeluaran!');
      return;
    }

    try {
      setIsSubmittingExpense(true);
      await createExpense({
        title: expenseTitle.trim(),
        amount: amt,
        category: expenseCategory,
        source: expenseSource,
      });
      playBeep('success');
      setIsExpenseModalOpen(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseSource('LACI');
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
      await upsertStoreWallet(walletForm);
      playBeep('success');
      setIsWalletModalOpen(false);
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
    if (dateFilter === 'bulan_ini') return 'Bulan Ini';
    return 'Semua Waktu';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Filter & Subtabs Navigation */}
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
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs sm:text-sm font-medium text-gray-800 shadow-xs focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
          >
            <option value="hari_ini">Hari Ini</option>
            <option value="minggu_ini">7 Hari Terakhir</option>
            <option value="bulan_ini">Bulan Ini</option>
            <option value="semua">Semua Waktu</option>
          </select>
        </div>
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
          onClick={() => setIsCetakModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer ml-auto"
        >
          <Printer className="w-3.5 h-3.5 text-amber-300" />
          <span>Cetak PDF Laporan</span>
        </button>
      </div>

      {/* Main Tab: Ringkasan & Kas Laci */}
      {activeSubTab === 'ringkasan' && (
        <div className="space-y-6">
          {/* 4 Standard Financial Highlight Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Omzet / Revenue */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Total Penjualan</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{formatRupiah(totalRevenue)}</p>
              <p className="text-[11px] text-gray-500 mt-1">{filteredSales.length} transaksi kasir</p>
            </div>

            {/* Estimasi Laba Kotor */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Estimasi Laba Kotor</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-blue-900">{formatRupiah(totalGrossProfit)}</p>
              <p className="text-[11px] text-gray-500 mt-1">Margin Toko: ~{averageMarginPct.toFixed(1)}%</p>
            </div>

            {/* Total Pengeluaran */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Total Pengeluaran</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-rose-900">{formatRupiah(totalExpenseAmount)}</p>
              <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                <span>Laci: {formatRupiah(drawerOperationalExpenses + drawerStockExpenses)}</span>
                {kasBesarExpenses > 0 && <span>Kas Besar: {formatRupiah(kasBesarExpenses)}</span>}
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
              <p className="text-[10px] text-emerald-200 mt-1">
                Laba Kotor - Biaya Laci ({formatRupiah(drawerOperationalExpenses)})
              </p>
            </div>
          </div>

          {/* Module 1: Ringkasan Kas & Arus Kas Laci */}
          <ArusKasLaciCard
            initialCash={initialCash}
            cashSales={cashSales}
            operationalExpenses={drawerOperationalExpenses}
            stockExpenses={drawerStockExpenses}
            totalActualDrawerCash={totalActualDrawerCash}
            onOpenOpnameModal={() => setIsOpnameModalOpen(true)}
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
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#1B5E20]" />
              <h3 className="font-bold text-gray-900 text-sm">
                Daftar Penjualan Kasir ({filteredSales.length} Transaksi)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">
                Total Omset: <strong className="text-[#1B5E20]">{formatRupiah(totalRevenue)}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/70 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
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
                    <td colSpan={8} className="p-8 text-center text-gray-400 text-xs">
                      Belum ada riwayat penjualan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const items = sale.items || sale.sale_items || [];
                    const isExpanded = expandedSaleIds.has(sale.id);
                    const totalQty = items.reduce((acc, it) => acc + (Number(it.qty_kg) || 1), 0);

                    // Formatted summary text e.g. "Beras Heler Pulen (1 kg) x1, Bawang Merah (250 gr) x1"
                    const summaryText = items.length > 0 
                      ? items.map(it => {
                          const name = it.product?.name || 'Barang Sembako';
                          const qty = it.qty_kg;
                          const unit = it.unit || it.product?.unit || 'kg';
                          return `${name} (${qty} ${unit})`;
                        }).join(', ')
                      : '1 Transaksi Penjualan';

                    return (
                      <React.Fragment key={sale.id}>
                        <tr 
                          onClick={() => setSelectedSaleForDetail(sale)}
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

                          {/* ID Nota */}
                          <td className="px-4 py-3 font-mono font-bold text-xs text-gray-900">
                            <span 
                              className="inline-flex items-center gap-1 hover:text-[#1B5E20] underline decoration-dotted underline-offset-4"
                              title="Klik untuk lihat struk belanja lengkap"
                            >
                              #{sale.id.slice(0, 8).toUpperCase()}
                            </span>
                          </td>

                          {/* Waktu */}
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {formatDateTime(sale.created_at)}
                          </td>

                          {/* Metode */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                              sale.payment_method === 'CASH' || sale.payment_method === 'TUNAI'
                                ? 'bg-emerald-50 text-[#1B5E20] border-emerald-200'
                                : sale.payment_method === 'QRIS'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : sale.payment_method === 'UTANG'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {sale.payment_method}
                            </span>
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
                                onClick={() => setSelectedSaleForDetail(sale)}
                                title="Lihat Rincian Struk"
                                className="px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Eye className="w-3 h-3 text-gray-500" />
                                <span className="hidden sm:inline">Rincian</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSaleForReceipt(sale)}
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
                            <td colSpan={8} className="p-3 sm:px-6">
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
                                    onClick={() => setSelectedSaleForDetail(sale)}
                                    className="text-xs text-[#2E7D32] hover:text-[#1B5E20] font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Buka Modal Struk</span>
                                  </button>
                                </div>

                                {items.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-1">
                                    Rincian individual item tidak tersedia untuk transaksi lama ini.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {items.map((it, idx) => {
                                      const pName = it.product?.name || 'Barang Sembako';
                                      const u = it.unit || it.product?.unit || 'kg';
                                      const unitPrice = it.product?.selling_price || (it.qty_kg > 0 ? it.subtotal / it.qty_kg : it.subtotal);
                                      return (
                                        <div 
                                          key={idx} 
                                          className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-200/60 flex items-center justify-between text-xs"
                                        >
                                          <div className="min-w-0 pr-2">
                                            <p className="font-semibold text-gray-800 truncate">{pName}</p>
                                            <p className="text-[11px] text-gray-500">
                                              {it.qty_kg} {u} @ {formatRupiah(unitPrice)}
                                            </p>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-mono font-bold text-gray-900 block">
                                              {formatRupiah(it.subtotal)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
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
            <button
              onClick={() => {
                setExpenseTitle('');
                setExpenseAmount('');
                setExpenseCategory('OPERASIONAL');
                setExpenseSource('LACI');
                setIsExpenseModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Pengeluaran Baru</span>
            </button>
          </div>

          {/* Filter Source Tabs & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 block">Total Semua Biaya:</span>
              <span className="text-lg font-bold font-mono text-gray-900 block mt-0.5">
                {formatRupiah(totalExpenseAmount)}
              </span>
              <span className="text-[10px] text-gray-400">{filteredExpenses.length} transaksi</span>
            </div>

            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-800 block">Dari Laci Kasir:</span>
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
              <span className="text-[10px] text-blue-700">Tidak memotong kas laci harian</span>
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
                  return (
                    <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            (exp.category || '').toUpperCase() === 'STOK' || (exp.category || '').toUpperCase() === 'KULAKAN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {exp.category}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                            isKasBesar
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-[#1B5E20] border border-emerald-200'
                          }`}>
                            {isKasBesar ? <Landmark className="w-2.5 h-2.5" /> : <Wallet className="w-2.5 h-2.5" />}
                            <span>{isKasBesar ? 'Kas Besar' : 'Laci Kasir'}</span>
                          </span>
                        </div>

                        <h4 className="font-bold text-gray-900 text-sm">{exp.title}</h4>
                        <p className="text-xs text-gray-400">{formatDateTime(exp.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-rose-600 text-sm sm:text-base">
                          -{formatRupiah(exp.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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

      {/* Add Expense Modal with Enhanced Source Selection */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Catat Pengeluaran Operasional</h3>
                <p className="text-xs text-gray-500">Pilih sumber dana & masukkan rincian biaya</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs sm:text-sm">
              {/* 1. Sumber Dana Operasional Selection */}
              <div className="space-y-2">
                <label className="block text-gray-800 font-bold text-xs uppercase tracking-wider">
                  Sumber Dana Pengeluaran <span className="text-rose-500">*</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option A: Laci Kasir Harian */}
                  <div
                    onClick={() => setExpenseSource('LACI')}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      expenseSource === 'LACI'
                        ? 'border-[#2E7D32] bg-emerald-50/70 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                        <Wallet className={`w-4 h-4 ${expenseSource === 'LACI' ? 'text-[#2E7D32]' : 'text-gray-400'}`} />
                        <span>Laci Kasir Harian</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        expenseSource === 'LACI' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'border-gray-300'
                      }`}>
                        {expenseSource === 'LACI' && <Check className="w-3 h-3 stroke-3" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      <strong className="text-[#1B5E20]">Mengurangi</strong> Uang Fisik Laci & dicatat dalam Laba/Rugi Harian.
                    </p>
                  </div>

                  {/* Option B: Kas Besar / Saldo Cadangan */}
                  <div
                    onClick={() => setExpenseSource('KAS_BESAR')}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      expenseSource === 'KAS_BESAR'
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                        <Landmark className={`w-4 h-4 ${expenseSource === 'KAS_BESAR' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span>Kas Besar / Cadangan</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        expenseSource === 'KAS_BESAR' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                      }`}>
                        {expenseSource === 'KAS_BESAR' && <Check className="w-3 h-3 stroke-3" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      <strong className="text-blue-700">TIDAK mengurangi</strong> Uang Fisik Laci, hanya tercatat di Laporan Bulanan/Utama.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Judul / Keperluan */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Judul / Keperluan Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beli Beras dari Laci / Token Listrik / Beli Plastik"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm"
                />
              </div>

              {/* 3. Kategori Biaya */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Kategori Biaya</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 bg-white focus:border-[#2E7D32] outline-none text-xs sm:text-sm"
                >
                  <option value="OPERASIONAL">OPERASIONAL UMUM</option>
                  <option value="STOK">BELANJA STOK DARI LACI (RESTOK)</option>
                  <option value="LISTRIK_AIR">LISTRIK & AIR</option>
                  <option value="PACKAGING">KEMASAN / PLASTIK</option>
                  <option value="GAJI">GAJI KARYAWAN</option>
                  <option value="TRANSPORT">TRANSPORTASI / BENSIN</option>
                  <option value="LAIN_LAIN">LAIN-LAIN</option>
                </select>
              </div>

              {/* 4. Nominal Biaya */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Nominal Biaya (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Contoh: 50000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 font-mono font-bold text-rose-600 focus:border-[#2E7D32] outline-none text-base"
                />
              </div>

              {/* Real-Time Impact Alert */}
              <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                expenseSource === 'LACI'
                  ? 'bg-amber-50 border border-amber-200 text-amber-900'
                  : 'bg-blue-50 border border-blue-200 text-blue-900'
              }`}>
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  {expenseSource === 'LACI'
                    ? `Dampak: Uang fisik di laci kasir akan terpotong sebesar ${expenseAmount ? formatRupiah(Number(expenseAmount)) : 'Rp 0'}.`
                    : 'Dampak: Uang kasir tetap utuh. Biaya dialokasikan ke pembukuan Kas Besar Toko.'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="flex-1 py-3 rounded-2xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold transition-colors shadow-xs cursor-pointer"
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
      />

      {/* Quick Action Modal: Cetak PDF Laporan */}
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

      {/* Detail Struk Modal */}
      <DetailStrukModal
        isOpen={!!selectedSaleForDetail}
        onClose={() => setSelectedSaleForDetail(null)}
        sale={selectedSaleForDetail}
        onPrintReceipt={(sale) => {
          setSelectedSaleForReceipt(sale);
        }}
      />

      {/* Struk Reprint Modal */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          isOpen={!!selectedSaleForReceipt}
          onClose={() => setSelectedSaleForReceipt(null)}
          saleId={selectedSaleForReceipt.id}
          items={(selectedSaleForReceipt.items || []).map((it) => ({
            product: it.product || {
              id: it.product_id,
              name: 'Barang Sembako',
              category: 'Sembako',
              cost_price: it.cost_price || 0,
              selling_price: it.subtotal / (it.qty_kg || 1),
              stock_kg: 0,
              min_stock: 0,
              is_active: true,
              image_url: null,
              unit: it.unit || 'kg',
              barcode: null,
            },
            qty: it.qty_kg,
            unit: it.unit || 'kg',
            subtotal: it.subtotal,
          }))}
          totalAmount={selectedSaleForReceipt.total_amount}
          paymentMethod={selectedSaleForReceipt.payment_method}
          customerName={selectedSaleForReceipt.notes || undefined}
          date={selectedSaleForReceipt.created_at}
          storeProfile={storeProfile}
          onUpdateStoreProfile={onUpdateStoreProfile}
        />
      )}
    </div>
  );
};
