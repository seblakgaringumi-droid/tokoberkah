import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Clock, 
  UserCheck, 
  X, 
  AlertCircle,
  Check,
  Percent,
  Coins,
  Scale,
  Edit3,
  RotateCcw,
  CheckCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, CartItem, Sale, SaleItem, StoreProfile } from '../../types';
import { formatRupiah, playBeep, formatStock, roundStock, formatStockWithAlias, getWeightAlias } from '../../lib/utils';
import { processSale } from '../../services/api';
import { ReceiptModal } from '../ReceiptModal';

// Helper for quick quantity presets based on product measurement unit
const getQuickPresets = (unit?: string) => {
  const u = (unit || '').toLowerCase().trim();
  if (u === 'kg' || u === 'kilogram' || u === '' || u === 'ons') {
    return [
      { label: '1 kg', qty: 1 },
      { label: '0.5 kg (Setengah)', qty: 0.5 },
      { label: '0.25 kg (Saparapat)', qty: 0.25 },
      { label: '0.1 kg (1 Ons)', qty: 0.1 },
      { label: '2 kg', qty: 2 },
      { label: '5 kg', qty: 5 },
    ];
  }
  if (u === 'liter' || u === 'ltr' || u === 'l') {
    return [
      { label: '1 Liter', qty: 1 },
      { label: '0.5 L (Setengah)', qty: 0.5 },
      { label: '0.25 L (1/4 L)', qty: 0.25 },
      { label: '2 Liter', qty: 2 },
      { label: '5 Liter', qty: 5 },
    ];
  }
  if (u === 'gram' || u === 'gr' || u === 'g') {
    return [
      { label: '1000g (1 kg)', qty: 1000 },
      { label: '500g (Setengah)', qty: 500 },
      { label: '250g (Saparapat)', qty: 250 },
      { label: '100g (1 Ons)', qty: 100 },
      { label: '2000g (2 kg)', qty: 2000 },
      { label: '5000g (5 kg)', qty: 5000 },
    ];
  }
  return [
    { label: '1', qty: 1 },
    { label: '0.5 (Setengah)', qty: 0.5 },
    { label: '0.25 (1/4)', qty: 0.25 },
    { label: '2', qty: 2 },
    { label: '5', qty: 5 },
    { label: '10', qty: 10 },
  ];
};

interface KasirViewProps {
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onSaleCompleted?: () => void;
  storeProfile?: StoreProfile;
  onUpdateStoreProfile?: (profile: StoreProfile) => void;
  onCartCountChange?: (count: number) => void;
}

