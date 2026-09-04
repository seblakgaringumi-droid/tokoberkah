import React from 'react';
import { Wallet, ArrowDownRight, ArrowUpRight, ShoppingBag, SlidersHorizontal, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';

interface ArusKasLaciCardProps {
  initialCash: number;
  cashSales: number;
  operationalExpenses: number;
  stockExpenses: number;
  totalActualDrawerCash: number;
  onOpenOpnameModal: () => void;
}

export const ArusKasLaciCard: React.FC<ArusKasLaciCardProps> = ({
  initialCash,
  cashSales,
  operationalExpenses,
  stockExpenses,
  totalActualDrawerCash,
  onOpenOpnameModal,
}) => {
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
              Monitoring fisik uang tunai di laci kasir (Shift / Harian)
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

      {/* Main Total Highlight */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white shadow-xs">
        <div className="flex items-center justify-between text-xs text-emerald-200 mb-1">
          <span className="font-medium">Total Uang Fisik Aktual Laci</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold">
            Kasir Shift
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
            {formatRupiah(totalActualDrawerCash)}
          </span>
        </div>
        <p className="text-[11px] text-emerald-200/90 mt-1.5">
          Rumus: <span className="text-white font-mono">Modal Awal + Penjualan Tunai - Biaya Operasional - Belanja Stok Laci</span>
        </p>
      </div>

      {/* Breakdown 4 Elements */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
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

        {/* 3. Pengeluaran Operasional */}
        <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-800">3. Biaya Operasional</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <span className="text-sm sm:text-base font-bold text-rose-700 font-mono mt-0.5 block">
              -{formatRupiah(operationalExpenses)}
            </span>
          </div>
          <span className="text-[10px] text-rose-600 mt-2">Listrik, bensin, plastik, dll.</span>
        </div>

        {/* 4. Belanja Stok Laci */}
        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800">4. Belanja Stok Laci</span>
              <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-sm sm:text-base font-bold text-amber-800 font-mono mt-0.5 block">
              -{formatRupiah(stockExpenses)}
            </span>
          </div>
          <span className="text-[10px] text-amber-700 mt-2">Kulakan sembako via kas laci</span>
        </div>
      </div>
    </div>
  );
};
