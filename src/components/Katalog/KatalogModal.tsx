import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Filter, 
  Layers, 
  Check, 
  FileText, 
  Store, 
  Phone, 
  MapPin, 
  Calendar, 
  Grid, 
  List, 
  Sparkles, 
  AlertCircle,
  Package,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { Product, StoreProfile } from '../../types';
import { formatRupiah, formatStockWithAlias } from '../../lib/utils';
import { DEFAULT_STORE_PROFILE } from '../../services/api';

// Helper to dynamically load external script in browser without bundling
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

interface KatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  storeProfile?: StoreProfile;
}

export const KatalogModal: React.FC<KatalogModalProps> = ({
  isOpen,
  onClose,
  products,
  storeProfile: initialStoreProfile,
}) => {
  const profile = initialStoreProfile || DEFAULT_STORE_PROFILE;

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [hideOutOfStock, setHideOutOfStock] = useState<boolean>(true);
  const [showStockQty, setShowStockQty] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'category' | 'name' | 'price-asc' | 'price-desc'>('category');

  // Export states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Available categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['Semua', ...list];
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.is_active !== false);

    if (selectedCategory !== 'Semua') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (hideOutOfStock) {
      list = list.filter((p) => (p.stock_kg || 0) > 0);
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'id');
      }
      if (sortBy === 'price-asc') {
        return (a.selling_price || 0) - (b.selling_price || 0);
      }
      if (sortBy === 'price-desc') {
        return (b.selling_price || 0) - (a.selling_price || 0);
      }
      // default: category then name
      const catCompare = (a.category || '').localeCompare(b.category || '', 'id');
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name, 'id');
    });

    return list;
  }, [products, selectedCategory, hideOutOfStock, sortBy]);

  // Grouped by category
  const groupedProducts = useMemo<Array<{ categoryName: string; items: Product[] }>>(() => {
    const groups: Record<string, Product[]> = {};
    filteredProducts.forEach((prod) => {
      const cat = prod.category || 'Umum';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(prod);
    });
    return Object.entries(groups).map(([categoryName, items]) => ({
      categoryName,
      items,
    }));
  }, [filteredProducts]);

  if (!isOpen) return null;

  // Print function using browser print
  const handlePrint = () => {
    window.print();
  };

  // Download PDF via client-side html2pdf or native print dialog (no bundler imports to guarantee zero build errors)
  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    
    try {
      setIsGeneratingPdf(true);
      setPdfError(null);
      setPdfSuccessNotice(false);

      const target = printRef.current;
      const todayStr = new Date().toISOString().slice(0, 10);
      const cleanStoreName = (profile.store_name || 'tokoberkah')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const filename = `katalog_${cleanStoreName}_${todayStr}.pdf`;

      // 1. Attempt client-side html2pdf via CDN if available
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
          setPdfSuccessNotice(true);
          setTimeout(() => setPdfSuccessNotice(false), 5000);
          setIsGeneratingPdf(false);
          return;
        }
      } catch (cdnErr) {
        console.warn('html2pdf CDN unavailable, switching to browser print dialog:', cdnErr);
      }

      // 2. Fallback to browser print (users can choose "Save as PDF" / "Simpan sebagai PDF")
      window.print();
      setPdfSuccessNotice(true);
      setTimeout(() => setPdfSuccessNotice(false), 4000);
    } catch (err: any) {
      console.error('Error generating catalog PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Format today date in Indonesian locale
  const formattedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-5xl w-full flex flex-col shadow-2xl overflow-hidden my-4 max-h-[95vh] border border-gray-100 animate-in zoom-in-95 duration-150">
        
        {/* Top Navigation & Action Controls (Hidden on physical print) */}
        <div className="no-print bg-[#1B5E20] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                <span>Katalog Produk & Daftar Harga</span>
                <span className="text-[11px] font-semibold bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  {filteredProducts.length} Produk
                </span>
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {profile.store_name} • Siap Cetak & Export PDF Resmi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup katalog"
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Customization Toolbar (Hidden on physical print) */}
        <div className="no-print bg-gray-50/90 border-b border-gray-200 px-5 sm:px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left filters: Category, Stock visibility, and Layout mode */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-500 font-medium">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer pr-1"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'Semua' ? 'Semua Kategori' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Hide Out of Stock Checkbox */}
            <label className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs cursor-pointer hover:bg-gray-50 transition-colors select-none">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={(e) => setHideOutOfStock(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[#2E7D32] focus:ring-[#2E7D32] cursor-pointer"
              />
              <span className="text-gray-700 font-medium">Sembunyikan Stok 0</span>
            </label>

            {/* Show Stock Quantity Checkbox */}
            <label className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs cursor-pointer hover:bg-gray-50 transition-colors select-none">
              <input
                type="checkbox"
                checked={showStockQty}
                onChange={(e) => setShowStockQty(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[#2E7D32] focus:ring-[#2E7D32] cursor-pointer"
              />
              <span className="text-gray-700 font-medium">Cantumkan Sisa Stok</span>
            </label>

            {/* Layout Mode Toggle: Grid vs Table */}
            <div className="flex items-center bg-gray-200/80 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  layoutMode === 'grid'
                    ? 'bg-white text-[#1B5E20] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Tampilan Kartu Bergambar"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Grid Foto</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('table')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  layoutMode === 'table'
                    ? 'bg-white text-[#1B5E20] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Tampilan Tabel Daftar Harga Ringkas"
              >
                <List className="w-3.5 h-3.5" />
                <span>Tabel Ringkas</span>
              </button>
            </div>
          </div>

          {/* Right actions: Print & Download PDF */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>Cetak Dokumen</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications & Warnings */}
        {pdfSuccessNotice && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs text-emerald-800 flex items-center gap-2 font-medium animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Katalog PDF berhasil diunduh ke perangkat Anda!</span>
          </div>
        )}
        {pdfError && (
          <div className="no-print bg-rose-50 border-b border-rose-200 px-6 py-2 text-xs text-rose-800 flex items-center gap-2 font-medium animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {/* Document Preview Pane (Scrollable on screen, Full width on print) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#e9ebe9]/60">
          {/* Printable Document Container */}
          <div 
            id="printable-catalog"
            ref={printRef}
            className="printable-catalog bg-white max-w-[800px] mx-auto p-6 sm:p-10 shadow-lg sm:rounded-2xl border border-gray-200 text-gray-900"
          >
            {/* Header: Store Info, Logo, Title & Date */}
            <div className="border-b-2 border-[#1B5E20] pb-5 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* Logo or Store Emblem */}
                  <img
                    src="/icon.svg"
                    alt={profile.store_name}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl border border-gray-100 shadow-2xs"
                    onError={(e) => {
                      // Fallback if svg fails
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none uppercase">
                      {profile.store_name}
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-[#2E7D32] mt-1">
                      {profile.tagline || 'Sembako, Bumbu, & Kebutuhan Harian Lengkap'}
                    </p>
                    <div className="mt-2 space-y-0.5 text-[11px] sm:text-xs text-gray-600">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{profile.address || 'Jl. Kalapanunggal I, Sindangkasih, Ciamis'}</span>
                      </p>
                      <p className="flex items-center gap-1.5 font-semibold text-gray-800">
                        <Phone className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                        <span>Pesanan via WhatsApp: {profile.phone || '0852-9499-6696'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Document Metadata Badge */}
                <div className="text-right shrink-0">
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-[#1B5E20] border border-emerald-200 font-bold text-[11px] sm:text-xs uppercase tracking-wider">
                    Katalog Resmi
                  </span>
                  <p className="text-[11px] text-gray-500 mt-2 flex items-center justify-end gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Update: {formattedDate}</span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Total: {filteredProducts.length} Produk
                  </p>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="mt-4 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3.5 py-2 flex items-center justify-between text-[11px] text-[#1B5E20]">
                <span>📌 Siap melayani pesan-antar (Delivery COD) & belanja langsung ke toko.</span>
                <span className="font-semibold hidden sm:inline">Kualitas Terjamin & Berkah</span>
              </div>
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-gray-500 space-y-2">
                <Package className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="font-semibold text-sm">Tidak ada produk yang cocok dengan filter saat ini.</p>
                <p className="text-xs text-gray-400">Coba ubah pilihan kategori atau tampilkan stok kosong.</p>
              </div>
            ) : (
              /* Catalog Body */
              <div className="space-y-8">
                {groupedProducts.map(({ categoryName, items }) => (
                  <div key={categoryName} className="page-break-avoid">
                    {/* Category Title Header */}
                    <div className="flex items-center gap-2 mb-3.5 pb-1.5 border-b border-gray-200">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]" />
                      <h3 className="font-bold text-sm sm:text-base text-gray-900 uppercase tracking-wide">
                        {categoryName}
                      </h3>
                      <span className="text-[11px] font-semibold text-gray-500 ml-auto">
                        ({items.length} Barang)
                      </span>
                    </div>

                    {/* Layout Mode: Grid */}
                    {layoutMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                        {items.map((product) => {
                          const isOutOfStock = (product.stock_kg || 0) <= 0;
                          return (
                            <div
                              key={product.id}
                              className="border border-gray-200 rounded-xl p-3 bg-white flex flex-col justify-between shadow-2xs page-break-avoid relative overflow-hidden"
                            >
                              {isOutOfStock && (
                                <div className="absolute top-2 right-2 bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  Habis
                                </div>
                              )}

                              {/* Product Thumbnail */}
                              <div className="w-full aspect-square bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100 mb-2 relative">
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Fallback on load error
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-gray-300 p-2">
                                    <Package className="w-8 h-8 opacity-40" />
                                    <span className="text-[9px] uppercase font-bold tracking-widest mt-1 text-gray-400">
                                      {product.category || 'Berkah'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Product Details */}
                              <div className="flex-1 flex flex-col justify-between">
                                <div>
                                  <h4 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug line-clamp-2">
                                    {product.name}
                                  </h4>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    Satuan: <span className="font-semibold text-gray-700">{product.unit || 'kg'}</span>
                                  </p>
                                  {showStockQty && (
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                      Stok: <span className="font-mono">{formatStockWithAlias(product.stock_kg, product.unit)}</span>
                                    </p>
                                  )}
                                </div>

                                {/* Price Tag */}
                                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-baseline justify-between">
                                  <span className="text-xs sm:text-sm font-black text-[#1B5E20]">
                                    {formatRupiah(product.selling_price)}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    /{product.unit || 'kg'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Layout Mode: Compact Table */
                      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                            <tr>
                              <th className="py-2.5 px-3 w-12 text-center">Foto</th>
                              <th className="py-2.5 px-3">Nama Produk</th>
                              <th className="py-2.5 px-3 text-center">Satuan</th>
                              {showStockQty && <th className="py-2.5 px-3 text-center">Stok</th>}
                              <th className="py-2.5 px-3 text-right">Harga Jual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {items.map((product) => (
                              <tr key={product.id} className="hover:bg-gray-50/50">
                                <td className="py-2 px-3 text-center">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      crossOrigin="anonymous"
                                      referrerPolicy="no-referrer"
                                      className="w-8 h-8 object-cover rounded-md border border-gray-200 mx-auto"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 mx-auto">
                                      <Package className="w-4 h-4" />
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  <p className="font-bold text-gray-900">{product.name}</p>
                                  <span className="text-[10px] text-gray-400">{product.barcode || ''}</span>
                                </td>
                                <td className="py-2 px-3 text-center font-medium text-gray-600">
                                  {product.unit || 'kg'}
                                </td>
                                {showStockQty && (
                                  <td className="py-2 px-3 text-center font-mono text-gray-700">
                                    {formatStockWithAlias(product.stock_kg, product.unit)}
                                  </td>
                                )}
                                <td className="py-2 px-3 text-right font-bold text-[#1B5E20]">
                                  {formatRupiah(product.selling_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer / Ordering Instructions & Notes */}
            <div className="mt-10 pt-6 border-t-2 border-gray-200 page-break-avoid space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
                    <span>Cara Pemesanan Online via WhatsApp:</span>
                  </h4>
                  <ol className="mt-1 text-[11px] text-gray-600 space-y-0.5 list-decimal list-inside">
                    <li>Ketik daftar pesanan barang & jumlah yang diinginkan.</li>
                    <li>Kirimkan ke WhatsApp Toko Berkah: <strong className="text-gray-900">{profile.phone || '0852-9499-6696'}</strong>.</li>
                    <li>Pesanan disiapkan & dikirim ke alamat Anda (Pembayaran COD / Transfer).</li>
                  </ol>
                </div>

                <div className="shrink-0 text-right sm:border-l sm:border-gray-200 sm:pl-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Layanan Pelanggan</p>
                  <p className="text-sm font-black text-[#1B5E20] font-mono mt-0.5">
                    {profile.phone || '0852-9499-6696'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Buka Setiap Hari: 06.00 - 21.00 WIB</p>
                </div>
              </div>

              {/* Blessing Message */}
              <div className="text-center text-xs text-gray-500 italic space-y-1">
                <p>
                  {profile.footer_message || 'Jazakumullah khairan, terima kasih atas kepercayaan dan kunjungan Anda di Toko Berkah.'}
                </p>
                <p className="font-bold tracking-widest text-[#2E7D32] not-italic text-[11px]">
                  {profile.footer_quote || '*** BERKAH SELALU ***'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Bar Controls (Hidden on print) */}
        <div className="no-print p-4 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-500 hidden sm:block">
            Tips: Gunakan <strong className="text-gray-700">Cetak Dokumen</strong> untuk print fisik atau <strong className="text-gray-700">Download PDF</strong> untuk membagikan file katalog ke pelanggan via WhatsApp.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl border border-[#2E7D32] text-[#1B5E20] hover:bg-emerald-50 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
