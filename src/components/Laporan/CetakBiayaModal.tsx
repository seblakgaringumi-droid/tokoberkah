import React from 'react';
import { Printer, X, ShoppingBag, Receipt, Landmark, Wallet, Calendar, FileText } from 'lucide-react';
import { formatRupiah, formatDateTime, formatDate, isStockExpense } from '../../lib/utils';
import { Expense, StoreProfile } from '../../types';

interface CetakBiayaModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodLabel: string;
  expenses: Expense[];
  totalExpenseAmount: number;
  totalOperationalExpenses: number;
  totalStockExpenses: number;
  drawerOperationalExpenses: number;
  drawerStockExpenses: number;
  kasBesarExpenses: number;
  storeProfile?: StoreProfile;
  sourceFilter?: string;
}

export const CetakBiayaModal: React.FC<CetakBiayaModalProps> = ({
  isOpen,
  onClose,
  periodLabel,
  expenses,
  totalExpenseAmount,
  totalOperationalExpenses,
  totalStockExpenses,
  drawerOperationalExpenses,
  drawerStockExpenses,
  kasBesarExpenses,
  storeProfile,
  sourceFilter = 'semua',
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeName = storeProfile?.store_name || 'TOKO BERKAH';
  const tagline = storeProfile?.tagline || 'Penyedia Kebutuhan Pokok, Sembako & Sayuran Segar Berkualitas';

  const sourceLabel = sourceFilter === 'LACI' 
    ? 'Hanya Kasir Laci' 
    : sourceFilter === 'KAS_BESAR' 
    ? 'Hanya Kas Besar / Cadangan' 
    : 'Semua Sumber Dana (Laci & Kas Besar)';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-4 print:hidden">
          <div>
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2E7D32]" />
              Pratinjau Cetak Laporan Biaya & Pengeluaran
            </h3>
            <p className="text-xs text-gray-500">Format cetak PDF resmi pengeluaran operasional dan kulakan {storeName}</p>
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
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
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
            <div className="pt-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 bg-gray-100 py-1 px-4 rounded-lg inline-block">
                LAPORAN BIAYA & PENGELUARAN TOKO
              </h3>
            </div>
            <div className="text-[11px] text-gray-500 flex justify-center gap-4 pt-1 font-mono">
              <span>Periode: <strong>{periodLabel}</strong></span>
              <span>•</span>
              <span>Filter: <strong>{sourceLabel}</strong></span>
              <span>•</span>
              <span>Dicetak: {formatDateTime(new Date().toISOString())}</span>
            </div>
          </div>

          {/* 1. Ringkasan Rekapitulasi Biaya & Pengeluaran */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              1. Rekapitulasi Total Biaya & Pengeluaran
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] text-rose-700 block font-semibold">Biaya Operasional (Beban)</span>
                <span className="font-mono font-bold text-sm text-rose-950">{formatRupiah(totalOperationalExpenses)}</span>
                <span className="text-[9px] text-rose-600 block mt-0.5">Memotong Laba Bersih</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] text-amber-800 block font-semibold">Belanja Stok (Kulakan/Aset)</span>
                <span className="font-mono font-bold text-sm text-amber-950">{formatRupiah(totalStockExpenses)}</span>
                <span className="text-[9px] text-amber-700 block mt-0.5">Aset Persediaan Toko</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-800 block font-semibold">Keluar Dari Kas Laci</span>
                <span className="font-mono font-bold text-sm text-[#1B5E20]">{formatRupiah(drawerOperationalExpenses + drawerStockExpenses)}</span>
                <span className="text-[9px] text-emerald-700 block mt-0.5">Pengurang Kas Kasir</span>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] text-blue-800 block font-semibold">Dari Kas Besar / Cadangan</span>
                <span className="font-mono font-bold text-sm text-blue-950">{formatRupiah(kasBesarExpenses)}</span>
                <span className="text-[9px] text-blue-700 block mt-0.5">Tidak Potong Kasir</span>
              </div>
            </div>

            <div className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl flex items-center justify-between text-xs font-bold text-gray-900 mt-2 font-mono">
              <span>GRAND TOTAL SELURUH PENGELUARAN ({expenses.length} Transaksi):</span>
              <span className="text-sm text-rose-700">{formatRupiah(totalExpenseAmount)}</span>
            </div>
          </div>

          {/* 2. Tabel Rincian Lengkap Pengeluaran */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              2. Daftar Rincian Pengeluaran ({expenses.length} Catatan)
            </h4>
            
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-800 border-b border-gray-300 font-bold">
                  <th className="py-2 px-2 text-center w-8">No</th>
                  <th className="py-2 px-2.5 whitespace-nowrap">Tanggal & Waktu</th>
                  <th className="py-2 px-3">Keperluan / Keterangan</th>
                  <th className="py-2 px-2.5">Kategori</th>
                  <th className="py-2 px-2.5">Sumber Dana</th>
                  <th className="py-2 px-3 text-right">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      Tidak ada catatan pengeluaran pada periode ini.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp, idx) => {
                    const isStock = isStockExpense(exp);
                    const isKasBesar = (exp.source || '').toUpperCase() === 'KAS_BESAR';

                    return (
                      <tr key={exp.id || idx} className="hover:bg-gray-50/80">
                        <td className="py-2 px-2 text-center font-mono text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-2.5 font-mono text-gray-600 whitespace-nowrap">
                          {formatDateTime(exp.created_at)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-gray-900">
                          {exp.title}
                        </td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isStock
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {isStock ? 'Belanja Stok (Aset)' : 'Operasional (Beban)'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              isKasBesar
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-[#1B5E20]'
                            }`}
                          >
                            {isKasBesar ? 'Kas Besar' : 'Laci Kasir'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          -{formatRupiah(exp.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-gray-900 font-mono">
                  <td colSpan={5} className="py-2 px-3 text-right">TOTAL PENGELUARAN:</td>
                  <td className="py-2 px-3 text-right text-rose-800 text-xs">{formatRupiah(totalExpenseAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 3. Catatan Standar Kebijakan Finansial */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[10px] text-gray-600 space-y-1">
            <p className="font-bold text-gray-800">Catatan Standar Pembukuan Finansial Toko:</p>
            <p>
              1. <strong>Belanja Stok ({formatRupiah(totalStockExpenses)}):</strong> Pembelian persediaan barang/sembako adalah konversi kas menjadi <em>Aset Persediaan Toko</em>. HPP barang sudah otomatis terhitung saat produk terjual di kasir, sehingga belanja stok tidak memotong Laba Bersih operasional toko.
            </p>
            <p>
              2. <strong>Biaya Operasional ({formatRupiah(totalOperationalExpenses)}):</strong> Beban murni operasional toko (listrik, kantong plastik, bensin/transportasi, perlengkapan) yang langsung memotong estimasi Laba Bersih.
            </p>
          </div>

          {/* Lembar Tanda Tangan */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <p className="text-gray-500 mb-12">Petugas Kasir / Pembukuan,</p>
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
