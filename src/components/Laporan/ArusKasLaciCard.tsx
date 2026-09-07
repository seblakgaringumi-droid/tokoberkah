import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  ShoppingBag, 
  SlidersHorizontal, 
  QrCode, 
  Pencil, 
  X, 
  Check, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { formatRupiah, playBeep } from '../../lib/utils';

interface ArusKasLaciCardProps {
  initialCash: number;
  cashSales: number;
  qrisSales: number;
  operationalExpenses: number;
  stockExpenses: number;
  totalActualDrawerCash: number;
  totalKasToko: number;
  onOpenOpnameModal: () => void;
  isManualQris?: boolean;
  onUpdateQrisBalance?: (val: number | null) => void;
}

export const ArusKasLaciCard: React.FC<ArusKasLaciCardProps> = ({
  initialCash,
  cashSales,
  qrisSales,
  operationalExpenses,
  stockExpenses,
  totalActualDrawerCash,
  totalKasToko,
  onOpenOpnameModal,
  isManualQris = false,
  onUpdateQrisBalance,
}) => {
  const [isEditQrisOpen, setIsEditQrisOpen] = useState(false);
  const [tempQrisInput, setTempQrisInput] = useState<string>('');

  const openQrisModal = () => {
    setTempQrisInput(String(qrisSales || ''));
    setIsEditQrisOpen(true);
  };

  const handleSaveQris = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNum = Number(tempQrisInput.replace(/\D/g, ''));
    if (!isNaN(cleanNum) && onUpdateQrisBalance) {
      onUpdateQrisBalance(cleanNum);
      playBeep('success');
    }
    setIsEditQrisOpen(false);
  };

  const handleResetQris = () => {
    if (onUpdateQrisBalance) {
      onUpdateQrisBalance(null); // Reset back to auto
      playBeep('ding');
    }
    setIsEditQrisOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              Ringkasan Kas & Arus Kas Laci
            </h3>
            <p className="text-[11px] text-gray-500">
              Monitoring fisik uang tunai di laci kasir & saldo penerimaan QRIS (Shift / Harian)
            </p>
          </div>
        </div>

        <button
          onClick={onOpenOpnameModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] text-xs font-bold transition-colors border border-emerald-200/80 cursor-pointer self-start sm:self-auto"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Opname Kas Laci</span>
        </button>
      </div>

      {/* Main Total Highlight Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white shadow-xs">
        <div className="flex items-center justify-between text-xs text-emerald-200 mb-1">
          <span className="font-medium">Total Kas Toko (Tunai + QRIS)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold">
            Kasir Shift
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
            {formatRupiah(totalKasToko)}
          </span>
        </div>
        <p className="text-[11px] text-emerald-200/90 mt-1.5">
          Rumus: <span className="text-white font-mono">Modal Awal + Penjualan Tunai + Saldo QRIS - Biaya Operasional - Belanja Stok Laci</span>
        </p>
      </div>

      {/* Breakdown 5 Elements Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 text-xs">
        {/* 1. Modal Awal */}
        <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200/70 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-500 block">1. Modal Awal Laci</span>
            <span className="text-sm sm:text-base font-bold text-gray-900 font-mono mt-0.5 block">
              {formatRupiah(initialCash)}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-2">Saldo awal shift / kas kecil</span>
        </div>

        {/* 2. Penjualan Tunai */}
        <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-800">2. Penjualan Tunai</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-sm sm:text-base font-bold text-[#1B5E20] font-mono mt-0.5 block">
              +{formatRupiah(cashSales)}
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 mt-2">Uang masuk transaksi cash</span>
        </div>

        {/* 3. Saldo QRIS */}
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex flex-col justify-between group relative">
          <div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-semibold text-blue-900 truncate">3. Saldo QRIS</span>
                {isManualQris && (
                  <span className="text-[9px] px-1 py-0.2 bg-blue-200/80 text-blue-900 font-bold rounded">
                    Manual
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={openQrisModal}
                className="p-1 rounded-md text-blue-600 hover:text-blue-900 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Edit / Penyesuaian Saldo QRIS & Settlement"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            <span className="text-sm sm:text-base font-bold text-blue-700 font-mono mt-0.5 block">
              +{formatRupiah(qrisSales)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-blue-700">
              {isManualQris ? 'Penyesuaian manual' : 'Penerimaan QRIS/Bank'}
            </span>
            <button
              type="button"
              onClick={openQrisModal}
              className="text-[9.5px] text-blue-600 hover:underline cursor-pointer font-medium"
            >
              Ubah
            </button>
          </div>
        </div>

        {/* 4. Pengeluaran Operasional */}
        <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-800">4. Biaya Operasional</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <span className="text-sm sm:text-base font-bold text-rose-700 font-mono mt-0.5 block">
              -{formatRupiah(operationalExpenses)}
            </span>
          </div>
          <span className="text-[10px] text-rose-600 mt-2">Listrik, bensin, plastik, dll.</span>
        </div>

        {/* 5. Belanja Stok Laci */}
        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800">5. Belanja Stok Laci</span>
              <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-sm sm:text-base font-bold text-amber-800 font-mono mt-0.5 block">
              -{formatRupiah(stockExpenses)}
            </span>
          </div>
          <span className="text-[10px] text-amber-700 mt-2">Kulakan sembako via kas laci</span>
        </div>
      </div>

      {/* Modal Penyesuaian Saldo QRIS */}
      {isEditQrisOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">Penyesuaian Saldo QRIS / Bank</h3>
                  <p className="text-[11px] text-gray-500">Entry manual atau penyesuaian settlement harian</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditQrisOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleSaveQris} className="p-5 space-y-4">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>Status Saldo Saat Ini:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${isManualQris ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {isManualQris ? 'Manual Override' : 'Otomatis dari Transaksi'}
                  </span>
                </div>
                <p className="text-[11px] text-blue-700">
                  Gunakan fitur ini jika ada penarikan saldo (settlement), biaya MDR, atau penyesuaian nominal rekening.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nominal Saldo QRIS / Bank (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tempQrisInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setTempQrisInput(val ? Number(val).toLocaleString('id-ID') : '');
                    }}
                    placeholder="0"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 font-mono font-bold text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Action Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] text-gray-500 font-medium mr-1">Preset:</span>
                <button
                  type="button"
                  onClick={() => setTempQrisInput('0')}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer"
                >
                  Rp 0 (Setelah Tarik Saldo)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateQrisBalance) onUpdateQrisBalance(null);
                    setIsEditQrisOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hitung Otomatis</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                {isManualQris ? (
                  <button
                    type="button"
                    onClick={handleResetQris}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Otomatis</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditQrisOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Saldo QRIS</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

