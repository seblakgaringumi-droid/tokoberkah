import React, { useState, useMemo } from 'react';
import { Printer, X, Package, TrendingUp, AlertTriangle, FileText, CheckCircle2, ShieldCheck, DollarSign, Filter, Search } from 'lucide-react';
import { formatRupiah, formatDateTime, formatDate, formatStock, roundStock } from '../../lib/utils';
import { Product, StoreProfile } from '../../types';

interface CetakStokOpnameModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  storeProfile?: StoreProfile;
}

export const CetakStokOpnameModal: React.FC<CetakStokOpnameModalProps> = ({
  isOpen,
  onClose,
  products,
  storeProfile,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedStatus, setSelectedStatus] = useState<'SEMUA' | 'LOW' | 'OUT'>('SEMUA');
  const [searchTerm, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeName = storeProfile?.store_name || 'TOKO BERKAH';
  const tagline = storeProfile?.tagline || 'Penyedia Kebutuhan Pokok, Sembako & Sayuran Segar Berkualitas';

  // Get list of categories
  const categories = Array.from(new Set(products.map((p) => p.category || 'Lainnya'))).sort();

  // Filter products based on category, status, and search query
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'Semua' && (p.category || 'Lainnya') !== selectedCategory) {
      return false;
    }
    const isOut = (p.stock_kg || 0) <= 0;
    const isLow = !isOut && (p.stock_kg || 0) <= (p.min_stock || 10);

    if (selectedStatus === 'LOW' && !isLow) return false;
    if (selectedStatus === 'OUT' && !isOut) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchCategory = (p.category || '').toLowerCase().includes(q);
      const matchBarcode = (p.barcode || '').toLowerCase().includes(q);
      return matchName || matchCategory || matchBarcode;
    }

    return true;
  });

  // Calculate summary metrics
  const totalProductsCount = filteredProducts.length;

  const totalStockQty = filteredProducts.reduce((acc, p) => acc + (Number(p.stock_kg) || 0), 0);

  const totalCostValue = filteredProducts.reduce((acc, p) => {
    const qty = Number(p.stock_kg) || 0;
    const cost = Number(p.cost_price) || 0;
    return acc + qty * cost;
  }, 0);

  const totalSalesValue = filteredProducts.reduce((acc, p) => {
    const qty = Number(p.stock_kg) || 0;
    const price = Number(p.selling_price) || 0;
    return acc + qty * price;
  }, 0);

  const totalPotentialProfit = Math.max(0, totalSalesValue - totalCostValue);

  const lowStockCount = filteredProducts.filter((p) => {
    const stock = p.stock_kg || 0;
    return stock > 0 && stock <= (p.min_stock || 10);
  }).length;

  const outOfStockCount = filteredProducts.filter((p) => (p.stock_kg || 0) <= 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto print:static print:p-0 print:bg-transparent print:overflow-visible print:block print:h-auto print:max-h-none">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-6 max-h-[90vh] overflow-y-auto print:p-0 print:m-0 print:max-w-none print:shadow-none print:rounded-none print:max-h-none print:overflow-visible print:h-auto print:w-full print:block">
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-4 print:hidden">
          <div>
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2E7D32]" />
              Pratinjau Cetak Laporan Stok Opname Lengkap
            </h3>
            <p className="text-xs text-gray-500">
              Cetak / PDF daftar persediaan inventaris barang lengkap dengan Harga Modal (HPP) & Harga Jual
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Filter Controls (Hidden on print) */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#2E7D32]" />
              Filter Cetak:
            </span>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-800 outline-none cursor-pointer focus:ring-2 focus:ring-[#2E7D32]"
            >
              <option value="Semua">Semua Kategori ({products.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  Kategori: {cat}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex bg-white border border-gray-300 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setSelectedStatus('SEMUA')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  selectedStatus === 'SEMUA' ? 'bg-[#2E7D32] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semua Status
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('LOW')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  selectedStatus === 'LOW' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Stok Menipis ({lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('OUT')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  selectedStatus === 'OUT' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Stok Habis ({outOfStockCount})
              </button>
            </div>

            {/* Search Filter */}
            <div className="relative flex-1 min-w-40">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama barang..."
                value={searchTerm}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#2E7D32]"
              />
            </div>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="printable-report border border-gray-200 rounded-2xl p-6 sm:p-8 bg-white space-y-6 text-gray-900 text-xs print:border-none print:p-0 print:space-y-4">
          {/* Header Toko */}
          <div className="text-center border-b-2 border-gray-800 pb-4 space-y-1 print:pb-2">
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 bg-gray-100 py-1 px-4 rounded-lg inline-block print:bg-gray-200">
                LAPORAN STOK OPNAME & INVENTARIS TOKO LENGKAP
              </h3>
            </div>
            <div className="text-[11px] text-gray-500 flex justify-center gap-4 pt-1 font-mono flex-wrap">
              <span>Tanggal Opname: <strong>{formatDateTime(new Date().toISOString())}</strong></span>
              <span>•</span>
              <span>Kategori: <strong>{selectedCategory}</strong></span>
              <span>•</span>
              <span>Total: <strong>{filteredProducts.length} Jenis Barang</strong></span>
            </div>
          </div>

          {/* 1. Ringkasan Rekapitulasi Nilai Aset & Potensi Hasil */}
          <div className="space-y-2 break-inside-avoid print:break-inside-avoid">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              1. Rekapitulasi Nilai Aset Stok & Potensi Penjualan
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center pt-1">
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-800 block font-semibold">Total Variasi Produk</span>
                <span className="font-mono font-bold text-sm text-[#1B5E20]">{totalProductsCount} Barang</span>
                <span className="text-[9px] text-emerald-700 block mt-0.5">Jumlah Item Terdata</span>
              </div>

              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] text-blue-800 block font-semibold">Total Nilai Modal (HPP Aset)</span>
                <span className="font-mono font-bold text-sm text-blue-950">{formatRupiah(totalCostValue)}</span>
                <span className="text-[9px] text-blue-700 block mt-0.5">Modal Terikat Di Stok</span>
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] text-amber-800 block font-semibold">Total Potensi Omzet Jual</span>
                <span className="font-mono font-bold text-sm text-amber-950">{formatRupiah(totalSalesValue)}</span>
                <span className="text-[9px] text-amber-700 block mt-0.5">Nilai Jika Terjual Habis</span>
              </div>

              <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-[10px] text-purple-800 block font-semibold">Estimasi Potensi Laba Kotor</span>
                <span className="font-mono font-bold text-sm text-purple-950">{formatRupiah(totalPotentialProfit)}</span>
                <span className="text-[9px] text-purple-700 block mt-0.5">Selisih Omzet - Modal</span>
              </div>
            </div>
          </div>

          {/* 2. Tabel Rincian Lengkap Daftar Stok Opname */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-200 pb-1">
              2. Rincian Daftar Stok Opname ({filteredProducts.length} Produk)
            </h4>

            <table className="w-full text-left text-[11px] border-collapse print:text-[10px]">
              <thead className="print:table-header-group">
                <tr className="bg-gray-100 text-gray-800 border-b border-gray-300 font-bold">
                  <th className="py-2 px-1.5 text-center w-7">No</th>
                  <th className="py-2 px-2">Nama Barang & Barcode</th>
                  <th className="py-2 px-2">Kategori</th>
                  <th className="py-2 px-2 text-center">Stok Fisik</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2 text-right">Modal (HPP)</th>
                  <th className="py-2 px-2 text-right">Total Modal</th>
                  <th className="py-2 px-2 text-right">Harga Jual</th>
                  <th className="py-2 px-2 text-right">Total Nilai Jual</th>
                  <th className="py-2 px-2 text-center w-16 print:w-20">Fisik Opname</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">
                      Tidak ada data stok produk yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, idx) => {
                    const qty = Number(p.stock_kg) || 0;
                    const cost = Number(p.cost_price) || 0;
                    const price = Number(p.selling_price) || 0;
                    const totalCost = qty * cost;
                    const totalSales = qty * price;

                    const isOut = qty <= 0;
                    const isLow = !isOut && qty <= (p.min_stock || 10);

                    return (
                      <tr key={p.id || idx} className="hover:bg-gray-50/80 break-inside-avoid print:break-inside-avoid">
                        <td className="py-2 px-1.5 text-center font-mono text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-2 font-bold text-gray-900">
                          <div>
                            <span>{p.name}</span>
                            {p.barcode && (
                              <span className="block text-[9px] text-gray-400 font-mono font-normal">
                                BC: {p.barcode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-gray-600 font-medium">
                          {p.category || 'Sembako'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-gray-900">
                          {formatStock(qty, p.unit || 'kg')}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isOut
                                ? 'bg-rose-100 text-rose-900'
                                : isLow
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-[#1B5E20]'
                            }`}
                          >
                            {isOut ? 'HABIS (0)' : isLow ? 'MENIPIS' : 'AMAN'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-700 whitespace-nowrap">
                          {formatRupiah(cost)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-blue-900 whitespace-nowrap">
                          {formatRupiah(totalCost)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-800 whitespace-nowrap">
                          {formatRupiah(price)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-950 whitespace-nowrap">
                          {formatRupiah(totalSales)}
                        </td>
                        {/* Kolom fisik opname lapangan untuk cataan pensil/bolpoint petugas */}
                        <td className="py-2 px-2 text-center border-l border-dashed border-gray-300 font-mono text-gray-300">
                          [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="print:table-footer-group">
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-gray-900 font-mono break-inside-avoid print:break-inside-avoid">
                  <td colSpan={6} className="py-2.5 px-2 text-right">TOTAL ASET INVENTARIS:</td>
                  <td className="py-2.5 px-2 text-right text-blue-900 text-xs">{formatRupiah(totalCostValue)}</td>
                  <td className="py-2.5 px-2 text-right">TOTAL POTENSI:</td>
                  <td className="py-2.5 px-2 text-right text-amber-950 text-xs">{formatRupiah(totalSalesValue)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 3. Catatan Kebijakan Opname & Penyesuaian Stok */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[10px] text-gray-600 space-y-1 break-inside-avoid print:break-inside-avoid">
            <p className="font-bold text-gray-800">Catatan Standar Audit & Stok Opname Toko:</p>
            <p>
              1. <strong>Nilai Modal HPP ({formatRupiah(totalCostValue)}):</strong> Adalah akumulasi modal pembelian stok fisik barang yang tersedia di rak/gudang toko saat ini.
            </p>
            <p>
              2. <strong>Pemeriksaan Fisik Opname:</strong> Gunakan kolom <em>Fisik Opname</em> untuk mencatat jumlah fisik hasil perhitungan lapangan. Apabila terdapat selisih, segera perbarui stok di menu <strong>Pengaturan Stok POS</strong>.
            </p>
          </div>

          {/* Lembar Tanda Tangan */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs break-inside-avoid print:break-inside-avoid">
            <div>
              <p className="text-gray-500 mb-12">Petugas Stok Opname / Gudang,</p>
              <p className="font-bold text-gray-900 border-t border-gray-400 pt-1 inline-block min-w-36">
                ( Petugas Opname )
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-12">Penanggung Jawab / Pemilik Toko,</p>
              <p className="font-bold text-gray-900 border-t border-gray-400 pt-1 inline-block min-w-36">
                ( Pemilik Toko Berkah )
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
