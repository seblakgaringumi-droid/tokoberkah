import React, { useState } from 'react';
import { SlidersHorizontal, X, CheckCircle2, AlertTriangle, Wallet, ArrowRight, DollarSign } from 'lucide-react';
import { formatRupiah, playBeep } from '../../lib/utils';
import { updateStoreWallet, upsertStoreWallet } from '../../services/api';
import { StoreWallet } from '../../types';

interface OpnameKasModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemCash: number; // calculated total actual physical drawer cash
  initialCash: number;
  wallet: StoreWallet | null;
  onRefresh: () => Promise<void>;
  onWalletUpdated?: (wallet: StoreWallet) => void;
}

export const OpnameKasModal: React.FC<OpnameKasModalProps> = ({
  isOpen,
  onClose,
  systemCash,
  initialCash,
  wallet,
  onRefresh,
  onWalletUpdated,
}) => {
  const [actualCashCounted, setActualCashCounted] = useState<number | string>(systemCash || '');
  const [newInitialCash, setNewInitialCash] = useState<number | string>(initialCash || 500000);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const countedNum = Number(actualCashCounted) || 0;
  const variance = countedNum - systemCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const newInit = Number(newInitialCash) || countedNum || 500000;

      const walletPayload: StoreWallet = {
        id: wallet?.id || 1,
        initial_cash: newInit,
        shopping_budget: wallet?.shopping_budget || 2000000,
        operational_budget: wallet?.operational_budget || 750000,
        owner_budget: wallet?.owner_budget || 1000000,
      };

      await upsertStoreWallet(walletPayload);
      playBeep('success');
      if (onWalletUpdated) onWalletUpdated(walletPayload);
      alert(`Opname kas berhasil disimpan! Modal laci baru di-set menjadi ${formatRupiah(newInit)}.`);
      onClose();
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menyimpan opname kas: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">
                Penyesuaian Uang Fisik / Opname Kas Laci
              </h3>
              <p className="text-xs text-gray-500">
                Sinkronisasi saldo fisik aktual kasir dengan catatan sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Cash Snapshot */}
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-500 block">Saldo Kas di Sistem (Catatan):</span>
            <span className="text-base font-bold font-mono text-gray-900 mt-0.5 block">
              {formatRupiah(systemCash)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 block">Modal Awal Sebelumnya:</span>
            <span className="font-mono text-gray-700 font-semibold">{formatRupiah(initialCash)}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Input Actual Physical Count */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Uang Fisik Aktual di Meja Kasir (Rp) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              required
              placeholder="Hitung uang tunai di laci..."
              value={actualCashCounted}
              onChange={(e) => setActualCashCounted(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 font-mono text-base font-bold text-gray-900 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none"
            />
          </div>

          {/* Variance Indicator */}
          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
            variance === 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : variance > 0
              ? 'bg-blue-50/70 border-blue-200 text-blue-900'
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {variance === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
              ) : variance > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span className="font-semibold">
                {variance === 0
                  ? 'Kas Seimbang (Sesuai Sistem)'
                  : variance > 0
                  ? 'Selisih Lebih (Surplus Kas)'
                  : 'Selisih Kurang (Defisit Kas)'}
              </span>
            </div>
            <span className="font-mono font-bold text-sm">
              {variance > 0 ? `+${formatRupiah(variance)}` : formatRupiah(variance)}
            </span>
          </div>

          {/* Set New Modal Awal */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Set Modal Awal Laci untuk Shift Berikutnya (Rp)
            </label>
            <input
              type="number"
              min="0"
              required
              value={newInitialCash}
              onChange={(e) => setNewInitialCash(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 font-mono text-sm font-semibold text-gray-800 focus:border-[#2E7D32] outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Standar kas kecil Toko Berkah: Rp 500.000 untuk uang kembalian.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">Catatan Opname Kas</label>
            <input
              type="text"
              placeholder="Contoh: Shift sore selesai, uang disetor ke brankas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 rounded-2xl border border-gray-300 text-xs focus:border-[#2E7D32] outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Opname Kas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
