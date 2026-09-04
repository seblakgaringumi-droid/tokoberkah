import React from 'react';
import { PiggyBank, Calendar, Building2, Landmark, Target, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';

interface CadanganAkumulasiCardProps {
  currentCash?: number;
}

export const CadanganAkumulasiCard: React.FC<CadanganAkumulasiCardProps> = ({
  currentCash = 0,
}) => {
  // Config: Operasional start date 19 Agustus 2026
  const START_DATE = new Date('2026-08-19T00:00:00');
  const now = new Date();
  
  // Calculate total running days since Aug 19, 2026 (inclusive)
  const diffTime = now.getTime() - START_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const totalDays = Math.max(1, diffDays + 1);

  const DAILY_RENT = 22000;
  const DAILY_BANK = 173400;
  const DAILY_TOTAL = DAILY_RENT + DAILY_BANK; // 195.400

  const totalAccumulatedRent = totalDays * DAILY_RENT;
  const totalAccumulatedBank = totalDays * DAILY_BANK;
  const totalIdealReserve = totalDays * DAILY_TOTAL;

  const coverageRatio = totalIdealReserve > 0 ? Math.min(100, Math.round((currentCash / totalIdealReserve) * 100)) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              Estimasi Reservasi Dana Akumulasi (All-Time Target Berjalan)
            </h3>
            <p className="text-[11px] text-gray-500">
              Kalkulasi ideal cadangan sejak awal operasional toko
            </p>
          </div>
        </div>

        {/* Running Days Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-800 text-xs font-semibold self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span>Mulai: <strong>19 Agu 2026</strong> ({totalDays} Hari Berjalan)</span>
        </div>
      </div>

      {/* Main Ideal Reserve Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-yellow-900 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider block">
              IDEAL SALDO CADANGAN (Sinking Fund Akumulasi)
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight mt-1 block">
              {formatRupiah(totalIdealReserve)}
            </span>
            <p className="text-[11px] text-amber-200/90 mt-1">
              Target akumulasi gabungan untuk {totalDays} hari operasional (@{formatRupiah(DAILY_TOTAL)} / hari)
            </p>
          </div>

          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs text-xs space-y-1 self-start sm:self-auto shrink-0 border border-white/15">
            <div className="text-amber-100 font-medium">Kecukupan Saldo Kas Saat Ini:</div>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-black/30 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-300 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, coverageRatio)}%` }}
                />
              </div>
              <span className="font-mono font-bold text-white">{coverageRatio}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-breakdown: Sewa Toko vs Angsuran Bank */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Sewa Toko Akumulasi */}
        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100/90 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-blue-900 font-semibold mb-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Target Sewa Toko Akumulasi</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-blue-950 font-mono block">
              {formatRupiah(totalAccumulatedRent)}
            </span>
            <span className="text-[10px] text-blue-600 mt-0.5 block">
              {totalDays} hari x {formatRupiah(DAILY_RENT)} (Target Rp 8 Jt/thn)
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 font-bold">
            SEWA
          </span>
        </div>

        {/* Angsuran Bank Akumulasi */}
        <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/90 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-indigo-900 font-semibold mb-1">
              <Landmark className="w-3.5 h-3.5 text-indigo-600" />
              <span>Target Angsuran Bank Akumulasi</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-indigo-950 font-mono block">
              {formatRupiah(totalAccumulatedBank)}
            </span>
            <span className="text-[10px] text-indigo-600 mt-0.5 block">
              {totalDays} hari x {formatRupiah(DAILY_BANK)} (Target Rp 5.2 Jt/bln)
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 font-bold">
            BANK
          </span>
        </div>
      </div>
    </div>
  );
};
