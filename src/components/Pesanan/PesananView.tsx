import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Search, 
  MessageSquare,
  Truck,
  ChevronDown,
  ChevronUp,
  X,
  Bell,
  BellRing,
  Send,
  Volume2
} from 'lucide-react';
import { Order, Product } from '../../types';
import { formatRupiah, formatDateTime, playBeep, formatStock, roundStock } from '../../lib/utils';
import { updateOrderStatus, createOrder } from '../../services/api';

interface PesananViewProps {
  orders: Order[];
  products: Product[];
  onRefresh: () => Promise<void>;
  notificationPermission?: NotificationPermission;
  onRequestPermission?: () => void;
}

export const PesananView: React.FC<PesananViewProps> = ({
  orders,
  products,
  onRefresh,
  notificationPermission = 'default',
  onRequestPermission,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // New order modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'TRANSFER'>('COD');
  const [orderItems, setOrderItems] = useState<{ productId: string; qty: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = selectedStatus === 'SEMUA' || o.status === selectedStatus;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q) ||
        o.delivery_address.toLowerCase().includes(q) ||
        String(o.id).includes(q);

      return matchStatus && matchQuery;
    });
  }, [orders, selectedStatus, searchQuery]);

  // Status counts
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'PENDING').length, [orders]);
  const processedCount = useMemo(() => orders.filter((o) => o.status === 'PROCESSED').length, [orders]);
  const completedCount = useMemo(() => orders.filter((o) => o.status === 'COMPLETED').length, [orders]);

  // Update status handler
  const handleUpdateStatus = async (orderId: number, nextStatus: 'PENDING' | 'PROCESSED' | 'COMPLETED' | 'CANCELLED') => {
    try {
      setActionLoadingId(orderId);
      await updateOrderStatus(orderId, nextStatus);
      if (nextStatus === 'PROCESSED' || nextStatus === 'COMPLETED') {
        playBeep('success');
      } else if (nextStatus === 'CANCELLED') {
        playBeep('alert');
      }
      await onRefresh();
    } catch (err: any) {
      alert(`Gagal memperbarui status pesanan: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // WhatsApp click handler with detailed order items template
  const openWhatsApp = (order: Order, customAction?: 'konfirmasi' | 'proses' | 'siap') => {
    let cleanPhone = order.customer_phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }

    const items = Array.isArray(order.items_json) ? order.items_json : [];
    const itemsListText = items
      .map((it: any, i: number) => `${i + 1}. ${it.name} (${formatStock(it.qty, it.unit || '')}) - ${formatRupiah(it.subtotal || it.price * it.qty)}`)
      .join('\n');

    let intro = `Halo Kak *${order.customer_name}*, terima kasih telah memesan di *Toko Berkah*!\n\n`;
    intro += `📋 *Rincian Pesanan #ORD-${order.id}:*\n${itemsListText}\n\n`;
    intro += `💰 *Total Tagihan:* ${formatRupiah(order.total_amount)}\n`;
    intro += `💳 *Pembayaran:* ${order.payment_method}\n`;
    intro += `📍 *Alamat Pengantaran:* ${order.delivery_address}\n\n`;

    if (customAction === 'proses') {
      intro += `🛵 *Status:* Pesanan Kakak sedang kami *Siapkan & Proses* untuk segera diantar ya! Mohon ditunggu.`;
    } else if (customAction === 'siap') {
      intro += `✅ *Status:* Pesanan Kakak sudah selesai disiapkan dan sedang dalam perjalanan pengantaran. Terima kasih!`;
    } else {
      intro += `Mohon konfirmasinya ya Kak apakah pesanan dan alamat di atas sudah sesuai? Terima kasih! 🙏`;
    }

    const encoded = encodeURIComponent(intro);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  // Test sound alert
  const handleTestSound = () => {
    playBeep('ding');
  };

  // Add Item to new order modal
  const handleAddItemToNewOrder = () => {
    if (products.length === 0) return;
    setOrderItems([...orderItems, { productId: products[0].id, qty: 1 }]);
  };

  const handleUpdateItemInNewOrder = (idx: number, productId: string, qty: number) => {
    const updated = [...orderItems];
    updated[idx] = { productId, qty: Math.max(0.1, qty) };
    setOrderItems(updated);
  };

  const handleRemoveItemInNewOrder = (idx: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  // Submit new manual order
  const handleCreateNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setErrorMessage('Harap lengkapi nama, nomor telepon, dan alamat pengiriman!');
      return;
    }
    if (orderItems.length === 0) {
      setErrorMessage('Pilih minimal 1 produk belanjaan!');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Construct JSON items
      let calculatedTotal = 0;
      const formattedItems = orderItems.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const price = prod ? prod.selling_price : 0;
        const subtotal = Math.round(item.qty * price);
        calculatedTotal += subtotal;
        return {
          product_id: item.productId,
          name: prod ? prod.name : 'Produk',
          qty: roundStock(item.qty),
          unit: prod?.unit || 'kg',
          price,
          subtotal,
        };
      });

      await createOrder({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        items_json: formattedItems,
        total_amount: calculatedTotal,
        payment_method: paymentMethod,
        status: 'PENDING',
      });

      playBeep('success');
      setIsAddModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setOrderItems([]);
      await onRefresh();
    } catch (err: any) {
      console.error('Create order error:', err);
      setErrorMessage(err.message || 'Gagal menambahkan pesanan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Realtime & Notification Status Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-[#1B5E20] rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-amber-300 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg">Real-time Pesanan Online Aktif</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 border border-emerald-300/30 text-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                Live Channel
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-0.5">
              Pesanan baru dari pelanggan otomatis masuk seketika dengan alarm suara lonceng & notifikasi push browser.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            type="button"
            onClick={handleTestSound}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors border border-white/20 cursor-pointer"
            title="Uji coba suara lonceng pesanan"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-300" />
            <span>Tes Alarm</span>
          </button>

          {notificationPermission !== 'granted' && onRequestPermission && (
            <button
              type="button"
              onClick={onRequestPermission}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Aktifkan Notifikasi Desktop</span>
            </button>
          )}

          {notificationPermission === 'granted' && (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-900/60 border border-emerald-400/40 text-[11px] font-semibold text-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Notifikasi Siap
            </span>
          )}
        </div>
      </div>

      {/* Top Bar Summary & Filter Tabs */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex gap-1.5 p-1.5 bg-white border border-gray-200/80 rounded-full shadow-xs overflow-x-auto w-full md:w-auto">
          {[
            { id: 'SEMUA', label: 'Semua Pesanan', count: orders.length },
            { id: 'PENDING', label: 'Menunggu', count: pendingCount, color: 'text-amber-800 bg-amber-100' },
            { id: 'PROCESSED', label: 'Diproses', count: processedCount, color: 'text-blue-800 bg-blue-100' },
            { id: 'COMPLETED', label: 'Selesai', count: completedCount, color: 'text-[#1B5E20] bg-emerald-100' },
          ].map((tab) => {
            const isSelected = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#2E7D32] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : tab.color || 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right actions: Search and Add Manual Order */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari pelanggan / telepon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm rounded-full bg-gray-100 border-none text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#2E7D32] outline-none"
            />
          </div>

          <button
            onClick={() => {
              setIsAddModalOpen(true);
              if (orderItems.length === 0 && products.length > 0) {
                setOrderItems([{ productId: products[0].id, qty: 1 }]);
              }
            }}
            className="px-4 py-2.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 shadow-xs transition-colors active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Pesanan</span>
            <span className="sm:hidden">Pesanan Baru</span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-bold text-gray-800 text-base">Tidak Ada Pesanan</h4>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {searchQuery
              ? `Tidak ditemukan pesanan dengan kata kunci "${searchQuery}".`
              : 'Belum ada pesanan masuk dalam status ini. Pesanan dari pelanggan akan otomatis muncul di sini secara real-time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const items = Array.isArray(order.items_json) ? order.items_json : [];
            const isLoadingThis = actionLoadingId === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                  order.status === 'PENDING'
                    ? 'border-amber-300 ring-2 ring-amber-100 shadow-sm'
                    : 'border-gray-200 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Header */}
                <div className={`p-4 border-b flex items-center justify-between ${
                  order.status === 'PENDING' ? 'bg-amber-50/80 border-amber-200' : 'bg-gray-50/70 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-900">
                      #ORD-{order.id}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        order.status === 'PENDING'
                          ? 'bg-amber-500 text-white shadow-2xs animate-pulse'
                          : order.status === 'PROCESSED'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : order.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {order.status === 'PENDING'
                        ? 'Menunggu'
                        : order.status === 'PROCESSED'
                        ? 'Sedang Diproses'
                        : order.status === 'COMPLETED'
                        ? 'Selesai'
                        : 'Dibatalkan'}
                    </span>
                  </div>

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDateTime(order.created_at)}
                  </span>
                </div>

                {/* Customer Details */}
                <div className="p-4 space-y-3 text-sm">
                  <div>
                    <h4 className="font-bold text-gray-900 text-base">{order.customer_name}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-1">
                      <button
                        onClick={() => openWhatsApp(order)}
                        className="inline-flex items-center gap-1 text-[#2E7D32] hover:text-[#1B5E20] font-semibold hover:underline bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer"
                        title="Chat via WhatsApp dengan rincian pesanan"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{order.customer_phone}</span>
                      </button>
                      <span className="font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {order.payment_method}
                      </span>
                    </div>
                  </div>

                  {/* Delivery address */}
                  <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{order.delivery_address}</p>
                  </div>

                  {/* Items Toggle Summary */}
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="w-full flex items-center justify-between text-xs text-gray-600 font-semibold hover:text-gray-900 py-1 cursor-pointer"
                    >
                      <span>
                        Daftar Belanja ({items.length} item)
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 p-2.5 bg-emerald-50/50 rounded-xl text-xs divide-y divide-emerald-100/60 border border-emerald-100/50">
                        {items.length === 0 ? (
                          <p className="text-gray-400 italic">Tidak ada rincian item.</p>
                        ) : (
                          items.map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1 first:pt-0">
                              <span className="text-gray-800 font-medium">
                                {it.name} <span className="text-gray-500 font-normal">x{formatStock(it.qty, it.unit || '')}</span>
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatRupiah(it.subtotal || it.price * it.qty)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Total Amount */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500 font-medium">Total Pesanan:</span>
                    <span className="text-base font-bold text-[#1B5E20]">
                      {formatRupiah(order.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Actions Bar with Quick Actions */}
                <div className="p-3 bg-gray-50/90 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  {/* WhatsApp Quick Button */}
                  <button
                    onClick={() => openWhatsApp(order)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Kirim detail pesanan ke WhatsApp pelanggan"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Kirim WA</span>
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    {order.status === 'PENDING' && (
                      <>
                        <button
                          disabled={isLoadingThis}
                          onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Tolak / Batalkan
                        </button>
                        <button
                          disabled={isLoadingThis}
                          onClick={() => handleUpdateStatus(order.id, 'PROCESSED')}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                          title="Terima pesanan, kurangi stok otomatis, dan ubah status ke Diproses"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{isLoadingThis ? 'Memproses...' : 'Terima & Proses'}</span>
                        </button>
                      </>
                    )}

                    {order.status === 'PROCESSED' && (
                      <button
                        disabled={isLoadingThis}
                        onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                        className="px-4 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isLoadingThis ? 'Menyimpan...' : 'Selesaikan & Antar'}</span>
                      </button>
                    )}

                    {order.status === 'COMPLETED' && (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 py-1 px-2 bg-emerald-50 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Pesanan Selesai</span>
                      </span>
                    )}

                    {order.status === 'CANCELLED' && (
                      <span className="text-xs text-gray-500 font-semibold flex items-center gap-1 py-1 px-2 bg-gray-100 rounded-lg">
                        <XCircle className="w-4 h-4 text-gray-400" />
                        <span>Pesanan Dibatalkan</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Manual Order Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#2E7D32] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Catat Pesanan Pelanggan Baru</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewOrder} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Nama Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ibu Ranti"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    No. Telepon / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="08123456789"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'COD' | 'TRANSFER')}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none bg-white"
                  >
                    <option value="COD">COD (Bayar di Tempat)</option>
                    <option value="TRANSFER">Transfer Bank / QRIS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Alamat Pengiriman <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Jl. Mawar No. 12 RT 03/04 (Pagar Hitam)"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] outline-none"
                />
              </div>

              {/* Items in order */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-700 font-semibold">
                    Daftar Produk Belanjaan <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemToNewOrder}
                    className="text-xs text-[#2E7D32] hover:text-[#1B5E20] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Barang
                  </button>
                </div>

                {orderItems.length === 0 ? (
                  <p className="text-gray-400 text-xs italic py-2">Belum ada barang dipilih.</p>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((it, idx) => {
                      const selectedProd = products.find((p) => p.id === it.productId);
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                          <select
                            value={it.productId}
                            onChange={(e) => handleUpdateItemInNewOrder(idx, e.target.value, it.qty)}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-xs bg-white outline-none"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({formatRupiah(p.selling_price)}/{p.unit || 'kg'})
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1 w-24">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={it.qty}
                              onChange={(e) => handleUpdateItemInNewOrder(idx, it.productId, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-xs text-center outline-none"
                            />
                            <span className="text-gray-500 text-[11px] shrink-0">
                              {selectedProd?.unit || 'kg'}
                            </span>
                          </div>

                          <span className="text-xs font-semibold text-gray-800 w-24 text-right">
                            {formatRupiah((selectedProd?.selling_price || 0) * it.qty)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemInNewOrder(idx)}
                            className="text-gray-400 hover:text-rose-500 p-1 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pesanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
