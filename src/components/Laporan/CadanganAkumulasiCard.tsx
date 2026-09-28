import React from 'react';
import { PiggyBank, Calendar, Building2, Landmark, Clock, AlertCircle } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';

interface CadanganAkumulasiCardProps {
  currentCash?: number;
}

/**
 * Menghitung detail siklus 30 hari angsuran bank (tanggal 11 s.d. tanggal 10 bulan berikutnya)
 * Jatuh tempo pembayaran ke bank adalah setiap tanggal 10.
 */
export function getBankInstallmentCycle(currentDate: Date = new Date()) {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth(); // 0-indexed: 0 = Jan, 8 = Sep, 9 = Oct
  const d = currentDate.getDate();

  let cycleStartDate: Date;
  let cycleDueDate: Date;

  if (d >= 11) {
    // Siklus dimulai tgl 11 bulan berjalan s.d. 10 bulan berikutnya
    cycleStartDate = new Date(y, m, 11, 0, 0, 0, 0);
    cycleDueDate = new Date(y, m + 1, 10, 23, 59, 59, 999);
  } else {
    // Siklus dimulai tgl 11 bulan sebelumnya s.d. 10 bulan berjalan
    cycleStartDate = new Date(y, m - 1, 11, 0, 0, 0, 0);
    cycleDueDate = new Date(y, m, 10, 23, 59, 59, 999);
  }

  // Hitung selisih hari berjalan dari tgl 11 sampai hari ini (inklusif)
  const startMidnight = new Date(cycleStartDate.getFullYear(), cycleStartDate.getMonth(), cycleStartDate.getDate()).getTime();
  const nowMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
  
  const diffDays = Math.floor((nowMidnight - startMidnight) / (1000 * 60 * 60 * 24));
  const currentDayInCycle = Math.max(1, Math.min(30, diffDays + 1));
  const daysRemaining = Math.max(0, 30 - currentDayInCycle);

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  const periodLabel = `11 ${MONTH_NAMES[cycleStartDate.getMonth()]} - 10 ${MONTH_NAMES[cycleDueDate.getMonth()]} ${cycleDueDate.getFullYear()}`;
  const dueDateLabel = `10 ${MONTH_NAMES[cycleDueDate.getMonth()]} ${cycleDueDate.getFullYear()}`;

  return {
    cycleStartDate,
    cycleDueDate,
    currentDayInCycle,
    daysRemaining,
    periodLabel,
    dueDateLabel,
  };
}

export const CadanganAkumulasiCard: React.FC<CadanganAkumulasiCardProps> = ({
  currentCash = 0,
}) => {
  // Config: Operasional start date 19 Agustus 2026
  const START_DATE = new Date('2026-08-19T00:00:00');
  const now = new Date();
  
  // 1. Sewa Toko: Akumulasi hari sejak awal buka toko (19 Agu 2026)
  const diffTime = now.getTime() - START_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const totalDays = Math.max(1, diffDays + 1);

  const DAILY_RENT = 22000;
  const totalAccumulatedRent = totalDays * DAILY_RENT;

  // 2. Angsuran Bank: Siklus 30 hari (11 s.d. 10 bulan berikutnya, Jatuh Tempo tgl 10)
  const DAILY_BANK = 173400; // Rp 5.200.000 / 30 hari
  const bankCycle = getBankInstallmentCycle(now);
  const totalAccumulatedBank = bankCycle.currentDayInCycle * DAILY_BANK;

  // Total Ideal Cadangan Saldo Gabungan (Sewa All-Time + Angsuran Bank Siklus Berjalan)
  const totalIdealReserve = totalAccumulatedRent + totalAccumulatedBank;
  const coverageRatio = totalIdealReserve > 0 ? Math.min(100, Math.round((currentCash / totalIdealReserve) * 100)) : 0;
  const bankCycleProgress = Math.min(100, Math.round((bankCycle.currentDayInCycle / 30) * 100));

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
              Estimasi Reservasi Dana Akumulasi (Target Berjalan)
            </h3>
            <p className="text-[11px] text-gray-500">
              Sewa Toko (Tahunan All-Time) & Angsuran Bank (Siklus 30 Hari: Tgl 11 - 10)
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 text-gray-800 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>Mulai: <strong>19 Agu 2026</strong> ({totalDays} Hari)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 text-xs font-semibold border border-indigo-100">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Siklus Bank: <strong>Hari ke-{bankCycle.currentDayInCycle}/30</strong></span>
          </div>
        </div>
      </div>

      {/* Main Ideal Reserve Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-yellow-900 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider block">
              IDEAL SALDO CADANGAN (Sinking Fund Akumulasi Saat Ini)
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight mt-1 block">
              {formatRupiah(totalIdealReserve)}
            </span>
            <p className="text-[11px] text-amber-200/90 mt-1">
              Gabungan Sewa ({totalDays} hari: {formatRupiah(totalAccumulatedRent)}) + Angsuran Bank (Hari ke-{bankCycle.currentDayInCycle}/30: {formatRupiah(totalAccumulatedBank)})
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
            <div className="text-[10px] text-amber-200/80">
              Kas Aktual: {formatRupiah(currentCash)}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-breakdown: Sewa Toko vs Angsuran Bank */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Sewa Toko Akumulasi */}
        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-blue-900 font-semibold">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Sewa Toko Akumulasi</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 font-bold">
                TAHUNAN
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-blue-950 font-mono block">
              {formatRupiah(totalAccumulatedRent)}
            </span>
            <span className="text-[10px] text-blue-600 mt-1 block">
              {totalDays} hari x {formatRupiah(DAILY_RENT)} (Target Rp 8.000.000 / tahun)
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-blue-100/80 text-[10px] text-blue-800">
            Cadangan berjalan sejak awal buka: <strong>19 Agu 2026</strong>
          </div>
        </div>

        {/* Angsuran Bank Akumulasi (Siklus 30 Hari: 11 s.d. 10) */}
        <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                <span>Target Angsuran Bank (Per 30 Hari)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 font-bold">
                SIKLUS 11 - 10
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base sm:text-lg font-bold text-indigo-950 font-mono block">
                {formatRupiah(totalAccumulatedBank)}
              </span>
              <span className="text-[11px] font-mono text-indigo-700 font-bold">
                Target: {formatRupiah(5200000)}
              </span>
            </div>
            <span className="text-[10px] text-indigo-600 mt-1 block">
              Hari ke-{bankCycle.currentDayInCycle} dari 30 hari x {formatRupiah(DAILY_BANK)} / hari
            </span>

            {/* Cycle progress bar */}
            <div className="mt-2">
              <div className="flex justify-between items-center text-[10px] text-indigo-700 font-medium mb-0.5">
                <span>Periode: {bankCycle.periodLabel}</span>
                <span>{bankCycleProgress}%</span>
              </div>
              <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${bankCycleProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-indigo-100/80 flex items-center justify-between text-[10px] text-indigo-900 font-medium">
            <span>Jatuh Tempo: <strong>{bankCycle.dueDateLabel}</strong></span>
            <span className="text-indigo-600">{bankCycle.daysRemaining === 0 ? 'Hari Ini Jatuh Tempo!' : `Sisa ${bankCycle.daysRemaining} hari lagi`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
