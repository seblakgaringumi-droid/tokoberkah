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
  CreditCard
} from 'lucide-react';
import { DebtCredit } from '../../types';
import { formatRupiah, formatDate, playBeep } from '../../lib/utils';
import { createDebtCredit, payDebtCredit, deleteDebtCredit } from '../../services/api';

interface UtangViewProps {
  debts: DebtCredit[];
  onRefresh: () => Promise<void>;
}

export const UtangView: React.FC<UtangViewProps> = ({ debts, onRefresh }) => {
  const [filterType, setFilterType] = useState<'SEMUA' | 'PIUTANG' | 'UTANG'>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | 'UNPAID' | 'PAID'>('UNPAID');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payModalItem, setPayModalItem] = useState<DebtCredit | null>(null);
  const [paymentInput, setPaymentInput] = useState<number | string>('');

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

  // Totals calculations
  const totalPiutang = useMemo(() => {
    return debts
      .filter((d) => d.type === 'PIUTANG' && d.status !== 'paid')
      .reduce((acc, d) => acc + (Number(d.remaining_amount) || 0), 0);
  }, [debts]);

  const totalUtang = useMemo(() => {
    return debts
      .filter((d) => d.type === 'UTANG' && d.status !== 'paid')
      .reduce((acc, d) => acc + (Number(d.remaining_amount) || 0), 0);
  }, [debts]);

  const dueSoonCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return debts.filter(
      (d) => d.status !== 'paid' && d.due_date && d.due_date <= today
    ).length;
  }, [debts]);

  // Filtered debts list
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      // Type match
      if (filterType !== 'SEMUA' && d.type !== filterType) return false;

      // Status match
      if (filterStatus === 'UNPAID' && d.status === 'paid') return false;
      if (filterStatus === 'PAID' && d.status !== 'paid') return false;

      // Query match
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.customer_or_supplier_name.toLowerCase().includes(q) ||
          (d.phone_number && d.phone_number.includes(q)) ||
          (d.notes && d.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [debts, filterType, filterStatus, searchQuery]);

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
      await payDebtCredit(payModalItem.id, amount);
      playBeep('success');
      setPayModalItem(null);
      setPaymentInput('');
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

  // Handle Delete
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Piutang Pelanggan (Receivable) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
              <ArrowDownLeft className="w-4 h-4 text-[#2E7D32]" />
              <span>Piutang Pelanggan (Belum Lunas)</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatRupiah(totalPiutang)}</p>
            <p className="text-[11px] text-gray-500 mt-1">Uang Toko Berkah di luar</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Utang Toko ke Supplier (Payable) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 mb-1">
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
              <span>Utang ke Supplier / Kulakan</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatRupiah(totalUtang)}</p>
            <p className="text-[11px] text-gray-500 mt-1">Kewajiban bayar toko</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Jatuh Tempo Warning */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Jatuh Tempo / Melewati Batas</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-amber-900">{dueSoonCount} Catatan</p>
            <p className="text-[11px] text-gray-500 mt-1">Perlu penagihan segera</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Add Button */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama / nomor HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm rounded-full bg-gray-100 border-none text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
            />
          </div>

          {/* Type Filter */}
          <div className="flex rounded-full bg-gray-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setFilterType('SEMUA')}
              className={`px-3.5 py-1.5 rounded-full transition-colors ${
                filterType === 'SEMUA' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterType('PIUTANG')}
              className={`px-3.5 py-1.5 rounded-full transition-colors ${
                filterType === 'PIUTANG' ? 'bg-[#2E7D32] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Piutang Pelanggan
            </button>
            <button
              onClick={() => setFilterType('UTANG')}
              className={`px-3.5 py-1.5 rounded-full transition-colors ${
                filterType === 'UTANG' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Utang Supplier
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 text-xs rounded-full bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
          >
            <option value="UNPAID">Belum Lunas Saja</option>
            <option value="PAID">Sudah Lunas Saja</option>
            <option value="SEMUA">Semua Status</option>
          </select>
        </div>

        {/* Add Button */}
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
          className="px-5 py-2.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0 w-full sm:w-auto justify-center active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Utang / Piutang Baru</span>
        </button>
      </div>

      {/* Debts Table / Cards */}
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
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    Tidak ada catatan utang/piutang yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                filteredDebts.map((item) => {
                  const isPaid = item.status === 'paid' || item.remaining_amount <= 0;
                  const isPiutang = item.type === 'PIUTANG';
                  const isOverdue =
                    !isPaid &&
                    item.due_date &&
                    item.due_date < new Date().toISOString().split('T')[0];

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <div>
                          <span>{item.customer_or_supplier_name}</span>
                          {item.phone_number && (
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {item.phone_number}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-[11px] text-gray-400 italic mt-0.5">Ket: {item.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
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
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900">
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
                              : item.remaining_amount < item.total_amount
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isPaid ? 'LUNAS' : item.remaining_amount < item.total_amount ? 'SEBAGIAN' : 'BELUM BAYAR'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <>
                              <button
                                onClick={() => {
                                  setPayModalItem(item);
                                  setPaymentInput(item.remaining_amount);
                                }}
                                className="px-2.5 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                              >
                                Bayar / Cicil
                              </button>
                              {item.phone_number && isPiutang && (
                                <button
                                  onClick={() => sendWhatsAppReminder(item)}
                                  title="Kirim Pengingat WhatsApp"
                                  className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(item.id, item.customer_or_supplier_name)}
                            title="Hapus Catatan"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredDebts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Tidak ada catatan utang/piutang.
            </div>
          ) : (
            filteredDebts.map((item) => {
              const isPaid = item.status === 'paid' || item.remaining_amount <= 0;
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
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
                          className="px-3 py-1.5 bg-[#2E7D32] text-white font-bold rounded-lg shadow-xs"
                        >
                          Bayar
                        </button>
                      )}
                      {item.phone_number && isPiutang && (
                        <button
                          onClick={() => sendWhatsAppReminder(item)}
                          className="p-1.5 bg-emerald-50 text-[#2E7D32] rounded-lg"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id, item.customer_or_supplier_name)}
                        className="p-1.5 text-gray-400 hover:text-rose-600"
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

      {/* Record Payment / Cicil Modal */}
      {payModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">Catat Pembayaran Tagihan</h3>
                <p className="text-xs text-gray-500">{payModalItem.customer_or_supplier_name}</p>
              </div>
              <button onClick={() => setPayModalItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span>Total Awal:</span>
                <span className="font-mono">{formatRupiah(payModalItem.total_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900">
                <span>Sisa Belum Dibayar:</span>
                <span className="font-mono text-rose-600">{formatRupiah(payModalItem.remaining_amount)}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nominal yang Dibayarkan Sekarang
                </label>
                <input
                  type="number"
                  min="1"
                  max={payModalItem.remaining_amount}
                  required
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono text-base font-bold text-[#1B5E20] focus:border-[#2E7D32] outline-none"
                />
              </div>

              {/* Quick shortcut to pay full */}
              <button
                type="button"
                onClick={() => setPaymentInput(payModalItem.remaining_amount)}
                className="w-full py-1.5 text-xs text-[#2E7D32] font-semibold bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                Bayar Lunas Langsung ({formatRupiah(payModalItem.remaining_amount)})
              </button>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#2E7D32] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Catat Utang / Piutang Baru</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Type selector */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Jenis Catatan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'PIUTANG' })}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formData.type === 'PIUTANG'
                        ? 'border-[#2E7D32] bg-emerald-50 text-[#1B5E20]'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    Piutang Pelanggan (Bon)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'UTANG' })}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formData.type === 'UTANG'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    Utang ke Supplier
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Nama Pelanggan / Supplier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Joko / Distributor Beras Maju"
                  value={formData.customer_or_supplier_name}
                  onChange={(e) => setFormData({ ...formData, customer_or_supplier_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Jatuh Tempo Pembayaran
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Total Nominal Tagihan (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono font-bold text-gray-900 focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Catatan / Keterangan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan barang atau perjanjian pembayaran..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none resize-none"
                />
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 -mx-5 -mb-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold transition-all shadow-sm"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
