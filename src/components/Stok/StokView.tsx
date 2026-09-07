import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Layers, 
  TrendingUp, 
  AlertCircle,
  Database,
  Sparkles,
  ArrowUpDown,
  Image as ImageIcon,
  FileText,
  PlusCircle,
  MinusCircle,
  Wallet,
  Coins,
  Building2,
  ShoppingBag,
  Info,
  ArrowRight
} from 'lucide-react';
import { Product, StoreProfile, Expense } from '../../types';
import { formatRupiah, playBeep, formatStock, roundStock } from '../../lib/utils';
import { useFinance } from '../../context/FinanceContext';
import { ProductImageUploader } from './ProductImageUploader';
import { KatalogModal } from '../Katalog/KatalogModal';
import { 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  adjustProductStock, 
  createExpense,
  seedInitialProductsIfEmpty 
} from '../../services/api';

interface StokViewProps {
  products: Product[];
  onRefresh: () => Promise<void>;
  storeProfile?: StoreProfile;
  kasTokoBalance?: number;
  onExpenseCreated?: (expense: Expense) => void;
}

export const StokView: React.FC<StokViewProps> = ({ 
  products, 
  onRefresh, 
  storeProfile,
  kasTokoBalance,
  onExpenseCreated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isKatalogModalOpen, setIsKatalogModalOpen] = useState(false);

  // 1. Restock / Tambah Stok Modal State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number | string>('');
  const [restockCostPrice, setRestockCostPrice] = useState<number | string>('');
  const [restockTotalCost, setRestockTotalCost] = useState<number | string>('');
  const [restockUpdateCostPrice, setRestockUpdateCostPrice] = useState(true);
  const [fundingSource, setFundingSource] = useState<'KAS_TOKO' | 'TAMBAHAN_MODAL' | 'NON_BIAYA'>('KAS_TOKO');
  const [restockNotes, setRestockNotes] = useState('');

  // 2. Reduce / Hapus Stok Modal State
  const [isReduceStockModalOpen, setIsReduceStockModalOpen] = useState<Product | null>(null);
  const [reduceQty, setReduceQty] = useState<number | string>('');
  const [reduceReason, setReduceReason] = useState<string>('RUSAK');
  const [reduceNotes, setReduceNotes] = useState('');

  // Legacy Quick Adjust (kept as lightweight fallback)
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState<number | string>('');

  // Form state for Master Product Add/Edit
  const [formData, setFormData] = useState<{
    name: string;
    category: string;
    cost_price: number;
    selling_price: number;
    stock_kg: number;
    min_stock: number;
    unit: string;
    barcode: string;
    is_active: boolean;
    image_url: string | null;
  }>({
    name: '',
    category: 'Sembako',
    cost_price: 0,
    selling_price: 0,
    stock_kg: 10,
    min_stock: 5,
    unit: 'kg',
    barcode: '',
    is_active: true,
    image_url: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Calculations
  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.stock_kg || 0) * (p.cost_price || 0), 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock_kg <= (p.min_stock || 10));
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stock_kg <= 0).length;
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterLowStockOnly && p.stock_kg > (p.min_stock || 10)) {
        return false;
      }
      if (filterCategory !== 'Semua' && p.category !== filterCategory) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
        );
      }
      return true;
    });
  }, [products, filterCategory, filterLowStockOnly, searchQuery]);

  // Open Add Product Master Modal
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      category: 'Sembako',
      cost_price: 10000,
      selling_price: 12500,
      stock_kg: 20,
      min_stock: 5,
      unit: 'kg',
      barcode: '',
      is_active: true,
      image_url: null,
    });
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Product Master Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      category: p.category,
      cost_price: p.cost_price || 0,
      selling_price: p.selling_price || 0,
      stock_kg: roundStock(p.stock_kg || 0),
      min_stock: roundStock(p.min_stock || 10),
      unit: p.unit || 'kg',
      barcode: p.barcode || '',
      is_active: p.is_active ?? true,
      image_url: p.image_url || null,
    });
    setErrorMessage(null);
  };

  // Open Restock Modal
  const handleOpenRestock = (p: Product) => {
    setIsRestockModalOpen(p);
    setRestockQty('');
    setRestockCostPrice(p.cost_price || 0);
    setRestockTotalCost(0);
    setRestockUpdateCostPrice(true);
    setFundingSource('KAS_TOKO');
    setRestockNotes('');
  };

  // Auto calculate total cost when qty or cost price changes
  const handleQtyOrCostChange = (newQty: number | string, newUnitPrice: number | string) => {
    const q = Number(newQty) || 0;
    const up = Number(newUnitPrice) || 0;
    setRestockTotalCost(Math.round(q * up));
  };

  // Open Reduce/Delete Stock Modal
  const handleOpenReduceStock = (p: Product) => {
    setIsReduceStockModalOpen(p);
    setReduceQty('');
    setReduceReason('RUSAK');
    setReduceNotes('');
  };

  // Handle Save Master Product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Nama produk wajib diisi!');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formData.name.trim(),
          category: formData.category,
          cost_price: Number(formData.cost_price),
          selling_price: Number(formData.selling_price),
          stock_kg: Number(formData.stock_kg),
          min_stock: Number(formData.min_stock),
          unit: formData.unit,
          barcode: formData.barcode.trim() || null,
          is_active: formData.is_active,
          image_url: formData.image_url || null,
        });
      } else {
        await createProduct({
          name: formData.name.trim(),
          category: formData.category,
          cost_price: Number(formData.cost_price),
          selling_price: Number(formData.selling_price),
          stock_kg: Number(formData.stock_kg),
          min_stock: Number(formData.min_stock),
          unit: formData.unit,
          barcode: formData.barcode.trim() || null,
          is_active: formData.is_active,
          image_url: formData.image_url || null,
          variants_json: [],
        });
      }

      playBeep('success');
      setIsAddModalOpen(false);
      setEditingProduct(null);
      await onRefresh();
    } catch (err: any) {
      console.error('Save product error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan data ke Supabase.');
      playBeep('alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Restock Submit (Pembelian Stok Baru)
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRestockModalOpen) return;

    const qty = roundStock(Number(restockQty));
    if (isNaN(qty) || qty <= 0) {
      alert('Jumlah tambahan stok harus lebih dari 0');
      return;
    }

    const unitPrice = Number(restockCostPrice) || 0;
    const totalCost = Number(restockTotalCost) >= 0 ? Number(restockTotalCost) : Math.round(qty * unitPrice);

    try {
      setIsSubmitting(true);

      // 1. Tambah stok di master produk
      await adjustProductStock(isRestockModalOpen.id, qty);

      // 2. Perbarui harga modal (HPP) jika dicentang dan ada perubahan
      if (restockUpdateCostPrice && unitPrice > 0 && unitPrice !== isRestockModalOpen.cost_price) {
        await updateProduct(isRestockModalOpen.id, {
          cost_price: unitPrice,
        });
      }

      // 3. Catat Pengeluaran Kas Sesuai Sumber Biaya yang Dipilih
      if (fundingSource === 'KAS_TOKO' && totalCost > 0) {
        // Sumber: Total Kas Toko (Tunai + QRIS / Laci) -> Memotong Kas Toko harian
        const title = `Belanja Stok: ${isRestockModalOpen.name} (${qty} ${isRestockModalOpen.unit || 'pcs'})${restockNotes ? ` - ${restockNotes}` : ''}`;
        const newExp = await createExpense({
          title,
          amount: totalCost,
          category: 'Belanja Stok',
          source: 'LACI',
        });
        if (onExpenseCreated) {
          onExpenseCreated(newExp);
        }
      } else if (fundingSource === 'TAMBAHAN_MODAL' && totalCost > 0) {
        // Sumber: Tambahan Modal / Kas Besar (Kas Pemilik) -> Tidak memotong Kas Toko laci harian
        const title = `Belanja Stok (Tambahan Modal): ${isRestockModalOpen.name} (${qty} ${isRestockModalOpen.unit || 'pcs'})${restockNotes ? ` - ${restockNotes}` : ''}`;
        const newExp = await createExpense({
          title,
          amount: totalCost,
          category: 'Belanja Stok',
          source: 'KAS_BESAR',
        });
        if (onExpenseCreated) {
          onExpenseCreated(newExp);
        }
      }

      playBeep('success');
      setIsRestockModalOpen(null);
      setRestockQty('');
      setRestockNotes('');
      await onRefresh();
    } catch (err: any) {
      console.error('Restock error:', err);
      alert('Gagal menambah stok: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reduce / Hapus Stok Submit
  const handleReduceStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReduceStockModalOpen) return;

    const qty = roundStock(Number(reduceQty));
    if (isNaN(qty) || qty <= 0) {
      alert('Jumlah pengurangan stok harus lebih dari 0');
      return;
    }

    if (qty > isReduceStockModalOpen.stock_kg) {
      const confirmExceed = window.confirm(
        `Jumlah yang dikurangi (${qty}) lebih besar dari stok saat ini (${isReduceStockModalOpen.stock_kg}). Stok akan diset menjadi 0. Lanjutkan?`
      );
      if (!confirmExceed) return;
    }

    try {
      setIsSubmitting(true);
      await adjustProductStock(isReduceStockModalOpen.id, -qty);

      playBeep('beep');
      setIsReduceStockModalOpen(null);
      setReduceQty('');
      setReduceNotes('');
      await onRefresh();
    } catch (err: any) {
      console.error('Reduce stock error:', err);
      alert('Gagal mengurangi stok: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Master Product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus produk "${name}" dari database? Tindakan ini akan menghapus produk dari master data.`)) {
      return;
    }

    try {
      await deleteProduct(id);
      playBeep('beep');
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menghapus produk: ${err.message}`);
    }
  };

  // Quick stock adjustment submit (legacy fallback)
  const handleStockAdjustmentSubmit = async () => {
    if (!isStockAdjustModalOpen) return;
    const delta = roundStock(Number(stockDelta));
    if (isNaN(delta) || delta === 0) return;

    try {
      setIsSubmitting(true);
      await adjustProductStock(isStockAdjustModalOpen.id, delta);
      playBeep('success');
      setIsStockAdjustModalOpen(null);
      setStockDelta('');
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal menyesuaikan stok: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle auto seed sample sembako
  const handleSeedProducts = async () => {
    try {
      setIsSeeding(true);
      await seedInitialProductsIfEmpty();
      await onRefresh();
      playBeep('success');
    } catch (e: any) {
      alert('Gagal mengisi data awal: ' + e.message);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Total Produk</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">{products.length} Barang</p>
          </div>
        </div>

        {/* Total Stock Asset Value */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Estimasi Aset Stok</p>
            <p className="text-lg sm:text-xl font-bold text-blue-900">{formatRupiah(totalStockValue)}</p>
          </div>
        </div>

        {/* Low Stock count */}
        <div 
          onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
          className={`rounded-2xl p-4 border shadow-xs flex items-center gap-3 cursor-pointer transition-all ${
            filterLowStockOnly
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/30'
              : 'bg-white border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Stok Menipis</p>
            <p className="text-lg sm:text-xl font-bold text-amber-900">
              {lowStockProducts.length} Produk
            </p>
          </div>
        </div>

        {/* Out of Stock count */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Stok Habis</p>
            <p className="text-lg sm:text-xl font-bold text-rose-900">{outOfStockCount} Produk</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category, and Add button */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari barang / barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm rounded-full bg-gray-100 border-none text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 text-xs sm:text-sm rounded-full bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-[#2E7D32] outline-none cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'Semua' ? 'Semua Kategori' : c}
              </option>
            ))}
          </select>

          {/* Toggle Low stock filter */}
          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              filterLowStockOnly
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Hanya Stok Menipis</span>
          </button>
        </div>

        {/* Action Buttons: Add product & Auto Seed */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {products.length === 0 && (
            <button
              onClick={handleSeedProducts}
              disabled={isSeeding}
              className="px-4 py-2.5 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{isSeeding ? 'Memuat...' : 'Isi Contoh Sembako'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsKatalogModalOpen(true)}
            className="px-4 py-2.5 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            title="Download & Cetak Katalog Produk PDF Resmi Toko Berkah"
          >
            <FileText className="w-4 h-4 text-[#2E7D32]" />
            <span>Cetak / Download Katalog</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Products Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5">Nama Produk</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th className="px-4 py-3.5 text-right">Modal (HPP)</th>
                <th className="px-4 py-3.5 text-right">Harga Jual</th>
                <th className="px-4 py-3.5 text-center">Stok</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right min-w-[200px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    Tidak ada produk yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stock_kg <= (p.min_stock || 10);
                  const isOut = p.stock_kg <= 0;
                  const profitMargin = p.selling_price - p.cost_price;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0 shadow-2xs"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-emerald-50/60 text-[#2E7D32] border border-emerald-100 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 opacity-70" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-900 block truncate">{p.name}</span>
                            {p.barcode && (
                              <p className="text-[11px] text-gray-400 font-mono">Barcode: {p.barcode}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-gray-600">
                        {formatRupiah(p.cost_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#1B5E20]">
                        {formatRupiah(p.selling_price)}
                        <span className="text-[10px] text-gray-400 block font-normal">
                          Laba +{formatRupiah(profitMargin)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
                              isOut
                                ? 'bg-rose-100 text-rose-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {formatStock(p.stock_kg, p.unit || 'kg')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                            p.is_active ? 'bg-[#2E7D32]' : 'bg-gray-400'
                          }`}
                        />
                        <span className="text-xs">{p.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Tombol Tambah Stok / Restok */}
                          <button
                            type="button"
                            onClick={() => handleOpenRestock(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] border border-emerald-200 text-xs font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer group"
                            title="Tambah Stok / Pembelian Baru (Pilih sumber dana Kas Toko / Modal)"
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-[#2E7D32] group-hover:scale-110 transition-transform" />
                            <span className="hidden xl:inline">Tambah Stok</span>
                          </button>

                          {/* 2. Tombol Hapus / Kurangi Stok */}
                          <button
                            type="button"
                            onClick={() => handleOpenReduceStock(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer group"
                            title="Kurangi / Hapus Stok (Barang Rusak, Expired, Koreksi Fisik)"
                          >
                            <MinusCircle className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                            <span className="hidden xl:inline">Hapus Stok</span>
                          </button>

                          {/* 3. Tombol Edit Detail Produk */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Edit Detail Produk & Harga"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* 4. Tombol Hapus Master Produk */}
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Produk dari Master Data"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Tidak ada produk yang cocok dengan pencarian.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isLow = p.stock_kg <= (p.min_stock || 10);
              const isOut = p.stock_kg <= 0;

              return (
                <div key={p.id} className="p-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0 shadow-2xs"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-50/60 text-[#2E7D32] border border-emerald-100 flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 opacity-70" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase font-medium">
                          {p.category}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm sm:text-base mt-0.5 truncate">{p.name}</h4>
                        {p.barcode && (
                          <p className="text-[11px] text-gray-400 font-mono">Barcode: {p.barcode}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                        isOut
                          ? 'bg-rose-100 text-rose-800'
                          : isLow
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {formatStock(p.stock_kg, p.unit || 'kg')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="text-gray-500">
                      <span>Modal: </span>
                      <span className="font-mono">{formatRupiah(p.cost_price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Jual: </span>
                      <span className="font-mono font-bold text-[#1B5E20] text-sm">
                        {formatRupiah(p.selling_price)}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Action Buttons Group */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenRestock(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] border border-emerald-200 text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-[#2E7D32]" />
                        <span>+ Tambah Stok</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReduceStock(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-all active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <MinusCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>- Hapus Stok</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. MODAL TAMBAH STOK / RESTOK DENGAN PILIHAN SUMBER BIAYA */}
      {/* ======================================================== */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-[#1B5E20] to-[#2E7D32] text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                  <ShoppingBag className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    Tambah Stok / Pembelian Baru
                  </h3>
                  <p className="text-[11px] text-emerald-100/90 font-medium">
                    {isRestockModalOpen.name} • Stok Sekarang: {formatStock(isRestockModalOpen.stock_kg, isRestockModalOpen.unit || 'kg')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRestockModalOpen(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRestockSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Product Quick Info Card */}
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-gray-500 font-medium">Produk:</span>
                  <p className="font-bold text-gray-900 text-sm truncate max-w-[200px] sm:max-w-xs">{isRestockModalOpen.name}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="text-gray-500 font-medium">Stok Saat Ini:</span>
                  <p className="font-bold text-emerald-900 font-mono text-sm">
                    {formatStock(isRestockModalOpen.stock_kg, isRestockModalOpen.unit || 'kg')}
                  </p>
                </div>
              </div>

              {/* 1. Input Jumlah Pembelian */}
              <div className="space-y-1.5">
                <label className="block text-gray-800 font-bold">
                  1. Jumlah Tambahan Stok ({isRestockModalOpen.unit || 'kg'}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    autoFocus
                    placeholder={`Contoh: 10 ${isRestockModalOpen.unit || 'kg'}`}
                    value={restockQty}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRestockQty(val);
                      handleQtyOrCostChange(val, restockCostPrice);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 font-mono text-base font-bold text-gray-900 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    {isRestockModalOpen.unit || 'kg'}
                  </span>
                </div>

                {/* Quick Add Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 mr-1">Pilih Cepat:</span>
                  {[5, 10, 20, 50, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setRestockQty(val);
                        handleQtyOrCostChange(val, restockCostPrice);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-900 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Harga Beli Satuan & Total Biaya */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Harga Beli / HPP Satuan
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={restockCostPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRestockCostPrice(val);
                        handleQtyOrCostChange(restockQty, val);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 font-mono text-sm focus:border-[#2E7D32] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Total Biaya Pembelian
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={restockTotalCost}
                      onChange={(e) => setRestockTotalCost(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 font-mono text-sm font-bold text-[#1B5E20] focus:border-[#2E7D32] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Checkbox update HPP */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-200/80">
                <input
                  type="checkbox"
                  checked={restockUpdateCostPrice}
                  onChange={(e) => setRestockUpdateCostPrice(e.target.checked)}
                  className="w-4 h-4 text-[#2E7D32] rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span>Perbarui Harga Modal (HPP) produk di master data dengan harga baru ini</span>
              </label>

              {/* 3. Pilihan Sumber Biaya Pembelian (Kas Toko vs Tambahan Modal) */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-900 font-bold">
                    2. Sumber Biaya Pembelian Stok <span className="text-rose-500">*</span>
                  </label>
                  {kasTokoBalance !== undefined && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Kas Toko: {formatRupiah(kasTokoBalance)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Opsi 1: Total Kas Toko (Tunai + QRIS) */}
                  <label 
                    onClick={() => setFundingSource('KAS_TOKO')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      fundingSource === 'KAS_TOKO'
                        ? 'border-[#2E7D32] bg-emerald-50/70 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fundingSource"
                      checked={fundingSource === 'KAS_TOKO'}
                      onChange={() => setFundingSource('KAS_TOKO')}
                      className="mt-1 w-4 h-4 text-[#2E7D32] focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-[#2E7D32]" />
                          Total Kas Toko (Tunai + QRIS)
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-[#1B5E20]">
                          Memotong Kas Toko
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Biaya belanja sebesar <strong className="text-emerald-900">{formatRupiah(Number(restockTotalCost) || 0)}</strong> akan otomatis dicatat sebagai <em>Belanja Stok Laci</em> dan memotong saldo Kas Toko harian.
                      </p>
                    </div>
                  </label>

                  {/* Opsi 2: Tambahan Modal / Kas Besar (Kas Pemilik) */}
                  <label 
                    onClick={() => setFundingSource('TAMBAHAN_MODAL')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      fundingSource === 'TAMBAHAN_MODAL'
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fundingSource"
                      checked={fundingSource === 'TAMBAHAN_MODAL'}
                      onChange={() => setFundingSource('TAMBAHAN_MODAL')}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          Tambahan Modal / Kas Besar (Kas Pemilik)
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          Kas Luar Toko
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Menggunakan dana tambahan modal pemilik toko (Kas Besar). <strong>TIDAK memotong</strong> saldo Kas Toko laci harian.
                      </p>
                    </div>
                  </label>

                  {/* Opsi 3: Tanpa Biaya (Koreksi Opname / Bonus) */}
                  <label 
                    onClick={() => setFundingSource('NON_BIAYA')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      fundingSource === 'NON_BIAYA'
                        ? 'border-purple-600 bg-purple-50/70 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fundingSource"
                      checked={fundingSource === 'NON_BIAYA'}
                      onChange={() => setFundingSource('NON_BIAYA')}
                      className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-purple-600" />
                          Tanpa Biaya / Koreksi Stok Opname
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                          Non-Kas
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Hanya menambah jumlah stok fisik barang tanpa mencatat arus kas pengeluaran apapun.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 4. Catatan / Supplier */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Catatan / Nama Supplier (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Grosir Pasar Induk, Agen ABC, dll."
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs sm:text-sm focus:border-[#2E7D32] outline-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 -mx-5 -mb-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !restockQty || Number(restockQty) <= 0}
                  className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Konfirmasi Tambah Stok</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MODAL HAPUS / KURANGI STOK (BARANG RUSAK/EXPIRED/KOREKSI) */}
      {/* ======================================================== */}
      {isReduceStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-linear-to-r from-amber-700 to-amber-600 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                  <MinusCircle className="w-5 h-5 text-amber-100" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    Hapus / Kurangi Stok Produk
                  </h3>
                  <p className="text-[11px] text-amber-100/90 font-medium">
                    {isReduceStockModalOpen.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReduceStockModalOpen(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleReduceStockSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Info Card */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-500 font-medium">Stok Tersedia:</span>
                  <p className="font-bold text-amber-950 text-sm">{formatStock(isReduceStockModalOpen.stock_kg, isReduceStockModalOpen.unit || 'kg')}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-medium">Nilai HPP:</span>
                  <p className="font-bold text-gray-700 font-mono text-sm">{formatRupiah(isReduceStockModalOpen.cost_price)}</p>
                </div>
              </div>

              {/* Input Jumlah Pengurangan */}
              <div className="space-y-1.5">
                <label className="block text-gray-800 font-bold">
                  Jumlah Stok yang Dihapus / Dikurangi ({isReduceStockModalOpen.unit || 'kg'}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    autoFocus
                    placeholder={`Contoh: 2 ${isReduceStockModalOpen.unit || 'kg'}`}
                    value={reduceQty}
                    onChange={(e) => setReduceQty(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 font-mono text-base font-bold text-gray-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    {isReduceStockModalOpen.unit || 'kg'}
                  </span>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 mr-1">Preset:</span>
                  {[1, 2, 5, 10].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReduceQty(val)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-amber-100 hover:text-amber-900 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      -{val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReduceQty(isReduceStockModalOpen.stock_kg)}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                  >
                    Habiskan Semua
                  </button>
                </div>
              </div>

              {/* Alasan Pengurangan */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Alasan Pengurangan / Penghapusan Stok
                </label>
                <select
                  value={reduceReason}
                  onChange={(e) => setReduceReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-medium focus:border-amber-600 outline-none cursor-pointer"
                >
                  <option value="RUSAK">Barang Rusak / Cacat (Damaged)</option>
                  <option value="EXPIRED">Kadaluarsa / Basi (Expired)</option>
                  <option value="HILANG_OPNAME">Selisih Hitungan / Hilang (Stock Opname)</option>
                  <option value="RETUR">Retur Kembali ke Supplier</option>
                  <option value="PRIBADI">Konsumsi / Pemakaian Pribadi Toko</option>
                  <option value="LAINNYA">Alasan Lainnya</option>
                </select>
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Catatan Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={reduceNotes}
                  onChange={(e) => setReduceNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs sm:text-sm focus:border-amber-600 outline-none"
                />
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 -mx-5 -mb-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsReduceStockModalOpen(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reduceQty || Number(reduceQty) <= 0}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <MinusCircle className="w-4 h-4" />
                      <span>Hapus / Kurangi Stok</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MODAL TAMBAH / EDIT MASTER PRODUK                     */}
      {/* ======================================================== */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#2E7D32] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Product Image Uploader Component */}
              <ProductImageUploader
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                disabled={isSubmitting}
                productId={editingProduct?.id}
              />

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beras Rojo Lele 5kg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Kategori</label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="Pilih atau ketik..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                  />
                  <datalist id="category-suggestions">
                    <option value="Sembako" />
                    <option value="Bumbu Dapur" />
                    <option value="Sayur & Buah" />
                    <option value="Makanan Instan" />
                    <option value="Minuman" />
                    <option value="Snack" />
                    <option value="Perlengkapan Mandi" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Satuan</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-[#2E7D32] outline-none"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="gram">gram</option>
                    <option value="pcs">pcs (Buah)</option>
                    <option value="bungkus">bungkus</option>
                    <option value="pouch">pouch</option>
                    <option value="karton">karton / dus</option>
                    <option value="ikat">ikat</option>
                    <option value="liter">liter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Harga Modal / Beli (HPP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Harga Jual Kasir <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono font-bold text-[#1B5E20] focus:border-[#2E7D32] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Jumlah Stok ({formData.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.stock_kg}
                    onChange={(e) => setFormData({ ...formData, stock_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Barcode / Kode Produk (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 899123456789"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active_toggle"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#2E7D32] rounded focus:ring-emerald-500"
                />
                <label htmlFor="is_active_toggle" className="text-gray-700 font-medium">
                  Produk Aktif (Tampil di Menu Kasir)
                </label>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 -mx-5 -mb-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold transition-all shadow-sm"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Katalog Produk Download & Print Modal */}
      <KatalogModal
        isOpen={isKatalogModalOpen}
        onClose={() => setIsKatalogModalOpen(false)}
        products={products}
        storeProfile={storeProfile}
      />
    </div>
  );
};

