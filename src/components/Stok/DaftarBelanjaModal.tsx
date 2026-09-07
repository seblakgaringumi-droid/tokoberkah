import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  ShoppingBag, 
  Store, 
  Phone, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sparkles, 
  Building2, 
  Filter, 
  RefreshCw,
  Edit2
} from 'lucide-react';
import { Product, StoreProfile } from '../../types';
import { formatRupiah, formatStock, roundStock } from '../../lib/utils';
import { DEFAULT_STORE_PROFILE } from '../../services/api';

// Helper to dynamically load external html2pdf if needed
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load script')));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load script'));
    document.head.appendChild(script);
  });
};

export interface ShoppingListItem {
  product: Product;
  currentStock: number;
  minStock: number;
  orderQty: number;
  costPrice: number;
  subtotal: number;
  supplierNote: string;
}

interface DaftarBelanjaModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  storeProfile?: StoreProfile;
  activeFilterType?: 'ALL' | 'LOW' | 'OUT';
}

export const DaftarBelanjaModal: React.FC<DaftarBelanjaModalProps> = ({
  isOpen,
  onClose,
  products,
  storeProfile: initialStoreProfile,
  activeFilterType = 'LOW'
}) => {
  const profile = initialStoreProfile || DEFAULT_STORE_PROFILE;

  // Selection scope
  const [filterScope, setFilterScope] = useState<'PRIORITY' | 'OUT_ONLY' | 'ALL_ACTIVE'>(
    activeFilterType === 'OUT' ? 'OUT_ONLY' : 'PRIORITY'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [supplierName, setSupplierName] = useState<string>('Supplier / Agen Utama');
  
  // Custom multiplier: standard buffer formula multiplier (e.g. 2x min stock or 1.5x)
  const [bufferMultiplier, setBufferMultiplier] = useState<number>(2);

  // Custom overrides for order quantity and notes per product id
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});

  // Export states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Categories list
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['Semua', ...list];
  }, [products]);

  // Generate shopping list items based on filter scope
  const shoppingListItems: ShoppingListItem[] = useMemo(() => {
    let target = products.filter((p) => p.is_active !== false);

    if (selectedCategory !== 'Semua') {
      target = target.filter((p) => p.category === selectedCategory);
    }

    if (filterScope === 'OUT_ONLY') {
      target = target.filter((p) => (p.stock_kg || 0) <= 0);
    } else if (filterScope === 'PRIORITY') {
      // Out of stock or low stock
      target = target.filter((p) => (p.stock_kg || 0) <= (p.min_stock || 10));
    }

    // Sort: 0 stock first, then lowest stock
    target.sort((a, b) => {
      const aStock = a.stock_kg || 0;
      const bStock = b.stock_kg || 0;
      if (aStock <= 0 && bStock > 0) return -1;
      if (bStock <= 0 && aStock > 0) return 1;
      return aStock - bStock;
    });

    return target.map((p) => {
      const currentStock = roundStock(p.stock_kg || 0);
      const minStock = roundStock(p.min_stock || 10);
      const costPrice = p.cost_price || 0;

      // Calculate default recommended order qty
      // Recommended = Target buffer (e.g. min_stock * bufferMultiplier) - currentStock
      let defaultOrder = Math.max(minStock * bufferMultiplier - currentStock, minStock);
      if (defaultOrder <= 0) defaultOrder = minStock;
      defaultOrder = roundStock(defaultOrder);

      const orderQty = customQuantities[p.id] !== undefined ? customQuantities[p.id] : defaultOrder;
      const subtotal = Math.round(orderQty * costPrice);
      const note = customNotes[p.id] !== undefined ? customNotes[p.id] : '';

      return {
        product: p,
        currentStock,
        minStock,
        orderQty,
        costPrice,
        subtotal,
        supplierNote: note
      };
    });
  }, [products, filterScope, selectedCategory, bufferMultiplier, customQuantities, customNotes]);

  // Calculations summary
  const totalItemsCount = shoppingListItems.length;
  const totalEstQuantity = shoppingListItems.reduce((acc, item) => acc + item.orderQty, 0);
  const totalEstimatedCost = shoppingListItems.reduce((acc, item) => acc + item.subtotal, 0);
  const outOfStockCount = shoppingListItems.filter((item) => item.currentStock <= 0).length;
  const lowStockCount = shoppingListItems.filter((item) => item.currentStock > 0 && item.currentStock <= item.minStock).length;

  // Handle edit single item qty
  const handleQtyChange = (productId: string, val: number) => {
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, roundStock(val))
    }));
  };

  // Handle edit single item note
  const handleNoteChange = (productId: string, val: string) => {
    setCustomNotes((prev) => ({
      ...prev,
      [productId]: val
    }));
  };

  // Format today date in Indonesian locale
  const formattedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Export to CSV / Excel
  const handleExportCSV = () => {
    if (shoppingListItems.length === 0) {
      alert('Tidak ada data produk dalam daftar belanja untuk di-export.');
      return;
    }

    const headers = [
      'No',
      'Kode / Barcode',
      'Nama Produk',
      'Kategori',
      'Stok Saat Ini',
      'Batas Minimal Stok',
      'Estimasi Jumlah Belanja',
      'Satuan',
      'Harga Beli Terakhir (Rp)',
      'Subtotal Estimasi Modal (Rp)',
      'Catatan / Supplier'
    ];

    const rows = shoppingListItems.map((item, idx) => [
      idx + 1,
      `"${item.product.barcode || '-'}"`,
      `"${item.product.name.replace(/"/g, '""')}"`,
      `"${item.product.category || 'Umum'}"`,
      item.currentStock,
      item.minStock,
      item.orderQty,
      `"${item.product.unit || 'pcs'}"`,
      item.costPrice,
      item.subtotal,
      `"${(item.supplierNote || supplierName).replace(/"/g, '""')}"`
    ]);

    // Add summary row
    rows.push([
      '',
      '',
      '"TOTAL ESTIMASI KULAKAN"',
      '',
      '',
      '',
      totalEstQuantity,
      '',
      '',
      totalEstimatedCost,
      `"Tanggal: ${formattedDate}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDate = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `Daftar_Belanja_Supplier_${profile.store_name.replace(/\s+/g, '_')}_${safeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice('File CSV/Excel berhasil didownload!');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Copy text for WhatsApp
  const handleCopyWhatsAppText = () => {
    if (shoppingListItems.length === 0) return;

    let text = `*📋 DAFTAR PESANAN / KULAKAN TOKO*\n`;
    text += `*Toko:* ${profile.store_name}\n`;
    text += `*Tanggal:* ${formattedDate} (${formattedTime})\n`;
    text += `*Supplier/Tujuan:* ${supplierName}\n`;
    text += `------------------------------------\n\n`;

    shoppingListItems.forEach((item, idx) => {
      text += `${idx + 1}. *${item.product.name}*\n`;
      text += `   - Pesan: *${item.orderQty} ${item.product.unit || 'pcs'}*\n`;
      text += `   - Stok Sisa: ${item.currentStock} ${item.product.unit || 'pcs'}\n`;
      if (item.costPrice > 0) {
        text += `   - Est. Modal: ${formatRupiah(item.costPrice)}/satuan (Subtotal: ${formatRupiah(item.subtotal)})\n`;
      }
      if (item.supplierNote) {
        text += `   - Catatan: ${item.supplierNote}\n`;
      }
      text += `\n`;
    });

    text += `------------------------------------\n`;
    text += `*Total Barang:* ${totalItemsCount} item\n`;
    text += `*Total Estimasi Anggaran:* ${formatRupiah(totalEstimatedCost)}\n\n`;
    text += `_Mohon info ketersediaan stok & total tagihannya. Terima kasih!_`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  // Download PDF or Print
  const handleDownloadPDF = async () => {
    const target = printRef.current;
    if (!target) return;

    setIsGeneratingPdf(true);
    const safeDate = new Date().toISOString().split('T')[0];
    const filename = `Daftar_Belanja_Supplier_${profile.store_name.replace(/\s+/g, '_')}_${safeDate}.pdf`;

    try {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
        const html2pdf = (window as any).html2pdf;
        if (typeof html2pdf === 'function') {
          const opt = {
            margin: [6, 6, 6, 6],
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
          };
          await html2pdf().set(opt).from(target).save();
          setExportNotice('File PDF resmi berhasil didownload!');
          setTimeout(() => setExportNotice(null), 4000);
          setIsGeneratingPdf(false);
          return;
        }
      } catch (cdnErr) {
        console.warn('html2pdf CDN error, falling back to print dialog:', cdnErr);
      }

      window.print();
      setExportNotice('Siap cetak / simpan sebagai PDF');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="daftar-belanja-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 print:bg-white print:p-0 print:static print:overflow-visible print:block"
    >
      <div 
        id="daftar-belanja-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-6xl w-full flex flex-col shadow-2xl overflow-hidden my-3 max-h-[96vh] border border-gray-100 animate-in zoom-in-95 duration-150 print:shadow-none print:border-none print:max-h-none print:my-0 print:rounded-none print:overflow-visible"
      >
        {/* Modal Topbar */}
        <div className="no-print bg-linear-to-r from-[#1B5E20] via-[#2E7D32] to-[#1B5E20] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <ShoppingBag className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                <span>Daftar Belanja Supplier & Rekomendasi Kulakan</span>
                <span className="text-[11px] font-semibold bg-emerald-500/40 text-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                  {shoppingListItems.length} Produk
                </span>
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {profile.store_name} • Format Siap Cetak PDF, CSV/Excel & Pesan WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar (Filter Scope, Category, Multiplier, Actions) */}
        <div className="no-print bg-gray-50/90 border-b border-gray-200 px-5 sm:px-6 py-3.5 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter Scope Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setFilterScope('PRIORITY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterScope === 'PRIORITY'
                    ? 'bg-[#2E7D32] text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Kosong & Menipis ({products.filter(p => p.stock_kg <= (p.min_stock || 10)).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterScope('OUT_ONLY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterScope === 'OUT_ONLY'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Hanya Stok Kosong / 0 ({products.filter(p => p.stock_kg <= 0).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterScope('ALL_ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterScope === 'ALL_ACTIVE'
                    ? 'bg-gray-800 text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Semua Produk Aktif ({products.length})
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-white border border-gray-200 text-gray-800 font-medium focus:border-[#2E7D32] outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === 'Semua' ? 'Semua Kategori' : c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Control Row: Supplier Name, Buffer Multiplier, and Export Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-gray-200/60">
            <div className="flex flex-wrap items-center gap-3">
              {/* Supplier Input */}
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Nama Agen / Supplier..."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="px-3 py-1 text-xs rounded-lg border border-gray-300 bg-white focus:border-[#2E7D32] outline-none w-44 sm:w-56 font-medium text-gray-800"
                />
              </div>

              {/* Buffer Formula Preset */}
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="font-semibold text-gray-500">Target Belanja:</span>
                <select
                  value={bufferMultiplier}
                  onChange={(e) => setBufferMultiplier(Number(e.target.value))}
                  className="px-2 py-1 text-xs rounded-lg bg-white border border-gray-300 text-gray-800 font-medium outline-none cursor-pointer"
                >
                  <option value={1}>1x Min. Stok (Penuhi Minimum)</option>
                  <option value={2}>2x Min. Stok (Aman 2 Minggu)</option>
                  <option value={3}>3x Min. Stok (Stok Melimpah)</option>
                  <option value={4}>4x Min. Stok (Kulakan Grosir Besar)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons Group */}
            <div className="flex flex-wrap items-center gap-2">
              {/* WhatsApp Copy */}
              <button
                type="button"
                onClick={handleCopyWhatsAppText}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Salin daftar belanja dalam format teks rapi untuk dikirim lewat WhatsApp"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Tersalin ke WA!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kirim / Salin WA</span>
                  </>
                )}
              </button>

              {/* CSV Excel */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Download file Spreadsheet Excel / CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Excel / CSV</span>
              </button>

              {/* PDF / Print */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="px-4 py-1.5 rounded-xl bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Download / Cetak Dokumen PDF Resmi"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Memproses PDF...' : 'Cetak / Download PDF'}</span>
              </button>
            </div>
          </div>

          {/* Feedback notice if any */}
          {exportNotice && (
            <div className="p-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{exportNotice}</span>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* DOCUMENT PREVIEW AREA (Ready for Screen & Physical Print) */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-100/60 print:bg-white print:p-0">
          <div 
            ref={printRef}
            id="printable-shopping-sheet"
            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 max-w-5xl mx-auto space-y-6 print:shadow-none print:border-none print:p-2 print:max-w-none print:rounded-none"
          >
            {/* Printable Document Header */}
            <div className="border-b-2 border-[#1B5E20] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1B5E20] text-white flex items-center justify-center font-bold text-sm">
                    TB
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight uppercase">
                    {profile.store_name}
                  </h1>
                </div>
                <p className="text-xs text-gray-600">
                  {profile.address || 'Pusat Sembako, Bumbu Dapur & Kebutuhan Rumah Tangga'}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  Telp/WhatsApp: {profile.phone || '0812-3456-7890'}
                </p>
              </div>

              <div className="sm:text-right bg-emerald-50/70 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-none border-emerald-100 w-full sm:w-auto">
                <span className="inline-block px-3 py-1 bg-[#1B5E20] text-white text-xs font-black uppercase tracking-wider rounded-lg mb-1">
                  DAFTAR BELANJA SUPPLIER / KULAKAN
                </span>
                <p className="text-xs font-semibold text-gray-700">
                  Tanggal: <span className="font-mono">{formattedDate}</span>
                </p>
                <p className="text-xs text-gray-600">
                  Tujuan: <strong className="text-emerald-900">{supplierName}</strong>
                </p>
              </div>
            </div>

            {/* Quick Metrics Banner inside document */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 text-xs">
              <div>
                <span className="text-gray-500 font-medium block">Total Item Belanja:</span>
                <span className="font-bold text-gray-900 text-sm">{totalItemsCount} Produk</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block">Stok Kosong (0):</span>
                <span className="font-bold text-rose-700 text-sm">{outOfStockCount} Barang</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block">Stok Kritis/Menipis:</span>
                <span className="font-bold text-amber-700 text-sm">{lowStockCount} Barang</span>
              </div>
              <div className="bg-emerald-100/70 p-2 rounded-lg border border-emerald-200">
                <span className="text-emerald-900 font-bold block text-[11px] uppercase tracking-wider">Est. Total Anggaran:</span>
                <span className="font-black text-[#1B5E20] font-mono text-sm">{formatRupiah(totalEstimatedCost)}</span>
              </div>
            </div>

            {/* The 10 Required Columns Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#1B5E20] text-white font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-3">Kode / Barcode</th>
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-2.5">Kategori</th>
                    <th className="py-2.5 px-2.5 text-center">Stok Saat Ini</th>
                    <th className="py-2.5 px-2.5 text-center">Min. Stok</th>
                    <th className="py-2.5 px-3 text-center bg-emerald-700 text-white font-black">
                      Est. Jumlah Belanja
                    </th>
                    <th className="py-2.5 px-3 text-right">Modal Terakhir</th>
                    <th className="py-2.5 px-3 text-right">Subtotal Modal</th>
                    <th className="py-2.5 px-3">Catatan / Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shoppingListItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-400 font-medium">
                        Tidak ada barang yang perlu dibelanja pada kategori / filter ini. Semua stok dalam kondisi aman!
                      </td>
                    </tr>
                  ) : (
                    shoppingListItems.map((item, idx) => {
                      const isOut = item.currentStock <= 0;
                      const isLow = item.currentStock > 0 && item.currentStock <= item.minStock;

                      return (
                        <tr 
                          key={item.product.id} 
                          className={`transition-colors ${
                            isOut 
                              ? 'bg-rose-50/70 font-medium' 
                              : isLow 
                              ? 'bg-amber-50/50' 
                              : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')
                          }`}
                        >
                          {/* 1. No */}
                          <td className="py-2 px-3 text-center text-gray-500 font-mono">
                            {idx + 1}
                          </td>

                          {/* 2. Kode / Barcode */}
                          <td className="py-2 px-3 font-mono text-gray-600 text-[11px]">
                            {item.product.barcode || '-'}
                          </td>

                          {/* 3. Nama Produk */}
                          <td className="py-2 px-3 font-bold text-gray-900">
                            <span>{item.product.name}</span>
                            {isOut && (
                              <span className="no-print ml-2 inline-block px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase">
                                HABIS
                              </span>
                            )}
                          </td>

                          {/* 4. Kategori */}
                          <td className="py-2 px-2.5 text-gray-600">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                              {item.product.category || 'Umum'}
                            </span>
                          </td>

                          {/* 5. Stok Saat Ini */}
                          <td className="py-2 px-2.5 text-center">
                            <span 
                              className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] ${
                                isOut 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                  : isLow 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {formatStock(item.currentStock, item.product.unit || 'pcs')}
                            </span>
                          </td>

                          {/* 6. Batas Minimal Stok */}
                          <td className="py-2 px-2.5 text-center font-mono text-gray-600">
                            {formatStock(item.minStock, item.product.unit || 'pcs')}
                          </td>

                          {/* 7. Estimasi Jumlah Belanja (Editable on screen) */}
                          <td className="py-2 px-3 text-center bg-emerald-50/70 border-x border-emerald-100">
                            <div className="inline-flex items-center gap-1 justify-center">
                              {/* Screen interactive input */}
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.orderQty}
                                onChange={(e) => handleQtyChange(item.product.id, Number(e.target.value))}
                                className="no-print w-16 px-1.5 py-0.5 text-center font-mono font-bold text-[#1B5E20] bg-white border border-emerald-300 rounded focus:border-[#2E7D32] outline-none text-xs"
                              />
                              <span className="no-print text-[11px] font-semibold text-emerald-800">
                                {item.product.unit || 'pcs'}
                              </span>

                              {/* Print only plain text */}
                              <span className="print-only hidden font-bold font-mono text-xs text-gray-900">
                                {item.orderQty} {item.product.unit || 'pcs'}
                              </span>
                            </div>
                          </td>

                          {/* 8. Harga Beli / Modal Terakhir */}
                          <td className="py-2 px-3 text-right font-mono text-gray-600">
                            {formatRupiah(item.costPrice)}
                          </td>

                          {/* 9. Subtotal Estimasi Modal */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#1B5E20]">
                            {formatRupiah(item.subtotal)}
                          </td>

                          {/* 10. Catatan / Supplier */}
                          <td className="py-2 px-3">
                            {/* Screen editable input */}
                            <input
                              type="text"
                              placeholder={supplierName}
                              value={item.supplierNote}
                              onChange={(e) => handleNoteChange(item.product.id, e.target.value)}
                              className="no-print w-full px-2 py-0.5 text-xs rounded border border-gray-200 bg-white placeholder-gray-400 focus:border-[#2E7D32] outline-none text-gray-800"
                            />
                            {/* Print plain text */}
                            <span className="print-only hidden text-xs text-gray-700">
                              {item.supplierNote || supplierName}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Grand Total Table Footer */}
                {shoppingListItems.length > 0 && (
                  <tfoot className="bg-emerald-50/90 font-bold border-t-2 border-emerald-300 text-xs">
                    <tr>
                      <td colSpan={6} className="py-3 px-4 text-right uppercase tracking-wider text-gray-700">
                        TOTAL ESTIMASI KEBUTUHAN MODAL KULAKAN:
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[#1B5E20] font-black text-sm">
                        {roundStock(totalEstQuantity)} Unit/Kg
                      </td>
                      <td className="py-3 px-3 text-right text-gray-500">-</td>
                      <td className="py-3 px-3 text-right font-mono text-[#1B5E20] font-black text-base">
                        {formatRupiah(totalEstimatedCost)}
                      </td>
                      <td className="py-3 px-3 text-gray-500"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Document Signature & Notes Box */}
            <div className="pt-4 flex justify-between items-end text-xs text-gray-600 border-t border-gray-200">
              <div className="space-y-1">
                <p className="font-semibold text-gray-800">Petunjuk Pembelian:</p>
                <ul className="list-disc list-inside text-gray-500 space-y-0.5 text-[11px]">
                  <li>Pastikan kualitas kemasan rapi dan tanggal kadaluarsa (EXP) masih panjang.</li>
                  <li>Jika harga modal dari agen berubah, mohon konfirmasi sebelum nota difinalisasi.</li>
                </ul>
              </div>

              <div className="text-center w-48 space-y-12">
                <p className="font-semibold text-gray-700">Penanggung Jawab Toko,</p>
                <div className="border-t border-gray-400 pt-1 font-bold text-gray-900">
                  ( {profile.store_name} )
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="no-print bg-white border-t border-gray-200 px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Kuantitas dan catatan dapat disesuaikan langsung pada tabel di atas.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Download / Cetak PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
