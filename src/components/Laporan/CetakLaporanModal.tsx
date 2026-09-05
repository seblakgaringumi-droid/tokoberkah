import React from 'react';
import { Printer, X, Download, Store, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatRupiah, formatDateTime, formatDate } from '../../lib/utils';
import { Sale, Expense, StoreWallet, StoreProfile } from '../../types';

interface CetakLaporanModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodLabel: string;
  totalRevenue: number;
  totalGrossProfit: number;
  totalExpenseAmount: number;
  netProfit: number;
  initialCash: number;
  cashSales: number;
  operationalExpenses: number;
  stockExpenses: number;
  totalActualDrawerCash: number;
  dailyRentTarget: number;
  dailyBankTarget: number;
  totalDailyObligations: number;
  netAvailableCash: number;
  salesCount: number;
  expensesCount: number;
  storeProfile?: StoreProfile;
}

export const CetakLaporanModal: React.FC<CetakLaporanModalProps> = ({
  isOpen,
  onClose,
  periodLabel,
  totalRevenue,
  totalGrossProfit,
  totalExpenseAmount,
  netProfit,
  initialCash,
  cashSales,
  operationalExpenses,
  stockExpenses,
  totalActualDrawerCash,
  dailyRentTarget,
  dailyBankTarget,
  totalDailyObligations,
  netAvailableCash,
  salesCount,
  expensesCount,
  storeProfile,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeName = storeProfile?.store_name || 'TOKO BERKAH';
  const tagline = storeProfile?.tagline || 'Penyedia Kebutuhan Pokok, Sembako & Sayuran Segar Berkualitas';

  const START_DATE = new Date('2026-08-19T00:00:00');
  const now = new Date();
  const diffTime = now.getTime() - START_DATE.getTime();
  const totalDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-4 print:hidden">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Pratinjau Cetak Laporan Keuangan</h3>
            <p className="text-xs text-gray-500">Format cetak resmi {storeName} POS</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="printable-report border border-gray-200 rounded-2xl p-6 sm:p-8 bg-white space-y-6 text-gray-900 text-xs">
          {/* Header Toko */}
          <div className="text-center border-b-2 border-gray-800 pb-4 space-y-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-wide text-gray-900 uppercase">
              {storeName}
            </h2>
            <p className="text-xs text-gray-600 font-medium">
              {tagline}
            </p>
            {storeProfile?.address && (
              <p className="text-[11px] text-gray-500">
                {storeProfile.address} {storeProfile.phone ? `• WA: ${storeProfile.phone}` : ''}
              </p>
            )}
            <div className="text-[11px] text-gray-500 flex justify-center gap-4 pt-1 font-mono">
              <span>Periode Laporan: <strong>{periodLabel}</strong></span>
              <span>•</span>
              <span>Dicetak: {formatDateTime(new Date().toISOString())}</span>
            </div>
          </div>

          {/* 1. Ringkasan Arus Kas Laci */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              1. Ringkasan Kas & Arus Kas Laci (Kasir Shift)
            </h4>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                <tr className="py-1">
                  <td className="py-1.5 text-gray-600">Modal Awal Laci Kasir:</td>
                  <td className="py-1.5 text-right font-mono font-semibold">{formatRupiah(initialCash)}</td>
                </tr>
                <tr className="py-1">
                  <td className="py-1.5 text-emerald-800 font-medium">(+) Penjualan Tunai ({salesCount} Transaksi):</td>
                  <td className="py-1.5 text-right font-mono font-bold text-[#1B5E20]">+{formatRupiah(cashSales)}</td>
                </tr>
                <tr className="py-1">
                  <td className="py-1.5 text-rose-800 font-medium">(-) Pengeluaran Operasional Harian:</td>
                  <td className="py-1.5 text-right font-mono font-bold text-rose-600">-{formatRupiah(operationalExpenses)}</td>
                </tr>
                <tr className="py-1">
                  <td className="py-1.5 text-amber-800 font-medium">(-) Belanja Stok dari Kas Laci:</td>
                  <td className="py-1.5 text-right font-mono font-bold text-amber-700">-{formatRupiah(stockExpenses)}</td>
                </tr>
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                  <td className="py-2 text-gray-900">TOTAL UANG FISIK AKTUAL LACI:</td>
                  <td className="py-2 text-right font-mono text-sm text-[#1B5E20]">{formatRupiah(totalActualDrawerCash)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. Alokasi Kewajiban Harian & Sinking Fund */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              2. Alokasi Kewajiban Harian & Reservasi Dana (Sinking Fund)
            </h4>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-1.5 text-gray-600">Alokasi Sewa Toko Harian (Target Rp 8 Jt/thn):</td>
                  <td className="py-1.5 text-right font-mono font-semibold">{formatRupiah(dailyRentTarget)} / hari</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-gray-600">Alokasi Angsuran Bank Harian (Target Rp 5.2 Jt/bln):</td>
                  <td className="py-1.5 text-right font-mono font-semibold">{formatRupiah(dailyBankTarget)} / hari</td>
                </tr>
                <tr className="font-bold text-purple-900">
                  <td className="py-1.5">Total Kewajiban Harian Wajib Disisihkan:</td>
                  <td className="py-1.5 text-right font-mono text-purple-950">{formatRupiah(totalDailyObligations)} / hari</td>
                </tr>
                <tr className="bg-emerald-50/80 font-bold border-t border-emerald-200 text-emerald-950">
                  <td className="py-2">SALDO KAS SIAP PAKAI (NET):</td>
                  <td className="py-2 text-right font-mono text-sm text-[#1B5E20]">{formatRupiah(netAvailableCash)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Ringkasan Performa Finansial */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              3. Performa Penjualan & Laba Bersih
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-500 block">Total Omzet</span>
                <span className="font-mono font-bold text-sm text-gray-900">{formatRupiah(totalRevenue)}</span>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-[10px] text-blue-700 block">Laba Kotor</span>
                <span className="font-mono font-bold text-sm text-blue-900">{formatRupiah(totalGrossProfit)}</span>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                <span className="text-[10px] text-rose-700 block">Biaya Operasional</span>
                <span className="font-mono font-bold text-sm text-rose-900">{formatRupiah(operationalExpenses)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-800 block">Laba Bersih</span>
                <span className="font-mono font-bold text-sm text-[#1B5E20]">{formatRupiah(netProfit)}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic text-center">
              *Rumus Laba Bersih = Laba Kotor - Biaya Operasional ({formatRupiah(operationalExpenses)}). Belanja Stok ({formatRupiah(stockExpenses)}) adalah konversi aset kas menjadi stok barang, tidak memotong laba bersih.
            </p>
          </div>

          {/* 4. Target Cadangan Akumulasi Toko */}
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-950 flex justify-between items-center">
            <div>
              <span className="font-bold block">Ideal Saldo Cadangan (All-Time {totalDays} Hari):</span>
              <span className="text-[10px] text-amber-800">Sejak mulai operasional: 19 Agustus 2026</span>
            </div>
            <span className="font-mono font-bold text-base text-amber-950">
              {formatRupiah(totalDays * 195400)}
            </span>
          </div>

          {/* Tanda Tangan */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <p className="text-gray-500 mb-12">Petugas Kasir Shift,</p>
              <p className="font-bold text-gray-900 border-t border-gray-400 pt-1 inline-block min-w-32">
                ( Kasir Toko )
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-12">Penanggung Jawab / Pemilik,</p>
              <p className="font-bold text-gray-900 border-t border-gray-400 pt-1 inline-block min-w-32">
                ( Pemilik Toko Berkah )
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
