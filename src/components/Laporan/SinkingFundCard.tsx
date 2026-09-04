import React from 'react';
import { ShieldCheck, AlertCircle, Building2, Landmark, CheckCircle2, AlertTriangle, Coins } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';

interface SinkingFundCardProps {
  totalActualDrawerCash: number;
  netCashFlow: number; // Cash Sales - Operational Expenses - Stock Expenses
  dailyRentTarget?: number; // default 22000
  dailyBankTarget?: number; // default 173400
}

export const SinkingFundCard: React.FC<SinkingFundCardProps> = ({
  totalActualDrawerCash,
  netCashFlow,
  dailyRentTarget = 22000,
  dailyBankTarget = 173400,
}) => {
  const totalDailyObligations = dailyRentTarget + dailyBankTarget; // 195.400
  const netAvailableCash = totalActualDrawerCash - totalDailyObligations;
  const isObligationFulfilled = netCashFlow >= totalDailyObligations;
  const deficitAmount = Math.max(0, totalDailyObligations - netCashFlow);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              Alokasi Kewajiban & Reservasi Dana (Sinking Fund)
            </h3>
            <p className="text-[11px] text-gray-500">
              Penyisihan harian wajib untuk sewa tempat & angsuran modal
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isObligationFulfilled ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#1B5E20] border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Kewajiban Harian Terpenuhi (Aman)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Belum Memenuhi Target Kewajiban Harian (-{formatRupiah(deficitAmount)})</span>
            </div>
          )}
        </div>
      </div>

      {/* 2 Targets Breakdown + Net Ready Cash */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Sewa Toko */}
        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-900 mb-1">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Sewa Toko Harian
            </span>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-blue-950 font-mono block">
              {formatRupiah(dailyRentTarget)}
              <span className="text-xs font-normal text-blue-700"> / hari</span>
            </span>
            <p className="text-[10px] text-blue-600 mt-0.5">Target: Rp 8.000.000 / tahun</p>
          </div>
        </div>

        {/* Angsuran Bank */}
        <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-900 mb-1">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-indigo-600" />
              Angsuran Bank Harian
            </span>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-indigo-950 font-mono block">
              {formatRupiah(dailyBankTarget)}
              <span className="text-xs font-normal text-indigo-700"> / hari</span>
            </span>
            <p className="text-[10px] text-indigo-600 mt-0.5">Target: Rp 5.200.000 / bulan</p>
          </div>
        </div>

        {/* Total Kewajiban */}
        <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-900 mb-1">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              Total Kewajiban Harian
            </span>
          </div>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-purple-950 font-mono block">
              {formatRupiah(totalDailyObligations)}
              <span className="text-xs font-normal text-purple-700"> / hari</span>
            </span>
            <p className="text-[10px] text-purple-600 mt-0.5">Sewa Toko + Angsuran Bank</p>
          </div>
        </div>
      </div>

      {/* Saldo Kas Siap Pakai Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        netAvailableCash >= 0 
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-rose-50/70 border-rose-200 text-rose-950'
      }`}>
        <div>
          <span className="text-xs font-semibold block text-gray-700">
            SALDO KAS SIAP PAKAI (NET):
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-xl sm:text-2xl font-black font-mono ${
              netAvailableCash >= 0 ? 'text-[#1B5E20]' : 'text-rose-700'
            }`}>
              {formatRupiah(netAvailableCash)}
            </span>
          </div>
          <span className="text-[11px] text-gray-500">
            Total Uang Fisik Laci ({formatRupiah(totalActualDrawerCash)}) dikurangi Kewajiban Sinking Fund ({formatRupiah(totalDailyObligations)})
          </span>
        </div>

        <div className="text-left sm:text-right text-xs">
          <span className="text-gray-500 block">Arus Kas Bersih Periode Ini:</span>
          <span className={`font-mono font-bold text-sm ${netCashFlow >= totalDailyObligations ? 'text-[#2E7D32]' : 'text-amber-700'}`}>
            {formatRupiah(netCashFlow)}
          </span>
        </div>
      </div>
    </div>
  );
};
