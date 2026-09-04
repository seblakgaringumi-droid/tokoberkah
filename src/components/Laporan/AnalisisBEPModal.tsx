import React from 'react';
import { Target, X, TrendingUp, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, Building2, Landmark, Zap } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';

interface AnalisisBEPModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayRevenue: number;
  averageMarginPct: number; // e.g. 18.5 (%)
  averageDailyExpense: number; // e.g. 35000
}

export const AnalisisBEPModal: React.FC<AnalisisBEPModalProps> = ({
  isOpen,
  onClose,
  todayRevenue,
  averageMarginPct = 18,
  averageDailyExpense = 25000,
}) => {
  if (!isOpen) return null;

  const DAILY_RENT = 22000;
  const DAILY_BANK = 173400;
  const SINKING_FUND = DAILY_RENT + DAILY_BANK; // 195.400

  const totalDailyFixedCosts = SINKING_FUND + averageDailyExpense; // e.g. ~220.400
  const marginRatio = Math.max(0.05, (averageMarginPct || 18) / 100);

  // BEP Minimal Omzet = Total Fixed Costs / Margin Ratio
  const bepMinimalOmzet = Math.round(totalDailyFixedCosts / marginRatio);

  // Optimal Target (BEP + Profit Pemilik Rp 150.000 / hari)
  const TARGET_PROFIT_DAILY = 150000;
  const optimalTargetOmzet = Math.round((totalDailyFixedCosts + TARGET_PROFIT_DAILY) / marginRatio);

  const achievementPct = bepMinimalOmzet > 0 ? Math.round((todayRevenue / bepMinimalOmzet) * 100) : 0;
  const isBepReached = todayRevenue >= bepMinimalOmzet;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">
                Analisis BEP & Target Harian
              </h3>
              <p className="text-xs text-gray-500">
                Data-driven Break-Even Point kalkulasi Toko Berkah
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

        {/* Status Highlight Banner */}
        <div className={`p-4 rounded-2xl border ${
          isBepReached 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {isBepReached ? '✓ Target BEP Harian Terpenuhi' : '⚠ Belum Mencapai Titik Impas'}
            </span>
            <span className="font-mono font-black text-sm">{achievementPct}% Tercapai</span>
          </div>

          <div className="w-full bg-black/10 h-2.5 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isBepReached ? 'bg-[#2E7D32]' : 'bg-amber-600'
              }`}
              style={{ width: `${Math.min(100, achievementPct)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs">
            <span>Omzet Hari Ini: <strong>{formatRupiah(todayRevenue)}</strong></span>
            <span>Target BEP: <strong>{formatRupiah(bepMinimalOmzet)}</strong></span>
          </div>
        </div>

        {/* 2 Main Targets: BEP Minimal vs Pertumbuhan Optimal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* BEP Minimal */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
              <span>BEP Minimal Harian</span>
            </div>
            <p className="text-xl font-black font-mono text-gray-900">
              {formatRupiah(bepMinimalOmzet)}
            </p>
            <p className="text-[11px] text-gray-500">
              Batas aman untuk menutup sewa, bank, dan biaya harian tanpa rugi.
            </p>
          </div>

          {/* Optimal Target */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
              <span>Target Pertumbuhan (Optimal)</span>
            </div>
            <p className="text-xl font-black font-mono text-[#1B5E20]">
              {formatRupiah(optimalTargetOmzet)}
            </p>
            <p className="text-[11px] text-emerald-700">
              Target omzet ideal untuk akumulasi laba bersih pemilik (+{formatRupiah(TARGET_PROFIT_DAILY)}/hari).
            </p>
          </div>
        </div>

        {/* Cost Structure Breakdown */}
        <div className="space-y-2.5 text-xs">
          <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Struktur Beban Tetap & Margin Toko</span>
          </h4>

          <div className="bg-gray-50 rounded-2xl p-3.5 divide-y divide-gray-200/60 border border-gray-200/60 space-y-2">
            <div className="flex justify-between items-center pt-1 first:pt-0">
              <span className="text-gray-600 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Alokasi Sewa Toko:
              </span>
              <span className="font-mono font-semibold text-gray-900">{formatRupiah(DAILY_RENT)} / hari</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-600 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                Alokasi Angsuran Bank:
              </span>
              <span className="font-mono font-semibold text-gray-900">{formatRupiah(DAILY_BANK)} / hari</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-600">Estimasi Biaya Operasional Toko:</span>
              <span className="font-mono font-semibold text-gray-900">{formatRupiah(averageDailyExpense)} / hari</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-600">Rata-rata Margin Laba Kotor Toko:</span>
              <span className="font-mono font-bold text-emerald-700">~{averageMarginPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
        >
          Tutup Analisis
        </button>
      </div>
    </div>
  );
};
