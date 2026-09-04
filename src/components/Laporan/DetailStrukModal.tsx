import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Sale } from '../../types';
import { formatRupiah, formatDateTime, formatStock, formatStockWithAlias } from '../../lib/utils';

interface DetailStrukModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onPrintReceipt: (sale: Sale) => void;
}

export const DetailStrukModal: React.FC<DetailStrukModalProps> = ({
  isOpen,
  onClose,
  sale,
  onPrintReceipt,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !sale) return null;

  const items = sale.items || sale.sale_items || [];
  const isUtang = sale.payment_method === 'UTANG' || sale.status === 'unpaid';
  const totalQty = items.reduce((acc, it) => acc + (Number(it.qty_kg) || 1), 0);
  const totalItemTypes = items.length;

  const handleCopyId = () => {
    navigator.clipboard.writeText(sale.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPaymentBadge = (method: string) => {
    const m = (method || '').toUpperCase();
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

  const paymentBadge = getPaymentBadge(sale.payment_method);

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
                <span>Nota #{sale.id.slice(0, 8).toUpperCase()}</span>
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
        <div className="p-6 overflow-y-auto space-y-5 text-gray-700 text-sm">
          {/* Metadata Card */}
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200/70 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2.5 border-b border-gray-200/80">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span>ID Nota Transaksi:</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                <span>#{sale.id.slice(0, 12).toUpperCase()}</span>
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
                  {formatDateTime(sale.created_at)}
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
                  {sale.notes || sale.customer_name || 'Pelanggan Umum'}
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
                    <th className="px-2.5 py-2.5 text-center">Qty / Satuan</th>
                    <th className="px-2.5 py-2.5 text-right">Harga</th>
                    <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-400">
                        Tidak ada rincian item produk tersimpan pada transaksi ini.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const prodName = item.product?.name || 'Barang Sembako';
                      const unit = item.unit || item.product?.unit || 'kg';
                      const unitPrice = item.product?.selling_price || (item.qty_kg > 0 ? item.subtotal / item.qty_kg : item.subtotal);
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
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
                          <td className="px-2.5 py-2.5 text-center font-medium text-gray-700 whitespace-nowrap">
                            {formatStockWithAlias(item.qty_kg, unit)}
                          </td>
                          <td className="px-2.5 py-2.5 text-right text-gray-500 font-mono whitespace-nowrap">
                            {formatRupiah(unitPrice)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold font-mono text-gray-900 whitespace-nowrap">
                            {formatRupiah(item.subtotal)}
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
              <span className="font-mono font-medium">{formatRupiah(sale.total_amount)}</span>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-1 border-t border-emerald-200/60">
              <span className="text-gray-900">TOTAL BELANJA:</span>
              <span className="text-base text-[#1B5E20] font-mono">
                {formatRupiah(sale.total_amount)}
              </span>
            </div>

            {sale.cash_received !== undefined && sale.cash_received > 0 && (
              <div className="pt-2 border-t border-dashed border-emerald-200/80 space-y-1 text-xs">
                <div className="flex justify-between text-gray-700">
                  <span>Tunai Diterima:</span>
                  <span className="font-mono font-semibold">{formatRupiah(sale.cash_received)}</span>
                </div>
                <div className="flex justify-between text-[#1B5E20] font-semibold">
                  <span>Uang Kembalian:</span>
                  <span className="font-mono">{formatRupiah(sale.change_amount || 0)}</span>
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
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              onPrintReceipt(sale);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Ulang Struk</span>
          </button>
        </div>
      </div>
    </div>
  );
};
