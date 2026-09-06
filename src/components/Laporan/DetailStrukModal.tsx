import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  CheckCircle2, 
  Calendar, 
  User, 
  CreditCard, 
  Package, 
  ShoppingBag, 
  Copy, 
  Check, 
  Clock, 
  FileText,
  AlertCircle,
  MessageCircle,
  Trash2
} from 'lucide-react';
import { Sale, SaleItem } from '../../types';
import { formatRupiah, formatDateTime, formatStock, formatStockWithAlias } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { deleteSaleItem } from '../../services/api';

interface DetailStrukModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onPrintReceipt: (sale: Sale) => void;
  onSaleUpdated?: (updatedSale: Sale) => void;
}

export const DetailStrukModal: React.FC<DetailStrukModalProps> = ({
  isOpen,
  onClose,
  sale,
  onPrintReceipt,
  onSaleUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [loadedItems, setLoadedItems] = useState<SaleItem[]>([]);
  const [currentSale, setCurrentSale] = useState<Sale | null>(sale);
  const [itemToDelete, setItemToDelete] = useState<SaleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoreStock, setRestoreStock] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setCurrentSale(sale);
    if (!sale) {
      setLoadedItems([]);
      return;
    }

    const currentItems = sale.items || sale.sale_items || [];
    if (currentItems.length > 0) {
      setLoadedItems(currentItems);
      return;
    }

    // Dynamic fetch/join if items are not present on the sale object
    let isMounted = true;
    const fetchItemsRelation = async () => {
      try {
        // 1. Check sale_items in Supabase
        const { data: dbItems } = await supabase
          .from('sale_items')
          .select('*, product:products(*)')
          .eq('sale_id', sale.id);

        if (dbItems && dbItems.length > 0 && isMounted) {
          const formatted: SaleItem[] = dbItems.map((it: any) => ({
            id: it.id,
            sale_id: it.sale_id,
            product_id: it.product_id,
            qty_kg: Number(it.qty_kg) || Number(it.original_qty) || 1,
            subtotal: Number(it.subtotal) || 0,
            cost_price: Number(it.cost_price) || 0,
            original_qty: Number(it.original_qty) || Number(it.qty_kg) || 1,
            unit: it.unit || it.product?.unit || 'pcs',
            product: it.product || {
              id: it.product_id,
              name: it.product_name || 'Barang Sembako',
              category: 'Sembako',
              selling_price: it.subtotal && it.qty_kg ? it.subtotal / it.qty_kg : 0,
              cost_price: it.cost_price || 0,
              stock_kg: 0,
              min_stock: 0,
              is_active: true,
              image_url: null,
              unit: it.unit || 'pcs',
              barcode: null
            }
          }));
          setLoadedItems(formatted);
          return;
        }

        // 2. If it's an online order, look up order by id or notes
        const orderMatch = (sale.notes || '').match(/#ORD-(\d+)/i) || (sale.notes || '').match(/ORD-(\d+)/i) || sale.id.match(/sale_online_(\d+)/i);
        if (orderMatch && orderMatch[1]) {
          const orderId = Number(orderMatch[1]);
          const { data: orderData } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

          if (orderData && orderData.items_json && isMounted) {
            let raw: any[] = [];
            if (Array.isArray(orderData.items_json)) {
              raw = orderData.items_json;
            } else if (typeof orderData.items_json === 'string') {
              try {
                raw = JSON.parse(orderData.items_json);
              } catch {
                raw = [];
              }
            }

            const formatted: SaleItem[] = raw.map((it: any, idx: number) => {
              const qty = Number(it.qty || it.quantity || it.amount || 1);
              const price = Number(it.price || it.selling_price || (it.subtotal ? it.subtotal / qty : 0));
              const subtotal = Number(it.subtotal || (price * qty) || 0);
              return {
                id: `item_modal_${orderId}_${idx}`,
                sale_id: sale.id,
                product_id: String(it.product_id || `prod_${idx}`),
                qty_kg: qty,
                subtotal: subtotal,
                cost_price: Number(it.cost_price) || (price * 0.8),
                original_qty: qty,
                unit: it.unit || it.satuan || 'pcs',
                product: {
                  id: String(it.product_id || `prod_${idx}`),
                  name: it.name || it.product_name || 'Barang Sembako',
                  category: 'Sembako',
                  cost_price: Number(it.cost_price) || (price * 0.8),
                  selling_price: price,
                  stock_kg: 100,
                  min_stock: 10,
                  is_active: true,
                  image_url: it.image_url || null,
                  unit: it.unit || it.satuan || 'pcs',
                  barcode: null
                }
              };
            });

            if (formatted.length > 0) {
              setLoadedItems(formatted);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading item relations for modal:', err);
      }
    };

    fetchItemsRelation();
    return () => { isMounted = false; };
  }, [sale]);

  if (!isOpen || !sale) return null;

  const activeSale = currentSale || sale;
  const items = loadedItems.length > 0 ? loadedItems : (activeSale.items || activeSale.sale_items || []);
  const isUtang = activeSale.payment_method === 'UTANG' || activeSale.status === 'unpaid';
  const totalQty = items.reduce((acc, it) => acc + (Number(it.qty_kg ?? it.qty ?? it.original_qty) || 1), 0);
  const totalItemTypes = items.length;

  const onlineOrderMatch = (activeSale.notes || '').match(/#ORD-(\d+)/i) || (activeSale.notes || '').match(/ORD-(\d+)/i);
  const isOnlineOrder = activeSale.id.startsWith('sale_online_') || Boolean(onlineOrderMatch) || (activeSale.notes || '').toLowerCase().includes('pesanan online');
  const displayId = onlineOrderMatch ? `#ORD-${onlineOrderMatch[1]}` : (isOnlineOrder ? `#ORD-${activeSale.id.replace('sale_online_', '').slice(0, 5)}` : `#${activeSale.id.slice(0, 8).toUpperCase()}`);

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmDeleteItem = async () => {
    if (!activeSale || !itemToDelete) return;
    setIsDeleting(true);
    try {
      const rawQty = itemToDelete.qty_kg ?? itemToDelete.qty ?? itemToDelete.original_qty ?? 1;
      const actualQty = Number(rawQty) || 1;
      const actualSubtotal = Number(itemToDelete.subtotal) || 0;
      const productId = itemToDelete.product_id || itemToDelete.product?.id || '';

      const res = await deleteSaleItem(
        activeSale.id,
        itemToDelete.id,
        productId,
        actualQty,
        actualSubtotal,
        restoreStock
      );

      if (res.success) {
        // Filter item dari daftar item modal
        const updatedItems = items.filter(it => 
          !((itemToDelete.id && it.id === itemToDelete.id) || (productId && (it.product_id === productId || it.product?.id === productId)))
        );
        setLoadedItems(updatedItems);

        const newTotal = Math.max(0, (activeSale.total_amount || 0) - actualSubtotal);
        const updatedSaleObj: Sale = res.updatedSale || {
          ...activeSale,
          total_amount: newTotal,
          items: updatedItems,
          sale_items: updatedItems,
        };
        setCurrentSale(updatedSaleObj);

        if (onSaleUpdated) {
          onSaleUpdated(updatedSaleObj);
        }

        const unitDisplay = itemToDelete.unit || itemToDelete.product?.unit || 'satuan';
        setNotification({
          type: 'success',
          message: `Item "${res.deletedItemName || itemToDelete.product?.name || 'Produk'}" berhasil dihapus dari transaksi.${
            restoreStock ? ` Stok toko bertambah +${res.restoredQty || actualQty} ${res.restoredUnit || unitDisplay}.` : ''
          }`
        });

        setItemToDelete(null);
        setTimeout(() => {
          setNotification(null);
        }, 5000);
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Gagal menghapus item dari transaksi.'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Terjadi kesalahan sistem saat menghapus item.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getPaymentBadge = (method: string) => {
    const m = (method || '').toUpperCase();
    if (m === 'COD' || m.includes('COD') || m.includes('BAYAR DI TEMPAT')) {
      return {
        label: 'COD (Bayar di Tempat)',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      };
    }
    if (m === 'CASH' || m === 'TUNAI') {
      return {
        label: 'Tunai / Cash',
        bg: 'bg-emerald-50 text-[#1B5E20] border-emerald-200',
      };
    }
    if (m === 'QRIS') {
      return {
        label: 'QRIS',
        bg: 'bg-blue-50 text-blue-800 border-blue-200',
      };
    }
    if (m === 'TRANSFER') {
      return {
        label: 'Transfer Bank',
        bg: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    }
    if (m === 'UTANG') {
      return {
        label: 'Utang / Bon',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      label: method,
      bg: 'bg-gray-100 text-gray-800 border-gray-200',
    };
  };

  const paymentBadge = getPaymentBadge(activeSale.payment_method);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] my-auto border border-gray-100">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Rincian Struk Belanja</h3>
              <p className="text-xs text-emerald-100/90 flex items-center gap-1.5 mt-0.5">
                <span>Nota {displayId}</span>
                <span>•</span>
                <span className="font-medium text-emerald-200">
                  {isUtang ? 'Belum Lunas (Utang)' : 'Transaksi Lunas'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-gray-700 text-sm relative">
          {/* Notification Banner */}
          {notification && (
            <div className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-2 transition-all ${
              notification.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs' 
                : 'bg-red-50 text-red-800 border border-red-200 shadow-2xs'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-medium">{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="p-1 hover:bg-black/5 rounded-md cursor-pointer text-gray-500 hover:text-gray-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Metadata Card */}
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200/70 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2.5 border-b border-gray-200/80">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span>ID Nota Transaksi:</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                <span>{displayId}</span>
                <button
                  onClick={handleCopyId}
                  title="Salin ID Nota"
                  className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-gray-400 flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Waktu Transaksi
                </span>
                <span className="font-semibold text-gray-800 block">
                  {formatDateTime(activeSale.created_at)}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-gray-400 flex items-center gap-1 font-medium">
                  <User className="w-3 h-3 text-gray-400" />
                  Kasir / Shift
                </span>
                <span className="font-semibold text-gray-800 block">
                  Petugas Shift #01
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-gray-400 flex items-center gap-1 font-medium">
                  <CreditCard className="w-3 h-3 text-gray-400" />
                  Metode Pembayaran
                </span>
                <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] border ${paymentBadge.bg}`}>
                  {paymentBadge.label}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-gray-400 flex items-center gap-1 font-medium">
                  <User className="w-3 h-3 text-gray-400" />
                  Pelanggan / Catatan
                </span>
                <span className="font-semibold text-gray-800 block truncate">
                  {activeSale.notes || activeSale.customer_name || 'Pelanggan Umum'}
                </span>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Rincian Produk Belanja ({totalItemTypes} Barang)</span>
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">
                Total Kuantitas: <strong>{totalQty}</strong>
              </span>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Produk</th>
                    <th className="px-2 py-2.5 text-center">Qty / Satuan</th>
                    <th className="px-2 py-2.5 text-right">Harga</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="px-2 py-2.5 text-center w-12">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-5 text-center text-gray-400">
                        Tidak ada item tersisa pada transaksi ini (Total Rp 0).
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const prodName = item.product?.name || 'Barang Sembako';
                      const unit = item.unit || item.product?.unit || 'kg';
                      const rawQty = item.qty_kg ?? item.qty ?? item.original_qty ?? 1;
                      const itemQty = Number(rawQty) || 1;
                      const unitPrice = item.product?.selling_price || (itemQty > 0 ? item.subtotal / itemQty : item.subtotal);
                      
                      return (
                        <tr key={item.id || idx} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                              {item.product?.image_url ? (
                                <img
                                  src={item.product.image_url}
                                  alt={prodName}
                                  className="w-7 h-7 rounded-lg object-cover border border-gray-200 shrink-0"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0 border border-emerald-100">
                                  <Package className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-semibold text-gray-900 block truncate">{prodName}</span>
                                {item.product?.category && (
                                  <span className="text-[10px] text-gray-400 block">{item.product.category}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center font-medium text-gray-700 whitespace-nowrap">
                            {formatStockWithAlias(itemQty, unit)}
                          </td>
                          <td className="px-2 py-2.5 text-right text-gray-500 font-mono whitespace-nowrap">
                            {formatRupiah(unitPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold font-mono text-gray-900 whitespace-nowrap">
                            {formatRupiah(item.subtotal)}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              title={`Hapus ${prodName} dari transaksi`}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer inline-flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Totals Breakdown */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 space-y-2">
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Subtotal Pembelian:</span>
              <span className="font-mono font-medium">{formatRupiah(activeSale.total_amount)}</span>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-1 border-t border-emerald-200/60">
              <span className="text-gray-900">TOTAL BELANJA:</span>
              <span className="text-base text-[#1B5E20] font-mono">
                {formatRupiah(activeSale.total_amount)}
              </span>
            </div>

            {activeSale.cash_received !== undefined && activeSale.cash_received > 0 && (
              <div className="pt-2 border-t border-dashed border-emerald-200/80 space-y-1 text-xs">
                <div className="flex justify-between text-gray-700">
                  <span>Tunai Diterima:</span>
                  <span className="font-mono font-semibold">{formatRupiah(activeSale.cash_received)}</span>
                </div>
                <div className="flex justify-between text-[#1B5E20] font-semibold">
                  <span>Uang Kembalian:</span>
                  <span className="font-mono">{formatRupiah(activeSale.change_amount || 0)}</span>
                </div>
              </div>
            )}

            {isUtang && (
              <div className="mt-2 p-2 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-semibold">
                  Status Transaksi: BON / PIUTANG BELUM LUNAS
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              onPrintReceipt({
                ...activeSale,
                items: items,
                sale_items: items,
              });
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white/20" />
            <span>Kirim WA</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onPrintReceipt({
                ...activeSale,
                items: items,
                sale_items: items,
              });
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Ulang</span>
          </button>
        </div>

        {/* Confirmation Modal: Delete Sale Item */}
        {itemToDelete && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 text-base">Hapus Item dari Transaksi?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Item ini akan dihapus dari riwayat nota transaksi <strong>{displayId}</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Nama Produk:</span>
                  <span className="font-semibold text-gray-900 text-right max-w-[200px] truncate">
                    {itemToDelete.product?.name || 'Produk Sembako'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Kuantitas:</span>
                  <span className="font-medium text-gray-800">
                    {formatStockWithAlias(
                      Number(itemToDelete.qty_kg ?? itemToDelete.qty ?? itemToDelete.original_qty ?? 1),
                      itemToDelete.unit || itemToDelete.product?.unit || 'satuan'
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Subtotal Item:</span>
                  <span className="font-mono font-bold text-red-600">
                    - {formatRupiah(itemToDelete.subtotal)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center font-bold">
                  <span className="text-gray-700">Total Transaksi Baru:</span>
                  <span className="font-mono text-emerald-700 text-sm">
                    {formatRupiah(Math.max(0, (activeSale.total_amount || 0) - (itemToDelete.subtotal || 0)))}
                  </span>
                </div>
              </div>

              {/* Checkbox Restock */}
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 cursor-pointer select-none hover:bg-emerald-50 transition-colors">
                <input
                  type="checkbox"
                  checked={restoreStock}
                  onChange={(e) => setRestoreStock(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#2E7D32] focus:ring-[#2E7D32] border-gray-300 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900 block">Kembalikan Stok Produk</span>
                  <span className="text-emerald-700 text-[11px] leading-relaxed">
                    Kuantitas barang ({formatStockWithAlias(
                      Number(itemToDelete.qty_kg ?? itemToDelete.qty ?? itemToDelete.original_qty ?? 1),
                      itemToDelete.unit || itemToDelete.product?.unit || 'satuan'
                    )}) akan dikembalikan ke stok etalase toko.
                  </span>
                </div>
              </label>

              {items.length === 1 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Ini adalah barang terakhir dalam transaksi ini. Total belanja transaksi akan menjadi Rp 0.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDeleteItem}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isDeleting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Item</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