export const KasirView: React.FC<KasirViewProps> = ({
  products,
  onRefreshProducts,
  onSaleCompleted,
  storeProfile,
  onUpdateStoreProfile,
  onCartCountChange,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState<string | null>(null);

  // Quick custom quantity selector modal state
  const [quickQtyModalProduct, setQuickQtyModalProduct] = useState<Product | null>(null);
  const [customQtyInput, setCustomQtyInput] = useState<string>('1');
  const [modalInputMode, setModalInputMode] = useState<'kg' | 'gram'>('kg');
  const [modalGramInput, setModalGramInput] = useState<string>('1000');

  // Inline Gram & Editable Subtotal states per Cart Item
  const [activeGramItemId, setActiveGramItemId] = useState<string | null>(null);
  const [gramInputMap, setGramInputMap] = useState<Record<string, string>>({});

  const [editingSubtotalItemId, setEditingSubtotalItemId] = useState<string | null>(null);
  const [subtotalInputMap, setSubtotalInputMap] = useState<Record<string, string>>({});

  // Clear cart confirmation dialog state
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);

  // Sync cart count with parent and navigation
  useEffect(() => {
    onCartCountChange?.(cart.length);
  }, [cart, onCartCountChange]);

  // Mobile cart sheet drawer state
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Checkout modal state
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER' | 'UTANG'>('CASH');
  const [cashGiven, setCashGiven] = useState<number | string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [debtDueDate, setDebtDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Receipt Modal state
  const [receiptData, setReceiptData] = useState<{
    isOpen: boolean;
    saleId: string;
    items: CartItem[];
    totalAmount: number;
    cashReceived?: number;
    changeAmount?: number;
    paymentMethod: string;
    customerName?: string;
  }>({
    isOpen: false,
    saleId: '',
    items: [],
    totalAmount: 0,
    paymentMethod: 'CASH',
  });

  // Extract categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['Semua', ...cats];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Must be active if status exists
      if (p.is_active === false) return false;

      const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchesQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Total cart calculations
  const totalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return roundStock(cart.reduce((acc, item) => acc + item.qty, 0));
  }, [cart]);

  // Add product to cart
  const addToCart = (product: Product, deltaQty = 1, customSubtotal?: number | null) => {
    playBeep('beep');
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.max(0.001, roundStock(existing.qty + deltaQty));
        const newSubtotal =
          customSubtotal !== undefined && customSubtotal !== null
            ? customSubtotal
            : Math.round(newQty * product.selling_price);
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                qty: newQty,
                custom_gram: roundStock(newQty * 1000),
                subtotal: newSubtotal,
                custom_subtotal: customSubtotal !== undefined ? customSubtotal : null,
              }
            : item
        );
      } else {
        const initialQty = deltaQty > 0 ? roundStock(deltaQty) : 1;
        const initialSubtotal =
          customSubtotal !== undefined && customSubtotal !== null
            ? customSubtotal
            : Math.round(initialQty * product.selling_price);
        return [
          ...prev,
          {
            product,
            qty: initialQty,
            unit: product.unit || 'kg',
            custom_gram: roundStock(initialQty * 1000),
            subtotal: initialSubtotal,
            custom_subtotal: customSubtotal !== undefined ? customSubtotal : null,
          },
        ];
      }
    });
  };

  // Update specific item quantity
  const updateItemQty = (productId: string, newQty: number, preserveCustomSubtotal = false) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const qty = roundStock(newQty);
          const subtotal =
            preserveCustomSubtotal && item.custom_subtotal !== null && item.custom_subtotal !== undefined
              ? item.custom_subtotal
              : Math.round(qty * item.product.selling_price);
          return {
            ...item,
            qty,
            custom_gram: roundStock(qty * 1000),
            subtotal,
            custom_subtotal: preserveCustomSubtotal ? item.custom_subtotal : null,
          };
        }
        return item;
      })
    );
  };

  // Custom Gram input handler for an item
  const handleGramInputChange = (productId: string, val: string) => {
    setGramInputMap((prev) => ({ ...prev, [productId]: val }));
    const parsedGram = parseFloat(val);
    if (!isNaN(parsedGram) && parsedGram > 0) {
      const newKg = roundStock(parsedGram / 1000);
      setCart((prev) =>
        prev.map((item) => {
          if (item.product.id === productId) {
            const subtotal =
              item.custom_subtotal !== null && item.custom_subtotal !== undefined
                ? item.custom_subtotal
                : Math.round(newKg * item.product.selling_price);
            return {
              ...item,
              qty: newKg,
              custom_gram: parsedGram,
              subtotal,
            };
          }
          return item;
        })
      );
    }
  };

  // Set preset gram directly
  const handleSetGramPreset = (productId: string, gram: number) => {
    setGramInputMap((prev) => ({ ...prev, [productId]: String(gram) }));
    const newKg = roundStock(gram / 1000);
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const subtotal =
            item.custom_subtotal !== null && item.custom_subtotal !== undefined
              ? item.custom_subtotal
              : Math.round(newKg * item.product.selling_price);
          return {
            ...item,
            qty: newKg,
            custom_gram: gram,
            subtotal,
          };
        }
        return item;
      })
    );
  };

  // Start editing item subtotal
  const handleStartEditSubtotal = (productId: string, currentSubtotal: number) => {
    setEditingSubtotalItemId(productId);
    setSubtotalInputMap((prev) => ({ ...prev, [productId]: String(currentSubtotal) }));
  };

  // Save manual subtotal
  const handleSaveSubtotal = (productId: string) => {
    const rawVal = subtotalInputMap[productId];
    const parsed = parseFloat(rawVal ? rawVal.replace(/[^\d]/g, '') : '');
    if (!isNaN(parsed) && parsed >= 0) {
      setCart((prev) =>
        prev.map((item) => {
          if (item.product.id === productId) {
            return {
              ...item,
              subtotal: Math.round(parsed),
              custom_subtotal: Math.round(parsed),
            };
          }
          return item;
        })
      );
    }
    setEditingSubtotalItemId(null);
  };

  // Reset custom subtotal back to standard formula (qty * price)
  const handleResetSubtotal = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const standard = Math.round(item.qty * item.product.selling_price);
          return {
            ...item,
            subtotal: standard,
            custom_subtotal: null,
          };
        }
        return item;
      })
    );
    setEditingSubtotalItemId(null);
  };

  // Remove item from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    setActiveGramItemId((prev) => (prev === productId ? null : prev));
    setEditingSubtotalItemId((prev) => (prev === productId ? null : prev));
  };

  // Trigger Clear cart confirmation
  const handleClearCartClick = () => {
    if (cart.length === 0) return;
    setIsClearCartConfirmOpen(true);
  };

  // Execute full cart and checkout states reset
  const handleConfirmClearCart = () => {
    setCart([]);
    setCashGiven('');
    setCustomerName('');
    setCustomerPhone('');
    setDebtDueDate('');
    setNotes('');
    setCheckoutError(null);
    setIsClearCartConfirmOpen(false);
  };

  // Handle barcode quick scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const trimmed = barcodeInput.trim();
    const found = products.find(
      (p) => p.barcode === trimmed || p.name.toLowerCase().includes(trimmed.toLowerCase())
    );

    if (found) {
      addToCart(found);
      setBarcodeFeedback(`Ditambahkan: ${found.name}`);
      playBeep('beep');
    } else {
      setBarcodeFeedback(`Produk tidak ditemukan untuk barcode: ${trimmed}`);
      playBeep('alert');
    }

    setBarcodeInput('');
    setTimeout(() => setBarcodeFeedback(null), 3000);
  };

  // Quick cash amount presets for Indonesian notes
  const cashPresets = useMemo(() => {
    if (totalAmount <= 0) return [];
    const presets = new Set<number>();
    presets.add(totalAmount); // Uang Pas

    const standardSteps = [10000, 20000, 50000, 100000, 200000];
    for (const step of standardSteps) {
      if (step > totalAmount) {
        presets.add(step);
      }
    }
    // Round up to nearest 10k or 50k
    const next10k = Math.ceil(totalAmount / 10000) * 10000;
    const next50k = Math.ceil(totalAmount / 50000) * 50000;
    if (next10k > totalAmount) presets.add(next10k);
    if (next50k > totalAmount) presets.add(next50k);

    return Array.from(presets).sort((a, b) => a - b).slice(0, 4);
  }, [totalAmount]);

  const numericCashGiven = typeof cashGiven === 'number' ? cashGiven : Number(cashGiven) || 0;
  const isCashGivenEntered = cashGiven !== '' && numericCashGiven > 0;
  const changeAmount = numericCashGiven >= totalAmount ? numericCashGiven - totalAmount : 0;
  const cashShortage = numericCashGiven > 0 && numericCashGiven < totalAmount ? totalAmount - numericCashGiven : 0;

  // Format cash input change
  const handleCashInputChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setCashGiven(clean === '' ? '' : parseInt(clean, 10));
    setCheckoutError(null);
  };

  // Open checkout modal
  const handleOpenCheckout = (method?: 'CASH' | 'QRIS' | 'TRANSFER' | 'UTANG') => {
    if (cart.length === 0) return;
    if (method) {
      setPaymentMethod(method);
    }
    if (!cashGiven && (method === 'CASH' || paymentMethod === 'CASH')) {
      setCashGiven(totalAmount); // Default to exact amount if empty
    }
    setCheckoutError(null);
    setIsCheckoutModalOpen(true);
  };

  // Perform final checkout (supports direct execution from sidebar or modal)
  const handleProcessCheckout = async (directMethod?: 'CASH' | 'QRIS' | 'TRANSFER' | 'UTANG') => {
    if (cart.length === 0 || isSubmitting) return;

    const activeMethod = directMethod || paymentMethod;
    let effectiveCash = numericCashGiven;

    if (activeMethod === 'CASH') {
      if (!isCashGivenEntered) {
        // If not typed yet, default to exact amount (uang pas)
        effectiveCash = totalAmount;
      } else if (effectiveCash < totalAmount) {
        setCheckoutError(`Uang tunai yang diterima kurang ${formatRupiah(totalAmount - effectiveCash)}!`);
        playBeep('alert');
        return;
      }
    }

    if (activeMethod === 'UTANG' && !customerName.trim()) {
      setCheckoutError('Harap isi nama pelanggan untuk pencatatan buku utang!');
      playBeep('alert');
      return;
    }

    try {
      setIsSubmitting(true);
      setCheckoutError(null);

      const receiptCash = activeMethod === 'CASH' ? effectiveCash : undefined;
      const receiptChange = activeMethod === 'CASH' ? Math.max(0, effectiveCash - totalAmount) : undefined;

      const result = await processSale({
        total_amount: totalAmount,
        payment_method: activeMethod,
        notes: notes || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        debt_due_date: debtDueDate || undefined,
        cash_received: receiptCash,
        change_amount: receiptChange,
        items: cart,
      });

      // Confetti & Audio
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#2E7D32', '#4CAF50', '#81C784', '#FFD54F'],
        });
      } catch (e) {
        // ignore
      }
      playBeep('success');

      // Save for receipt
      const currentCart = [...cart];
      const receiptTotal = totalAmount;

      // Close checkout and mobile cart
      setIsCheckoutModalOpen(false);
      setIsMobileCartOpen(false);
      setCart([]);
      setCashGiven('');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setDebtDueDate('');

      // Open Receipt Modal
      setReceiptData({
        isOpen: true,
        saleId: result.sale.id,
        items: currentCart,
        totalAmount: receiptTotal,
        cashReceived: receiptCash,
        changeAmount: receiptChange,
        paymentMethod: activeMethod,
        customerName: customerName || undefined,
      });

      // Refresh product stocks
      await onRefreshProducts();
      if (onSaleCompleted) onSaleCompleted();

    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Terjadi kesalahan saat memproses transaksi ke Supabase');
      playBeep('alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      {/* Top Bar: Clean Minimalist Search, Barcode & Category Pills */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-gray-200/80 mb-5">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Input (Clean Minimalism Rounded-Full) */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari produk (Barcode / Nama)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-9 py-2.5 bg-gray-100 border-none rounded-full text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Barcode scanner simulator */}
          <form onSubmit={handleBarcodeSubmit} className="w-full md:w-auto flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Barcode className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Scan / Input Barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-11 pr-3 py-2.5 bg-gray-100 border-none rounded-full text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#2E7D32] outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <span>+ Scan</span>
            </button>
          </form>
        </div>

        {/* Barcode feedback notification */}
        {barcodeFeedback && (
          <div className="mt-3 py-1.5 px-3.5 rounded-lg bg-emerald-50 text-[#1B5E20] border border-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[#2E7D32]" />
            <span>{barcodeFeedback}</span>
          </div>
        )}

        {/* Category Pills (Clean Minimalism pill design) */}
        <div className="flex gap-2 overflow-x-auto pb-1 mt-4 pt-3 border-t border-gray-100 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#2E7D32] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area: Products Grid + Cart Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Products Grid (Clean Minimalism 3-4 column cards) */}
        <div className="lg:col-span-7 xl:col-span-8">
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200/80 shadow-xs">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="font-bold text-gray-800">Produk Tidak Ditemukan</h4>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada barang yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Belum ada produk di etalase Toko Berkah. Tambahkan di menu Stok.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const inCart = cart.find((item) => item.product.id === product.id);
                const isLowStock = product.stock_kg <= (product.min_stock || 10);
                const isOutOfStock = product.stock_kg <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`group bg-white p-4 rounded-xl shadow-xs border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none relative ${
                      inCart
                        ? 'border-[#2E7D32] ring-2 ring-[#2E7D32]/20 shadow-sm'
                        : 'border-transparent hover:border-[#2E7D32] hover:shadow-md'
                    } ${isOutOfStock ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'active:scale-[0.99]'}`}
                  >
                    {/* Visual Media Placeholder or Image Area */}
                    <div className="w-full h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-[#2E7D32] transition-colors">
                          <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
                          <span className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">
                            {product.category || 'Sembako'}
                          </span>
                        </div>
                      )}

                      {/* In-cart indicator chip */}
                      {inCart && (
                        <span className="absolute top-2 right-2 bg-[#2E7D32] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs animate-scaleIn">
                          {inCart.qty} {inCart.unit}
                        </span>
                      )}
                    </div>

                    {/* Product Name & Barcode */}
                    <div className="mb-2">
                      <h3 className="font-bold text-sm text-gray-900 line-clamp-2 group-hover:text-[#2E7D32] transition-colors leading-snug">
                        {product.name}
                      </h3>
                      {product.barcode && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{product.barcode}</p>
                      )}
                    </div>

                    {/* Price & Stock info */}
                    <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                      <span className="text-[#2E7D32] font-bold text-sm sm:text-base">
                        {formatRupiah(product.selling_price)}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-[#2E7D32]'
                        }`}
                      >
                        {isOutOfStock ? 'Habis' : `Stok: ${formatStock(product.stock_kg, product.unit || 'kg')}`}
                      </span>
                    </div>

                    {/* Quick weight variant shortcut buttons on card */}
                    {!isOutOfStock && (
                      <div
                        className="mt-2 pt-1.5 border-t border-gray-100 flex items-center gap-1 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => addToCart(product, 1)}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-[#2E7D32] border border-gray-200 hover:border-emerald-300 transition-colors cursor-pointer"
                          title="Tambah 1 ke keranjang"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => addToCart(product, 0.5)}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors cursor-pointer"
                          title="Tambah Setengah (0.5) ke keranjang"
                        >
                          +0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => addToCart(product, 0.25)}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors cursor-pointer"
                          title="Tambah Saparapat (0.25) ke keranjang"
                        >
                          +0.25
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickQtyModalProduct(product);
                            setCustomQtyInput(inCart ? String(inCart.qty) : '1');
                          }}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors ml-auto flex items-center gap-0.5 cursor-pointer"
                          title="Pilih Kuantitas / Berat Kustom"
                        >
                          <Scale className="w-2.5 h-2.5" />
                          <span>Pilih</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Side Panel / Aside (Clean Minimalism Pesanan Aktif) */}
        <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-24">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200/80 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
            {/* Cart Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-gray-900">Pesanan Aktif</h2>
                <span className="text-xs bg-emerald-100 text-[#2E7D32] font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearCartClick}
                  className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                  title="Hapus seluruh pesanan di keranjang"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>HAPUS</span>
                </button>
              ) : (
                <span className="text-gray-300 text-xs font-bold uppercase tracking-wider select-none">
                  HAPUS
                </span>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-gray-100 pr-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                  <ShoppingBag className="w-12 h-12 mb-2 stroke-[1.2] text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700">Keranjang Masih Kosong</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs">
                    Pilih produk pada daftar di samping untuk menambahkan item ke pesanan.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const presets = getQuickPresets(item.unit || item.product.unit);
                  const currentAlias = getWeightAlias(item.qty, item.unit || item.product.unit);
                  const isKgUnit = (item.unit || item.product.unit || 'kg').toLowerCase().includes('kg');
                  const isEditingSubtotal = editingSubtotalItemId === item.product.id;
                  const isGramOpen = activeGramItemId === item.product.id;
                  const hasCustomSubtotal = item.custom_subtotal !== null && item.custom_subtotal !== undefined;
                  const standardSubtotal = Math.round(item.qty * item.product.selling_price);

                  return (
                    <div key={item.product.id} className="pt-3.5 first:pt-0 group">
                      {/* Product details & Stepper */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-semibold text-gray-800 line-clamp-1">
                              {item.product.name}
                            </h4>
                            {currentAlias && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-[#2E7D32] rounded border border-emerald-200">
                                {currentAlias}
                              </span>
                            )}
                            {hasCustomSubtotal && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200 flex items-center gap-0.5">
                                <Edit3 className="w-2.5 h-2.5" /> Nego/Kustom
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mt-0.5 flex-wrap">
                            <span>{formatRupiah(item.product.selling_price)}</span>
                            <span>x</span>
                            <span className="text-gray-800 font-semibold">
                              {item.qty < 1 && isKgUnit
                                ? `${roundStock(item.qty * 1000)} gr (${item.qty} kg)`
                                : formatStock(item.qty, item.unit || item.product.unit)}
                            </span>
                            <span className="text-gray-300">•</span>
                            {hasCustomSubtotal ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="line-through text-gray-400 text-[11px]">
                                  {formatRupiah(standardSubtotal)}
                                </span>
                                <span
                                  onClick={() => handleStartEditSubtotal(item.product.id, item.subtotal)}
                                  className="text-[#2E7D32] font-bold cursor-pointer hover:underline"
                                  title="Klik untuk edit subtotal"
                                >
                                  {formatRupiah(item.subtotal)}
                                </span>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleStartEditSubtotal(item.product.id, item.subtotal)}
                                className="text-[#2E7D32] font-bold cursor-pointer hover:underline"
                                title="Klik untuk edit subtotal / harga nego"
                              >
                                {formatRupiah(item.subtotal)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Direct Decimal Stepper & Trash Button */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const step = item.qty <= 0.25 ? 0.05 : item.qty <= 1 ? 0.25 : 1;
                              updateItemQty(item.product.id, roundStock(item.qty - step), true);
                            }}
                            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-600 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                            title="Kurangi kuantitas"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.qty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                updateItemQty(item.product.id, val, true);
                              } else if (e.target.value === '') {
                                updateItemQty(item.product.id, 0, true);
                              }
                            }}
                            className="w-14 text-center text-xs font-bold py-1 px-1 border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] bg-gray-50 hover:bg-white transition-colors font-mono text-gray-900"
                            title="Ketik angka desimal langsung (contoh: 0.25, 0.5, 1.25)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const step = item.qty < 1 ? 0.25 : 1;
                              updateItemQty(item.product.id, roundStock(item.qty + step), true);
                            }}
                            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-600 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                            title="Tambah kuantitas"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer"
                            title={`Hapus ${item.product.name} dari keranjang`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Subtotal Editor (Harga Nego / Pembulatan) */}
                      {isEditingSubtotal && (
                        <div className="mt-2 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                              <Edit3 className="w-3 h-3 text-amber-700" /> Edit Subtotal / Harga Nego:
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingSubtotalItemId(null)}
                              className="text-[10px] text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
                            >
                              Tutup
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                                Rp
                              </span>
                              <input
                                type="number"
                                step="500"
                                min="0"
                                value={subtotalInputMap[item.product.id] ?? String(item.subtotal)}
                                onChange={(e) =>
                                  setSubtotalInputMap((prev) => ({
                                    ...prev,
                                    [item.product.id]: e.target.value,
                                  }))
                                }
                                placeholder={String(item.subtotal)}
                                className="w-full pl-8 pr-2 py-1 text-xs font-bold font-mono rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-gray-900"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveSubtotal(item.product.id);
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveSubtotal(item.product.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              Simpan
                            </button>
                            {hasCustomSubtotal && (
                              <button
                                type="button"
                                onClick={() => handleResetSubtotal(item.product.id)}
                                className="px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer flex items-center gap-0.5"
                                title="Reset ke kalkulasi normal (qty x harga)"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-amber-800/80">
                            <span>Harga Normal: {formatRupiah(standardSubtotal)}</span>
                            <span>Hanya berlaku di transaksi ini</span>
                          </div>
                        </div>
                      )}

                      {/* Inline Gram Input (Custom Qty berbasis Gram) */}
                      {isGramOpen && (
                        <div className="mt-2 p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#1B5E20] flex items-center gap-1">
                              <Scale className="w-3 h-3 text-[#2E7D32]" /> Input Gram (Konversi Otomatis ke Kg):
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveGramItemId(null)}
                              className="text-[10px] text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
                            >
                              Tutup
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                step="10"
                                min="1"
                                value={
                                  gramInputMap[item.product.id] ?? String(roundStock(item.qty * 1000))
                                }
                                onChange={(e) => handleGramInputChange(item.product.id, e.target.value)}
                                placeholder="Contoh: 150, 250, 800"
                                className="w-full px-2.5 py-1 text-xs font-bold font-mono rounded-lg border border-emerald-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-gray-900 pr-12"
                                autoFocus
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">
                                gram
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#2E7D32] font-mono px-1 whitespace-nowrap">
                              = {item.qty} kg
                            </span>
                          </div>
                          {/* Quick Gram Presets */}
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            <span className="text-[9px] text-emerald-800 font-semibold">Pilihan Gram:</span>
                            {[100, 150, 200, 250, 500, 750, 800].map((gr) => (
                              <button
                                key={gr}
                                type="button"
                                onClick={() => handleSetGramPreset(item.product.id, gr)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors cursor-pointer ${
                                  roundStock(item.qty * 1000) === gr
                                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                                    : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                                }`}
                              >
                                {gr}g
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick Quantity Shortcut Badges + Tool Buttons */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-medium">Pintas:</span>
                        {presets.map((preset) => {
                          const isSelected = roundStock(item.qty) === roundStock(preset.qty);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => updateItemQty(item.product.id, preset.qty)}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer active:scale-95 border ${
                                isSelected
                                  ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-2xs font-bold ring-1 ring-[#2E7D32]/30'
                                  : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 border-emerald-200/70'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}

                        {/* Input Gram Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (activeGramItemId === item.product.id) {
                              setActiveGramItemId(null);
                            } else {
                              setActiveGramItemId(item.product.id);
                              setGramInputMap((prev) => ({
                                ...prev,
                                [item.product.id]: String(roundStock(item.qty * 1000)),
                              }));
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer active:scale-95 border flex items-center gap-0.5 ${
                            isGramOpen
                              ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-[#2E7D32] border-emerald-300'
                          }`}
                          title="Input kuantitas dalam satuan Gram"
                        >
                          <Scale className="w-2.5 h-2.5" />
                          <span>Input Gram</span>
                        </button>

                        {/* Editable Subtotal Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingSubtotal) {
                              setEditingSubtotalItemId(null);
                            } else {
                              handleStartEditSubtotal(item.product.id, item.subtotal);
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer active:scale-95 border flex items-center gap-0.5 ${
                            hasCustomSubtotal
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 font-bold'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                          }`}
                          title="Ubah Subtotal secara manual (Harga Nego / Pembulatan)"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>{hasCustomSubtotal ? 'Edit Nego' : 'Nego/Subtotal'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order Calculations & Interactive Payment Section */}
            <div className="mt-auto border-t border-gray-100 bg-white">
              {/* Calculations */}
              <div className="p-4 sm:p-5 space-y-1.5 border-b border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">{formatRupiah(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Pajak (0%)</span>
                  <span>Rp 0</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total Tagihan</span>
                  <span className="text-[#2E7D32] text-lg font-extrabold">{formatRupiah(totalAmount)}</span>
                </div>
              </div>

              {/* Payment Method Selector Pills */}
              <div className="px-4 sm:px-5 pt-3 pb-2 bg-gray-50/80">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => {
                      setPaymentMethod('CASH');
                      if (!cashGiven) setCashGiven(totalAmount);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      paymentMethod === 'CASH'
                        ? 'bg-[#2E7D32] text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai</span>
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => {
                      setPaymentMethod('QRIS');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      paymentMethod === 'QRIS'
                        ? 'bg-[#2E7D32] text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Debit / QRIS</span>
                  </button>
                </div>
              </div>

              {/* TUNAI Mode: Uang Diterima & Otomatis Kembalian */}
              {paymentMethod === 'CASH' && (
                <div className="p-4 sm:p-5 bg-gray-50/80 border-t border-gray-100 space-y-3">
                  {/* Uang Diterima Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-[#2E7D32]" />
                        <span>Uang Diterima (Tunai)</span>
                      </label>
                      {cashGiven !== '' && (
                        <button
                          type="button"
                          onClick={() => setCashGiven('')}
                          className="text-[11px] text-gray-400 hover:text-rose-600 font-medium"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={formatRupiah(totalAmount).replace('Rp', '').trim()}
                        value={cashGiven !== '' ? Number(cashGiven).toLocaleString('id-ID') : ''}
                        onChange={(e) => handleCashInputChange(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-white rounded-xl border border-gray-200 font-mono text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#2E7D32] outline-none transition-all"
                      />
                    </div>

                    {/* Quick nominal presets */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cashPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCashGiven(preset)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all ${
                            numericCashGiven === preset
                              ? 'bg-[#2E7D32] text-white shadow-2xs'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {preset === totalAmount ? 'Uang Pas' : formatRupiah(preset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kembalian Otomatis Display */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      cashShortage > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : isCashGivenEntered
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-gray-100/80 border-gray-200 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Coins className={`w-4 h-4 ${cashShortage > 0 ? 'text-rose-600' : 'text-[#2E7D32]'}`} />
                        <span>{cashShortage > 0 ? 'Uang Kurang:' : 'Jumlah Kembalian:'}</span>
                      </div>
                      <span
                        className={`font-mono text-base font-extrabold ${
                          cashShortage > 0
                            ? 'text-rose-700'
                            : isCashGivenEntered
                            ? 'text-[#1B5E20]'
                            : 'text-gray-700'
                        }`}
                      >
                        {cashShortage > 0 ? formatRupiah(cashShortage) : formatRupiah(changeAmount)}
                      </span>
                    </div>
                    {isCashGivenEntered && changeAmount === 0 && !cashShortage && (
                      <p className="text-[10px] text-[#2E7D32] mt-0.5 font-medium">Uang pas, tidak ada kembalian.</p>
                    )}
                  </div>

                  {/* Selesaikan Transaksi Tunai Button */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || isSubmitting || cashShortage > 0}
                    onClick={() => handleProcessCheckout('CASH')}
                    className="w-full py-3 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#2E7D32]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan Transaksi...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Bayar Tunai & Cetak Struk</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* QRIS Mode Section */}
              {paymentMethod === 'QRIS' && (
                <div className="p-4 sm:p-5 bg-gray-50/80 border-t border-gray-100 space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                    <p className="text-xs text-blue-900 font-medium">
                      Scan QRIS senilai <strong className="text-[#1B5E20]">{formatRupiah(totalAmount)}</strong>
                    </p>
                    <p className="text-[11px] text-blue-600 mt-0.5">Pastikan pembayaran telah berhasil diterima</p>
                  </div>
                  <button
                    type="button"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={() => handleOpenCheckout('QRIS')}
                    className="w-full py-3 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#2E7D32]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Lanjut Bayar via QRIS</span>
                  </button>
                </div>
              )}

              {/* Extra options shortcut (Bon Utang / Catatan / Pelanggan) */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => handleOpenCheckout('UTANG')}
                  className="text-amber-700 hover:text-amber-900 font-semibold hover:underline flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  <span>Catat Bon / Utang</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCheckout()}
                  className="text-gray-500 hover:text-gray-800 font-medium hover:underline"
                >
                  Opsi Tambahan +
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Floating Cart Summary Button (Shown when cart has items) */}
      <div className="lg:hidden fixed bottom-18 left-3 right-3 z-30">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className={`w-full py-3 px-4 rounded-2xl shadow-xl flex items-center justify-between text-white font-bold transition-all ${
            cart.length > 0 ? 'bg-[#2E7D32] active:scale-[0.98]' : 'bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-emerald-100">
                {cart.length} macam barang ({totalItemsCount} total)
              </p>
              <p className="text-sm font-bold">{formatRupiah(totalAmount)}</p>
            </div>
          </div>
          <span className="text-xs bg-white text-[#2E7D32] px-3 py-1.5 rounded-xl font-bold">
            Buka Kasir →
          </span>
        </button>
      </div>

      {/* Mobile Cart Sheet / Modal */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
            {/* Sheet Header */}
            <div className="p-4 bg-emerald-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#2E7D32]" />
                <h3 className="font-bold text-gray-900">Rincian Belanja ({cart.length})</h3>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCartClick}
                    className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-100/80 hover:bg-red-200 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>HAPUS</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-gray-100">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-gray-500">Keranjang masih kosong</div>
              ) : (
                cart.map((item) => {
                  const presets = getQuickPresets(item.unit || item.product.unit);
                  const currentAlias = getWeightAlias(item.qty, item.unit || item.product.unit);
                  const isKgUnit = (item.unit || item.product.unit || 'kg').toLowerCase().includes('kg');
                  const isEditingSubtotal = editingSubtotalItemId === item.product.id;
                  const isGramOpen = activeGramItemId === item.product.id;
                  const hasCustomSubtotal = item.custom_subtotal !== null && item.custom_subtotal !== undefined;
                  const standardSubtotal = Math.round(item.qty * item.product.selling_price);

                  return (
                    <div key={item.product.id} className="pt-3.5 first:pt-0">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-gray-900 line-clamp-1">
                              {item.product.name}
                            </h4>
                            {currentAlias && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-[#2E7D32] rounded border border-emerald-200">
                                {currentAlias}
                              </span>
                            )}
                            {hasCustomSubtotal && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200 flex items-center gap-0.5">
                                <Edit3 className="w-2.5 h-2.5" /> Nego
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mt-0.5 flex-wrap">
                            <span>{formatRupiah(item.product.selling_price)}</span>
                            <span>x</span>
                            <span className="text-gray-800 font-semibold">
                              {item.qty < 1 && isKgUnit
                                ? `${roundStock(item.qty * 1000)} gr (${item.qty} kg)`
                                : formatStock(item.qty, item.unit || item.product.unit)}
                            </span>
                            <span className="text-gray-300">•</span>
                            {hasCustomSubtotal ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="line-through text-gray-400 text-[10px]">
                                  {formatRupiah(standardSubtotal)}
                                </span>
                                <span
                                  onClick={() => handleStartEditSubtotal(item.product.id, item.subtotal)}
                                  className="text-[#2E7D32] font-bold"
                                >
                                  {formatRupiah(item.subtotal)}
                                </span>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleStartEditSubtotal(item.product.id, item.subtotal)}
                                className="text-[#2E7D32] font-bold"
                              >
                                {formatRupiah(item.subtotal)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-rose-600 p-1 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 text-[11px]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>

                      {/* Stepper + Quick Action Buttons */}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50">
                          <button
                            type="button"
                            onClick={() => {
                              const step = item.qty <= 0.25 ? 0.05 : item.qty <= 1 ? 0.25 : 1;
                              updateItemQty(item.product.id, roundStock(item.qty - step), true);
                            }}
                            className="px-2.5 py-1.5 text-gray-700"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.qty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                updateItemQty(item.product.id, val, true);
                              } else if (e.target.value === '') {
                                updateItemQty(item.product.id, 0, true);
                              }
                            }}
                            className="w-14 text-center text-xs font-bold py-1 outline-none bg-transparent font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const step = item.qty < 1 ? 0.25 : 1;
                              updateItemQty(item.product.id, roundStock(item.qty + step), true);
                            }}
                            className="px-2.5 py-1.5 text-gray-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (activeGramItemId === item.product.id) {
                                setActiveGramItemId(null);
                              } else {
                                setActiveGramItemId(item.product.id);
                                setGramInputMap((prev) => ({
                                  ...prev,
                                  [item.product.id]: String(roundStock(item.qty * 1000)),
                                }));
                              }
                            }}
                            className={`text-[11px] px-2 py-1 rounded-lg font-semibold border flex items-center gap-0.5 ${
                              isGramOpen
                                ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                                : 'bg-emerald-50 text-[#2E7D32] border-emerald-300'
                            }`}
                          >
                            <Scale className="w-3 h-3" />
                            <span>Gram</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingSubtotal) {
                                setEditingSubtotalItemId(null);
                              } else {
                                handleStartEditSubtotal(item.product.id, item.subtotal);
                              }
                            }}
                            className={`text-[11px] px-2 py-1 rounded-lg font-semibold border flex items-center gap-0.5 ${
                              hasCustomSubtotal
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                : 'bg-gray-100 text-gray-700 border-gray-300'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{hasCustomSubtotal ? 'Nego' : 'Harga'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Mobile Inline Subtotal Editor */}
                      {isEditingSubtotal && (
                        <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                              <Edit3 className="w-3 h-3 text-amber-700" /> Edit Subtotal / Harga Nego:
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingSubtotalItemId(null)}
                              className="text-[10px] text-gray-500 hover:text-gray-800"
                            >
                              Tutup
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                                Rp
                              </span>
                              <input
                                type="number"
                                step="500"
                                min="0"
                                value={subtotalInputMap[item.product.id] ?? String(item.subtotal)}
                                onChange={(e) =>
                                  setSubtotalInputMap((prev) => ({
                                    ...prev,
                                    [item.product.id]: e.target.value,
                                  }))
                                }
                                placeholder={String(item.subtotal)}
                                className="w-full pl-8 pr-2 py-1 text-xs font-bold font-mono rounded-lg border border-amber-300 bg-white focus:outline-none text-gray-900"
                                autoFocus
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveSubtotal(item.product.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-[#2E7D32] text-white rounded-lg"
                            >
                              Simpan
                            </button>
                            {hasCustomSubtotal && (
                              <button
                                type="button"
                                onClick={() => handleResetSubtotal(item.product.id)}
                                className="px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-0.5"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Mobile Inline Gram Input */}
                      {isGramOpen && (
                        <div className="mt-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#1B5E20] flex items-center gap-1">
                              <Scale className="w-3 h-3 text-[#2E7D32]" /> Input Gram (Otomatis ke Kg):
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveGramItemId(null)}
                              className="text-[10px] text-gray-500 hover:text-gray-800"
                            >
                              Tutup
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                step="10"
                                min="1"
                                value={
                                  gramInputMap[item.product.id] ?? String(roundStock(item.qty * 1000))
                                }
                                onChange={(e) => handleGramInputChange(item.product.id, e.target.value)}
                                placeholder="Contoh: 150, 250, 800"
                                className="w-full px-2.5 py-1 text-xs font-bold font-mono rounded-lg border border-emerald-300 bg-white focus:outline-none text-gray-900 pr-12"
                                autoFocus
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">
                                gram
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#2E7D32] font-mono px-1 whitespace-nowrap">
                              = {item.qty} kg
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            {[100, 150, 200, 250, 500, 750, 800].map((gr) => (
                              <button
                                key={gr}
                                type="button"
                                onClick={() => handleSetGramPreset(item.product.id, gr)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors ${
                                  roundStock(item.qty * 1000) === gr
                                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                                    : 'bg-white text-emerald-900 border-emerald-200'
                                }`}
                              >
                                {gr}g
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mobile Quick Presets */}
                      <div className="flex items-center gap-1 overflow-x-auto py-1 mt-1 scrollbar-none">
                        {presets.map((preset) => {
                          const isSelected = roundStock(item.qty) === roundStock(preset.qty);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => updateItemQty(item.product.id, preset.qty)}
                              className={`text-[10px] px-2 py-1 rounded-md font-semibold whitespace-nowrap transition-all border ${
                                isSelected
                                  ? 'bg-[#2E7D32] text-white border-[#2E7D32] font-bold'
                                  : 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile Sheet Footer with Cash & Kembalian */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="flex justify-between items-center text-gray-900 font-bold">
                <span className="text-sm">Total Bayar:</span>
                <span className="text-[#1B5E20] text-xl">{formatRupiah(totalAmount)}</span>
              </div>

              {/* Payment Method Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CASH');
                    if (!cashGiven) setCashGiven(totalAmount);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'bg-[#2E7D32] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Tunai</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'QRIS'
                      ? 'bg-[#2E7D32] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>QRIS</span>
                </button>
              </div>

              {/* Mobile Cash Input & Kembalian */}
              {paymentMethod === 'CASH' && (
                <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Uang Diterima (Tunai)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={formatRupiah(totalAmount).replace('Rp', '').trim()}
                        value={cashGiven !== '' ? Number(cashGiven).toLocaleString('id-ID') : ''}
                        onChange={(e) => handleCashInputChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 font-mono text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#2E7D32] outline-none"
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {cashPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCashGiven(preset)}
                          className={`px-2 py-0.5 text-[11px] rounded-lg font-semibold transition-all ${
                            numericCashGiven === preset
                              ? 'bg-[#2E7D32] text-white shadow-2xs'
                              : 'bg-gray-50 border border-gray-200 text-gray-700'
                          }`}
                        >
                          {preset === totalAmount ? 'Pas' : formatRupiah(preset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kembalian */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-semibold ${
                      cashShortage > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : isCashGivenEntered
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <span>{cashShortage > 0 ? 'Uang Kurang:' : 'Kembalian:'}</span>
                    <span className="font-mono text-sm font-bold text-[#1B5E20]">
                      {cashShortage > 0 ? formatRupiah(cashShortage) : formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              <button
                disabled={cart.length === 0 || isSubmitting || (paymentMethod === 'CASH' && cashShortage > 0)}
                onClick={() => handleProcessCheckout()}
                className="w-full py-3.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-base shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{paymentMethod === 'CASH' ? 'Bayar Tunai & Cetak Struk' : 'Konfirmasi Pembayaran'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Payment Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-[#2E7D32] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Pembayaran Kasir</h3>
                <p className="text-xs text-emerald-100">Pilih metode & selesaikan transaksi</p>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Total Summary */}
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <span className="text-emerald-900 font-medium">Total yang harus dibayar:</span>
                <span className="text-xl font-bold text-[#1B5E20]">{formatRupiah(totalAmount)}</span>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'CASH', label: 'Tunai (Cash)', icon: Banknote },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                    { id: 'UTANG', label: 'Utang / Bon', icon: Clock },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as any);
                          if (m.id === 'CASH') setCashGiven(totalAmount);
                        }}
                        className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'border-[#2E7D32] bg-emerald-50 text-[#1B5E20] font-bold shadow-xs'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-[#2E7D32]' : 'text-gray-500'}`} />
                        <span className="text-xs">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CASH Payment Fields */}
              {paymentMethod === 'CASH' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Uang Diterima (Tunai)
                      </label>
                      {cashGiven !== '' && (
                        <button
                          type="button"
                          onClick={() => setCashGiven('')}
                          className="text-[11px] text-gray-400 hover:text-rose-600 font-medium"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashGiven !== '' ? Number(cashGiven).toLocaleString('id-ID') : ''}
                        onChange={(e) => handleCashInputChange(e.target.value)}
                        placeholder={formatRupiah(totalAmount).replace('Rp', '').trim()}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 font-mono text-base font-bold focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Cash Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {cashPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashGiven(preset)}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-colors ${
                          numericCashGiven === preset
                            ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {preset === totalAmount ? 'Uang Pas' : formatRupiah(preset)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Otomatis */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      cashShortage > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : isCashGivenEntered
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-gray-100/80 border-gray-200 text-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Coins className={`w-4 h-4 ${cashShortage > 0 ? 'text-rose-600' : 'text-[#2E7D32]'}`} />
                        <span>{cashShortage > 0 ? 'Uang Kurang:' : 'Jumlah Kembalian:'}</span>
                      </div>
                      <span
                        className={`font-mono text-lg font-extrabold ${
                          cashShortage > 0
                            ? 'text-rose-700'
                            : isCashGivenEntered
                            ? 'text-[#1B5E20]'
                            : 'text-gray-700'
                        }`}
                      >
                        {cashShortage > 0 ? formatRupiah(cashShortage) : formatRupiah(changeAmount)}
                      </span>
                    </div>
                    {isCashGivenEntered && changeAmount === 0 && !cashShortage && (
                      <p className="text-[10px] text-[#2E7D32] mt-0.5 font-medium">Uang pas, tidak ada kembalian.</p>
                    )}
                  </div>
                </div>
              )}

              {/* UTANG Payment Fields */}
              {paymentMethod === 'UTANG' && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Catat ke Buku Utang / Piutang</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nama Pelanggan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Bu Siti / Pak Budi"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:border-[#2E7D32] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      No. WhatsApp / HP (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 08123456789"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:border-[#2E7D32] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Jatuh Tempo Pembayaran
                    </label>
                    <input
                      type="date"
                      value={debtDueDate}
                      onChange={(e) => setDebtDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:border-[#2E7D32] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* QRIS / TRANSFER Notice */}
              {(paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-2">
                  <p className="text-xs text-blue-900 font-medium">
                    Pastikan pembayaran senilai <strong className="text-[#1B5E20]">{formatRupiah(totalAmount)}</strong> telah berhasil masuk ke rekening / QRIS Toko Berkah.
                  </p>
                  <div>
                    <label className="block text-xs text-gray-600 text-left mb-1">Nama Pelanggan (Opsional):</label>
                    <input
                      type="text"
                      placeholder="Contoh: Ibu Rina"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:border-[#2E7D32] outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Catatan Transaksi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:border-[#2E7D32] outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleProcessCheckout}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan ke Supabase...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Konfirmasi & Selesaikan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Custom Quantity / Scale Weight Modal */}
      {quickQtyModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center border border-emerald-100">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Tentukan Berat / Kuantitas
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    {quickQtyModalProduct.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickQtyModalProduct(null)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Product Info & Unit Price */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/70 flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-500 block">Harga Satuan</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {formatRupiah(quickQtyModalProduct.selling_price)} / {quickQtyModalProduct.unit || 'kg'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 block">Sisa Stok</span>
                  <span className="font-semibold text-emerald-700">
                    {formatStock(quickQtyModalProduct.stock_kg, quickQtyModalProduct.unit || 'kg')}
                  </span>
                </div>
              </div>

              {/* Input Value with Unit */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Input Kuantitas / Berat Desimal:
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    autoFocus
                    value={customQtyInput}
                    onChange={(e) => setCustomQtyInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#2E7D32] text-xl font-bold text-gray-900 outline-none pr-16 font-mono focus:ring-4 focus:ring-[#2E7D32]/15 transition-all"
                    placeholder="Contoh: 0.25 atau 0.5"
                  />
                  <span className="absolute right-4 text-sm font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                    {quickQtyModalProduct.unit || 'kg'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1 text-gray-500">
                  <span>Pecahan: {getWeightAlias(parseFloat(customQtyInput) || 0, quickQtyModalProduct.unit || 'kg') || '-'}</span>
                  <span>Presisi 3 desimal</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="text-[11px] font-semibold text-gray-500 block mb-1.5">
                  Pilihan Cepat Varian Berat:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {getQuickPresets(quickQtyModalProduct.unit).map((preset) => {
                    const isSelected = roundStock(parseFloat(customQtyInput) || 0) === roundStock(preset.qty);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCustomQtyInput(String(preset.qty))}
                        className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                            : 'bg-gray-50 hover:bg-emerald-50 text-gray-700 border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subtotal Calculation Box */}
              {(() => {
                const parsedQty = parseFloat(customQtyInput) || 0;
                const subtotal = Math.round(roundStock(parsedQty) * quickQtyModalProduct.selling_price);
                return (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium block">
                        Kalkulasi Subtotal:
                      </span>
                      <span className="text-xs text-gray-600 font-mono">
                        {formatStock(parsedQty, quickQtyModalProduct.unit || 'kg')} x {formatRupiah(quickQtyModalProduct.selling_price)}
                      </span>
                    </div>
                    <span className="text-base font-extrabold text-[#1B5E20] font-mono">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuickQtyModalProduct(null)}
                className="py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const parsed = parseFloat(customQtyInput);
                  if (!isNaN(parsed) && parsed > 0) {
                    const inCart = cart.find((item) => item.product.id === quickQtyModalProduct.id);
                    if (inCart) {
                      updateItemQty(quickQtyModalProduct.id, parsed);
                    } else {
                      addToCart(quickQtyModalProduct, parsed);
                    }
                    setQuickQtyModalProduct(null);
                  }
                }}
                className="py-2.5 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Terapkan Pesanan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cart Confirmation Dialog / Modal */}
      {isClearCartConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 text-base">
              Kosongkan semua pesanan di keranjang?
            </h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Tindakan ini akan menghapus seluruh <strong className="text-gray-800">{cart.length} item</strong> belanja dari daftar pesanan aktif dan mereset total tagihan.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsClearCartConfirmOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCart}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptData.isOpen}
        onClose={() => setReceiptData((prev) => ({ ...prev, isOpen: false }))}
        saleId={receiptData.saleId}
        items={receiptData.items}
        totalAmount={receiptData.totalAmount}
        cashReceived={receiptData.cashReceived}
        changeAmount={receiptData.changeAmount}
        paymentMethod={receiptData.paymentMethod}
        customerName={receiptData.customerName}
        storeProfile={storeProfile}
        onUpdateStoreProfile={onUpdateStoreProfile}
      />
    </div>
  );
};
