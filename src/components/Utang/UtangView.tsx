import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Phone, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  MessageSquare, 
  Trash2,
  X,
  CreditCard,
  Receipt,
  History,
  Clock,
  Printer,
  ChevronRight,
  Filter,
  Check
} from 'lucide-react';
import { DebtCredit, DebtPayment, Sale, Order } from '../../types';
import { formatRupiah, formatDate, formatDateTime, playBeep } from '../../lib/utils';
import { 
  createDebtCredit, 
  payDebtCredit, 
  deleteDebtCredit, 
  recordDebtPayment, 
  deleteDebtPayment,
  getLocalDebtPayments,
  handlePelunasanUtang
} from '../../services/api';

interface UtangViewProps {
  debts: DebtCredit[];
  debtPayments?: DebtPayment[];
  sales?: Sale[];
  orders?: Order[];
  onRefresh: () => Promise<void>;
  onPaymentRecorded?: (payment: DebtPayment) => void;
}

export const UtangView: React.FC<UtangViewProps> = ({ 
  debts, 
  debtPayments = [], 
  sales = [], 
  orders = [],
  onRefresh, 
  onPaymentRecorded 
}) => {
  // Navigation Sub-tab
  const [activeTab, setActiveTab] = useState<'daftar' | 'riwayat_pembayaran' | 'transaksi_bon'>('daftar');
  
  // Filters
  const [filterType, setFilterType] = useState<'SEMUA' | 'PIUTANG' | 'UTANG'>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | 'UNPAID' | 'PAID'>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payModalItem, setPayModalItem] = useState<DebtCredit | null>(null);
  const [paymentInput, setPaymentInput] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'QRIS'>('TUNAI');
  const [viewDetailItem, setViewDetailItem] = useState<DebtCredit | null>(null);
  const [viewPaymentReceipt, setViewPaymentReceipt] = useState<DebtPayment | null>(null);

  // Add form state
  const [formData, setFormData] = useState({
    type: 'PIUTANG' as 'PIUTANG' | 'UTANG',
    customer_or_supplier_name: '',
    phone_number: '',
    total_amount: 0,
    due_date: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effective payment logs
  const effectivePayments = useMemo(() => {
    if (debtPayments && debtPayments.length > 0) {
      return debtPayments;
    }
    return getLocalDebtPayments();
  }, [debtPayments]);

  const totalPaymentsReceived = useMemo(() => {
    return effectivePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [effectivePayments]);

  // 1. Unified Debts List (Synthesizes direct debts_credits with any cashier sales made with payment_method === 'UTANG')
  const unifiedDebts = useMemo(() => {
    const rawList: DebtCredit[] = [...(debts || [])];
    const existingTags = new Set(
      rawList.map((d) => (d.notes || '').toLowerCase()).filter(Boolean)
    );
    const existingIds = new Set(rawList.map((d) => d.id));

    // Check sales with payment_method === 'UTANG'
    if (sales && sales.length > 0) {
      for (const s of sales) {
        if ((s.payment_method || '').toUpperCase() === 'UTANG') {
          const shortId = (s.id || '').slice(0, 8).toLowerCase();
          const alreadyTracked = Array.from(existingTags).some(tag => tag.includes(shortId)) ||
            existingIds.has(s.id) ||
            rawList.some(d => d.notes && d.notes.toLowerCase().includes(shortId));

          if (!alreadyTracked) {
            const custName = (s.customer_name || (s.notes ? s.notes.replace(/^Pelanggan:\s*/i, '').split('•')[0] : '')).trim() || 'Pelanggan Kasir';
            const total = Number(s.total_amount) || 0;
            const isSaleExplicitPaid = (s.status || '').toLowerCase() === 'paid';

            rawList.push({
              id: `sale_debt_${s.id}`,
              type: 'PIUTANG',
              customer_or_supplier_name: custName,
              phone_number: s.customer_phone || null,
              total_amount: total,
              remaining_amount: isSaleExplicitPaid ? 0 : total,
              status: isSaleExplicitPaid ? 'paid' : 'unpaid',
              due_date: null,
              notes: `Transaksi kasir #${s.id ? s.id.slice(0, 8) : ''}`,
              created_at: s.created_at || new Date().toISOString(),
            });
          }
        }
      }
    }

    // Cross-reference with effectivePayments & sales to guarantee 100% accurate remaining_amount & status
    return rawList.map((item) => {
      const total = Number(item.total_amount) || 0;
      const itemId = String(item.id || '').toLowerCase();
      const rawSaleId = itemId.replace('sale_debt_', '');
      const shortId = rawSaleId.slice(0, 8);
      const custNameLower = (item.customer_or_supplier_name || '').toLowerCase();
      const itemNotes = (item.notes || '').toLowerCase();

      // Ensure customer transactions are classified as PIUTANG (Piutang Pelanggan)
      const isCustomerTransaction =
        item.type === 'PIUTANG' ||
        custNameLower.includes('pelanggan') ||
        custNameLower.includes('transaksi') ||
        itemNotes.includes('transaksi kasir') ||
        itemNotes.includes('kasir') ||
        itemId.startsWith('sale_debt_') ||
        itemId.startsWith('bon_');

      const correctedType: 'PIUTANG' | 'UTANG' = isCustomerTransaction ? 'PIUTANG' : 'UTANG';

      // Check if matching sale is marked paid in sales array
      const matchingSale = sales.find(s => 
        s.id.toLowerCase() === rawSaleId || 
        s.id.toLowerCase().startsWith(shortId) ||
        (s.notes && s.notes.toLowerCase().includes(shortId))
      );
      const isSalePaid = matchingSale ? (matchingSale.status || '').toLowerCase() === 'paid' : false;

      // Sum all recorded payments matching this item
      const paidSoFar = effectivePayments
        .filter((p) => {
          if (!p) return false;
          const pDebtId = String(p.debt_id || '').toLowerCase();
          const pNotes = String(p.notes || '').toLowerCase();

          if (pDebtId && (pDebtId === itemId || pDebtId === rawSaleId || (shortId.length >= 6 && pDebtId.includes(shortId)))) {
            return true;
          }
          if (shortId.length >= 6 && pNotes.includes(shortId)) {
            return true;
          }
          if (pNotes.includes(itemId) || pNotes.includes(rawSaleId)) {
            return true;
          }
          if (itemNotes && itemNotes.includes('transaksi kasir') && pNotes.includes(itemNotes)) {
            return true;
          }
          return false;
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const isExplicitPaid = item.status === 'paid' || isSalePaid;
      const calculatedRemaining = isExplicitPaid 
        ? 0 
        : Math.max(0, (item.remaining_amount !== undefined && item.remaining_amount !== null && !itemId.startsWith('sale_debt_') ? Math.min(Number(item.remaining_amount), total - paidSoFar) : total - paidSoFar));

      const isLunas = isExplicitPaid || calculatedRemaining <= 0;
      const isPartial = !isLunas && (item.status === 'partial' || paidSoFar > 0);

      return {
        ...item,
        type: correctedType,
        remaining_amount: isLunas ? 0 : calculatedRemaining,
        status: (isLunas ? 'paid' : isPartial ? 'partial' : 'unpaid') as 'paid' | 'partial' | 'unpaid',
      };
    });
  }, [debts, sales, effectivePayments]);

  // Totals calculations
  const totalPiutang = useMemo(() => {
    return unifiedDebts
      .filter((d) => d.type === 'PIUTANG' && d.status !== 'paid' && (Number(d.remaining_amount) || 0) > 0)
      .reduce((acc, d) => acc + (Number(d.remaining_amount) || 0), 0);
  }, [unifiedDebts]);

  const totalUtang = useMemo(() => {
    return unifiedDebts
      .filter((d) => d.type === 'UTANG' && d.status !== 'paid' && (Number(d.remaining_amount) || 0) > 0)
      .reduce((acc, d) => acc + (Number(d.remaining_amount) || 0), 0);
  }, [unifiedDebts]);

  const dueSoonCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return unifiedDebts.filter(
      (d) => d.status !== 'paid' && d.due_date && d.due_date <= today && (Number(d.remaining_amount) || 0) > 0
    ).length;
  }, [unifiedDebts]);

  // Sales made with UTANG
  const utangSales = useMemo(() => {
    return (sales || []).filter((s) => (s.payment_method || '').toUpperCase() === 'UTANG');
  }, [sales]);

  // Filtered debts list for Tab 1
  const filteredDebts = useMemo(() => {
    return unifiedDebts.filter((d) => {
      // Type match
      if (filterType !== 'SEMUA' && d.type !== filterType) return false;

      // Status match
      const isPaid = d.status === 'paid' || (Number(d.remaining_amount) || 0) <= 0;
      if (filterStatus === 'UNPAID' && isPaid) return false;
      if (filterStatus === 'PAID' && !isPaid) return false;

      // Query match across multiple fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (d.customer_or_supplier_name || '').toLowerCase().includes(q);
        const phoneMatch = (d.phone_number || '').includes(q);
        const notesMatch = (d.notes || '').toLowerCase().includes(q);
        const idMatch = (d.id || '').toLowerCase().includes(q);
        const amountMatch = (d.total_amount || '').toString().includes(q) || (d.remaining_amount || '').toString().includes(q);
        return nameMatch || phoneMatch || notesMatch || idMatch || amountMatch;
      }
      return true;
    });
  }, [unifiedDebts, filterType, filterStatus, searchQuery]);

  // Filtered payment logs for Tab 2
  const filteredPayments = useMemo(() => {
    return effectivePayments.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (p.customer_name || '').toLowerCase().includes(q);
      const notesMatch = (p.notes || '').toLowerCase().includes(q);
      const methodMatch = (p.payment_method || '').toLowerCase().includes(q);
      const amountMatch = (p.amount || '').toString().includes(q);
      const idMatch = (p.id || '').toLowerCase().includes(q);
      return nameMatch || notesMatch || methodMatch || amountMatch || idMatch;
    });
  }, [effectivePayments, searchQuery]);

  // Filtered sales with UTANG for Tab 3
  const filteredUtangSales = useMemo(() => {
    return utangSales.filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const idMatch = (s.id || '').toLowerCase().includes(q);
      const custMatch = (s.customer_name || '').toLowerCase().includes(q);
      const notesMatch = (s.notes || '').toLowerCase().includes(q);
      const amountMatch = (s.total_amount || '').toString().includes(q);
      return idMatch || custMatch || notesMatch || amountMatch;
    });
  }, [utangSales, searchQuery]);

  // Handle WhatsApp Reminder
  const sendWhatsAppReminder = (item: DebtCredit) => {
    if (!item.phone_number) {
      alert('Nomor telepon/WhatsApp belum dicatat untuk data ini.');
      return;
    }
    let cleanPhone = item.phone_number.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }

    const dueDateText = item.due_date ? ` pada tanggal ${formatDate(item.due_date)}` : '';
    const message = encodeURIComponent(
      `Halo Bpk/Ibu ${item.customer_or_supplier_name}, kami dari Toko Berkah. Mengingatkan kembali catatan tagihan belanja dengan sisa ${formatRupiah(item.remaining_amount)}${dueDateText}. Pembayaran dapat ditransfer atau diserahkan langsung ke kasir Toko Berkah. Terima kasih banyak 🙏`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  // Handle Pay / Cicil Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalItem) return;
    const amount = Number(paymentInput);
    if (isNaN(amount) || amount <= 0) {
      alert('Masukkan nominal pembayaran yang valid!');
      return;
    }

    try {
      setIsSubmitting(true);
      const isPiutang = payModalItem.type === 'PIUTANG';

      // Check if it's linked to a sale id
      let saleIdMatch: string | null = null;
      if (payModalItem.id.startsWith('sale_debt_')) {
        saleIdMatch = payModalItem.id.replace('sale_debt_', '');
      } else if (payModalItem.notes) {
        const match = payModalItem.notes.match(/#[a-f0-9-]+/i) || payModalItem.notes.match(/transaksi kasir\s*([a-f0-9-]+)/i);
        if (match) saleIdMatch = match[0].replace('#', '');
      }

      const newPayment = await recordDebtPayment({
        debt_id: payModalItem.id,
        customer_name: payModalItem.customer_or_supplier_name,
        amount,
        payment_method: paymentMethod,
        notes: `Pelunasan ${isPiutang ? 'piutang pelanggan' : 'utang supplier'} (${paymentMethod}): ${payModalItem.customer_or_supplier_name}${payModalItem.notes ? ` [${payModalItem.notes}]` : ''}`,
      });

      if (saleIdMatch) {
        await handlePelunasanUtang(saleIdMatch, amount);
      }

      if (onPaymentRecorded) {
        onPaymentRecorded(newPayment);
      }

      playBeep('success');
      alert(`Pelunasan berhasil dicatat! Kas Toko bertambah ${formatRupiah(amount)}`);
      setPayModalItem(null);
      setPaymentInput('');
      setPaymentMethod('TUNAI');
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal mencatat pembayaran: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add New Record Submit
  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_or_supplier_name.trim()) {
      setErrorMessage('Harap isi nama pelanggan atau supplier!');
      return;
    }
    if (Number(formData.total_amount) <= 0) {
      setErrorMessage('Nominal tagihan harus lebih dari 0!');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await createDebtCredit({
        type: formData.type,
        customer_or_supplier_name: formData.customer_or_supplier_name.trim(),
        phone_number: formData.phone_number.trim() || null,
        total_amount: Number(formData.total_amount),
        remaining_amount: Number(formData.total_amount),
        status: 'unpaid',
        due_date: formData.due_date || null,
        notes: formData.notes.trim() || null,
      });

      playBeep('success');
      setIsAddModalOpen(false);
      setFormData({
        type: 'PIUTANG',
        customer_or_supplier_name: '',
        phone_number: '',
        total_amount: 0,
        due_date: '',
        notes: '',
      });
      await onRefresh();
    } catch (err: any) {
      console.error('Create debt error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan data utang');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Debt Record
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus catatan utang/piutang atas nama "${name}"?`)) return;
    try {
      await deleteDebtCredit(id);
      playBeep('beep');
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menghapus data: ${err.message}`);
    }
  };

  // Handle Delete Payment History
  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Hapus riwayat pelunasan ini?')) return;
    try {
      await deleteDebtPayment(paymentId);
      playBeep('beep');
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menghapus riwayat: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Piutang Pelanggan (Receivable) */}
        <div 
          onClick={() => {
            setActiveTab('daftar');
            setFilterType('PIUTANG');
            setFilterStatus('UNPAID');
          }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
              <ArrowDownLeft className="w-4 h-4 text-[#2E7D32]" />
              <span>Piutang (Belum Lunas)</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-[#1B5E20] transition-colors">
              {formatRupiah(totalPiutang)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Uang Toko Berkah di luar</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Utang Toko ke Supplier (Payable) */}
        <div 
          onClick={() => {
            setActiveTab('daftar');
            setFilterType('UTANG');
            setFilterStatus('UNPAID');
          }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-rose-400 hover:shadow-md transition-all group"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 mb-1">
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
              <span>Utang Kulakan / Supplier</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-rose-700 transition-colors">
              {formatRupiah(totalUtang)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Kewajiban bayar toko</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Pelunasan Diterima (History) */}
        <div 
          onClick={() => {
            setActiveTab('riwayat_pembayaran');
          }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 mb-1">
              <History className="w-4 h-4 text-blue-600" />
              <span>Total Pelunasan Masuk</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-900 group-hover:text-blue-950 transition-colors">
              {formatRupiah(totalPaymentsReceived)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{effectivePayments.length} riwayat pembayaran</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Jatuh Tempo Warning */}
        <div 
          onClick={() => {
            setActiveTab('daftar');
            setFilterStatus('UNPAID');
          }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Jatuh Tempo / Melewati Batas</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-amber-900">{dueSoonCount} Catatan</p>
            <p className="text-[11px] text-gray-500 mt-1">Perlu penagihan segera</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setActiveTab('daftar')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'daftar'
                ? 'bg-[#2E7D32] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Buku Utang & Piutang ({unifiedDebts.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('riwayat_pembayaran')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'riwayat_pembayaran'
                ? 'bg-[#2E7D32] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History Pelunasan Kas ({effectivePayments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transaksi_bon')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'transaksi_bon'
                ? 'bg-[#2E7D32] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Bon Transaksi Kasir ({utangSales.length})</span>
          </button>
        </div>

        {/* Add Debt Button */}
        <button
          onClick={() => {
            setFormData({
              type: 'PIUTANG',
              customer_or_supplier_name: '',
              phone_number: '',
              total_amount: 50000,
              due_date: '',
              notes: '',
            });
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Utang / Piutang Baru</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Universal Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, no HP, nota, nominal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:bg-white focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title="Hapus Pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sub-Filters for Tab 1 (Daftar Buku Utang) */}
          {activeTab === 'daftar' && (
            <>
              {/* Type Filter */}
              <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => setFilterType('SEMUA')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterType === 'SEMUA' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilterType('PIUTANG')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterType === 'PIUTANG' ? 'bg-[#2E7D32] text-white shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Piutang Pelanggan
                </button>
                <button
                  onClick={() => setFilterType('UTANG')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterType === 'UTANG' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Utang Supplier
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="UNPAID">Belum Lunas Saja</option>
                <option value="PAID">Sudah Lunas Saja</option>
              </select>
            </>
          )}
        </div>

        {/* Reset / Status Info */}
        <div className="flex items-center gap-2 text-xs text-gray-500 w-full md:w-auto justify-between md:justify-end">
          {searchQuery && (
            <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg font-medium border border-emerald-200">
              Hasil cari: <strong>"{searchQuery}"</strong>
            </span>
          )}
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterType('SEMUA');
              setFilterStatus('SEMUA');
            }}
            className="text-gray-500 hover:text-gray-800 underline text-xs cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BUKU CATATAN UTANG & PIUTANG MASTER */}
      {/* ========================================================================= */}
      {activeTab === 'daftar' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Nama Pihak</th>
                  <th className="px-4 py-3.5">Tipe</th>
                  <th className="px-4 py-3.5 text-right">Total Tagihan</th>
                  <th className="px-4 py-3.5 text-right">Sisa Tagihan</th>
                  <th className="px-4 py-3.5 text-center">Jatuh Tempo</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <BookOpen className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="font-semibold text-gray-600">Tidak ada catatan utang/piutang yang sesuai kriteria.</p>
                        <p className="text-xs text-gray-400">
                          {searchQuery || filterStatus !== 'SEMUA' || filterType !== 'SEMUA'
                            ? 'Coba ubah kata kunci pencarian atau setel filter status ke "Semua Status".'
                            : 'Klik tombol "Catat Utang / Piutang Baru" untuk membuat catatan baru.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDebts.map((item) => {
                    const isPaid = item.status === 'paid' || (Number(item.remaining_amount) || 0) <= 0;
                    const isPiutang = item.type === 'PIUTANG';
                    const isOverdue =
                      !isPaid &&
                      item.due_date &&
                      item.due_date < new Date().toISOString().split('T')[0];

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          <div>
                            <span className="font-bold">{item.customer_or_supplier_name}</span>
                            {item.phone_number && (
                              <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-[#2E7D32]" />
                                {item.phone_number}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-gray-500 italic mt-0.5">Ket: {item.notes}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              isPiutang
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPiutang ? 'Piutang Pelanggan' : 'Utang Supplier'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-gray-700">
                          {formatRupiah(item.total_amount)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold">
                          <span className={isPaid ? 'text-gray-400 line-through' : 'text-rose-600'}>
                            {formatRupiah(item.remaining_amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs">
                          {item.due_date ? (
                            <span
                              className={
                                isOverdue
                                  ? 'font-bold text-rose-600'
                                  : 'text-gray-600'
                              }
                            >
                              {formatDate(item.due_date)}
                              {isOverdue && <span className="block text-[10px] text-rose-600 font-bold">(Lewat)</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : Number(item.remaining_amount) < Number(item.total_amount)
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPaid ? 'LUNAS' : Number(item.remaining_amount) < Number(item.total_amount) ? 'DICICIL' : 'BELUM BAYAR'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid ? (
                              <>
                                <button
                                  onClick={() => {
                                    setPayModalItem(item);
                                    setPaymentInput(item.remaining_amount);
                                  }}
                                  className="px-3 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer"
                                >
                                  Bayar / Cicil
                                </button>
                                {item.phone_number && isPiutang && (
                                  <button
                                    onClick={() => sendWhatsAppReminder(item)}
                                    title="Kirim Pengingat WhatsApp"
                                    className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-50 rounded-lg flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Lunas
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(item.id, item.customer_or_supplier_name)}
                              title="Hapus Catatan"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Tab 1 */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredDebts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Tidak ada catatan utang/piutang yang sesuai kriteria.
              </div>
            ) : (
              filteredDebts.map((item) => {
                const isPaid = item.status === 'paid' || (Number(item.remaining_amount) || 0) <= 0;
                const isPiutang = item.type === 'PIUTANG';

                return (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isPiutang ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isPiutang ? 'Piutang Pelanggan' : 'Utang Supplier'}
                        </span>
                        <h4 className="font-bold text-gray-900 text-base mt-1">
                          {item.customer_or_supplier_name}
                        </h4>
                        {item.phone_number && (
                          <p className="text-xs text-gray-500">{item.phone_number}</p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-400 italic mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl">
                      <div>
                        <span className="text-gray-500 block">Total:</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {formatRupiah(item.total_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Sisa Tagihan:</span>
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {formatRupiah(item.remaining_amount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-gray-500">
                        Jatuh Tempo: <strong>{formatDate(item.due_date)}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {!isPaid && (
                          <button
                            onClick={() => {
                              setPayModalItem(item);
                              setPaymentInput(item.remaining_amount);
                            }}
                            className="px-3 py-1.5 bg-[#2E7D32] text-white font-bold rounded-lg shadow-xs cursor-pointer"
                          >
                            Bayar
                          </button>
                        )}
                        {item.phone_number && isPiutang && (
                          <button
                            onClick={() => sendWhatsAppReminder(item)}
                            className="p-1.5 bg-emerald-50 text-[#2E7D32] rounded-lg cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id, item.customer_or_supplier_name)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTORY / RIWAYAT PELUNASAN KAS MASUK */}
      {/* ========================================================================= */}
      {activeTab === 'riwayat_pembayaran' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <History className="w-4 h-4 text-[#2E7D32]" />
                Riwayat & Bukti Pelunasan Utang Pelanggan
              </h3>
              <p className="text-xs text-gray-500">
                Semua uang tunai dan QRIS yang diserahkan pelanggan saat melunasi utang bon otomatis tercatat di sini.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
              Total Diterima: {formatRupiah(totalPaymentsReceived)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/70 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Waktu Pelunasan</th>
                  <th className="px-4 py-3.5">Nama Pelanggan</th>
                  <th className="px-4 py-3.5">Metode Bayar</th>
                  <th className="px-4 py-3.5 text-right">Nominal Masuk</th>
                  <th className="px-4 py-3.5">Keterangan / Nota</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <History className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="font-semibold text-gray-600">Belum ada riwayat pelunasan utang.</p>
                        <p className="text-xs text-gray-400">
                          Ketika pelanggan membayar bon tagihan via kasir atau menu Buku Utang, riwayat transaksi kas akan langsung muncul di sini.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((pmt) => {
                    const isQris = (pmt.payment_method || '').toUpperCase() === 'QRIS' || (pmt.payment_method || '').toUpperCase() === 'BANK';

                    return (
                      <tr key={pmt.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-gray-600 font-mono whitespace-nowrap">
                          {formatDateTime(pmt.created_at)}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-gray-900">
                          {pmt.customer_name || 'Pelanggan'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              isQris
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isQris ? 'QRIS / Non-Tunai' : 'Tunai / Kas Laci'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-[#1B5E20]">
                          +{formatRupiah(pmt.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                          {pmt.notes || `Pelunasan piutang ${pmt.customer_name}`}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewPaymentReceipt(pmt)}
                              className="px-2.5 py-1 bg-emerald-50 text-[#1B5E20] hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Kuitansi
                            </button>
                            <button
                              onClick={() => handleDeletePayment(pmt.id)}
                              title="Hapus riwayat"
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RIWAYAT TRANSAKSI BON KASIR */}
      {/* ========================================================================= */}
      {activeTab === 'transaksi_bon' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#2E7D32]" />
                Daftar Struk & Transaksi Bon Kasir
              </h3>
              <p className="text-xs text-gray-500">
                Semua transaksi kasir dengan metode pembayaran Bon/Utang dan status pelunasan nota.
              </p>
            </div>
            <span className="text-xs font-bold text-gray-700 bg-gray-200 px-3 py-1 rounded-full">
              {utangSales.length} Nota Kasir
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/70 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">ID Struk</th>
                  <th className="px-4 py-3.5">Waktu Transaksi</th>
                  <th className="px-4 py-3.5">Nama Pelanggan</th>
                  <th className="px-4 py-3.5 text-right">Total Belanja</th>
                  <th className="px-4 py-3.5 text-center">Status Nota</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUtangSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Receipt className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="font-semibold text-gray-600">Tidak ada transaksi kasir berstatus Bon/Utang.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUtangSales.map((sale) => {
                    const isLunas = (sale.status || '').toLowerCase() === 'paid';
                    const custName = (sale.customer_name || (sale.notes ? sale.notes.replace(/^Pelanggan:\s*/i, '').split('•')[0] : '')).trim() || 'Pelanggan';

                    return (
                      <tr key={sale.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-bold text-gray-800">
                          #{sale.id ? sale.id.slice(0, 8).toUpperCase() : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600 font-mono">
                          {formatDateTime(sale.created_at)}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-gray-900">
                          {custName}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900">
                          {formatRupiah(sale.total_amount)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              isLunas
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isLunas ? 'LUNAS' : 'BELUM LUNAS'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {!isLunas ? (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Catat pelunasan nota #${sale.id.slice(0, 8)} sebesar ${formatRupiah(sale.total_amount)}?`)) {
                                  await handlePelunasanUtang(sale.id, Number(sale.total_amount));
                                  await onRefresh();
                                }
                              }}
                              className="px-3 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              Lunaskan
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-700 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terbayar
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CATAT PEMBAYARAN / CICIL UTANG */}
      {/* ========================================================================= */}
      {payModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">Catat Pembayaran Tagihan</h3>
                <p className="text-xs text-gray-500 font-semibold">{payModalItem.customer_or_supplier_name}</p>
              </div>
              <button 
                onClick={() => setPayModalItem(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span>Total Awal:</span>
                <span className="font-mono">{formatRupiah(payModalItem.total_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900">
                <span>Sisa Tagihan Belum Dibayar:</span>
                <span className="font-mono text-rose-600">{formatRupiah(payModalItem.remaining_amount)}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nominal yang Dibayarkan Sekarang (Rp)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={payModalItem.remaining_amount}
                    required
                    value={paymentInput}
                    onChange={(e) => setPaymentInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono text-base font-bold text-[#1B5E20] focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentInput(payModalItem.remaining_amount)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                  >
                    Bayar Lunas
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Metode Penerimaan Uang
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TUNAI')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      paymentMethod === 'TUNAI'
                        ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Uang Tunai (Laci)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      paymentMethod === 'QRIS'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>QRIS / Bank</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalItem(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KUITANSI / BUKTI PELUNASAN */}
      {/* ========================================================================= */}
      {viewPaymentReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-gray-200 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Kuitansi Pelunasan Utang</h3>
                <p className="text-xs text-gray-500 font-mono">ID: {viewPaymentReceipt.id.slice(0, 12)}</p>
              </div>
              <button 
                onClick={() => setViewPaymentReceipt(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Nama Pelanggan:</span>
                <span className="font-bold text-gray-900">{viewPaymentReceipt.customer_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Waktu Bayar:</span>
                <span className="font-mono text-gray-800">{formatDateTime(viewPaymentReceipt.created_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Metode:</span>
                <span className="font-bold text-gray-800">{viewPaymentReceipt.payment_method}</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-50 p-2.5 rounded-xl text-emerald-950 font-bold">
                <span>Jumlah Diterima:</span>
                <span className="font-mono text-base text-[#1B5E20]">{formatRupiah(viewPaymentReceipt.amount)}</span>
              </div>
              {viewPaymentReceipt.notes && (
                <div className="p-2 bg-gray-50 rounded-xl text-[11px] text-gray-600 italic">
                  Catatan: {viewPaymentReceipt.notes}
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kuitansi</span>
              </button>
              <button
                type="button"
                onClick={() => setViewPaymentReceipt(null)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH CATATAN UTANG / PIUTANG BARU */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Catat Utang / Piutang Baru</h3>
                <p className="text-xs text-gray-500">Tambahkan catatan buku kas bon pelanggan atau supplier</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateDebt} className="space-y-3.5">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Jenis Catatan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'PIUTANG' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      formData.type === 'PIUTANG'
                        ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Piutang Pelanggan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'UTANG' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      formData.type === 'UTANG'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Utang Supplier</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nama {formData.type === 'PIUTANG' ? 'Pelanggan' : 'Supplier / Toko'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ibu Rina / Toko Agen Jaya"
                  value={formData.customer_or_supplier_name}
                  onChange={(e) => setFormData({ ...formData, customer_or_supplier_name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nomor WhatsApp / HP (Opsional)
                </label>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none"
                />
              </div>

              {/* Amount & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nominal Tagihan (Rp) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="50000"
                    value={formData.total_amount || ''}
                    onChange={(e) => setFormData({ ...formData, total_amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Jatuh Tempo (Opsional)
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catatan Tambahan / Daftar Barang (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Bon beras 5kg + minyak 2 liter"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
