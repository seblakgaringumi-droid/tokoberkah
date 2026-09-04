import React, { useState, useMemo } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { Product } from '../../types';
import { formatRupiah, playBeep, formatStock, roundStock } from '../../lib/utils';
import { ProductImageUploader } from './ProductImageUploader';
import { 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  adjustProductStock, 
  seedInitialProductsIfEmpty 
} from '../../services/api';

interface StokViewProps {
  products: Product[];
  onRefresh: () => Promise<void>;
}

export const StokView: React.FC<StokViewProps> = ({ products, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState<number | string>('');

  // Form state
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

  // Open add modal
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

  // Open edit modal
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

  // Handle save (Add or Edit)
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

  // Handle delete
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus produk "${name}" dari database?`)) {
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

  // Handle quick stock adjustment
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
      alert(`Gagal menambah stok: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle auto seed
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
            className={`px-4 py-2.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
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
              className="px-4 py-2.5 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{isSeeding ? 'Memuat...' : 'Isi Contoh Sembako'}</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98]"
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
                <th className="px-5 py-3.5 text-right">Aksi</th>
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
                          <button
                            onClick={() => {
                              setIsStockAdjustModalOpen(p);
                              setStockDelta('');
                            }}
                            title="Tambah / Kurangi Stok"
                            className="p-1 rounded-md text-gray-400 hover:text-[#2E7D32] hover:bg-emerald-50 transition-colors"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
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
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Edit Produk"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus Produk"
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
                <div key={p.id} className="p-4 space-y-2">
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
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 ${
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

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setIsStockAdjustModalOpen(p);
                        setStockDelta('');
                      }}
                      className="text-xs text-[#2E7D32] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Sesuaikan Stok</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
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

      {/* Add / Edit Product Modal */}
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

      {/* Quick Stock Adjust Modal */}
      {isStockAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">Sesuaikan Stok</h3>
                <p className="text-xs text-gray-500">{isStockAdjustModalOpen.name}</p>
              </div>
              <button
                onClick={() => setIsStockAdjustModalOpen(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-900 flex justify-between items-center">
              <span>Stok Saat Ini:</span>
              <span className="font-bold text-sm">
                {formatStock(isStockAdjustModalOpen.stock_kg, isStockAdjustModalOpen.unit || 'kg')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tambah / Kurang Stok (Gunakan angka minus untuk mengurangi)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Contoh: 10 atau -5"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono text-sm focus:border-[#2E7D32] outline-none"
              />
            </div>

            {/* Quick shortcuts */}
            <div className="flex gap-2">
              {[5, 10, 20, -1].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStockDelta(val)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-900 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
                >
                  {val > 0 ? `+${val}` : val}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsStockAdjustModalOpen(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || !stockDelta}
                onClick={handleStockAdjustmentSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold transition-colors shadow-xs"
              >
                {isSubmitting ? 'Menyimpan...' : 'Perbarui Stok'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
