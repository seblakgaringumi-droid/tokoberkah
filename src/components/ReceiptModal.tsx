import React, { useState, useEffect } from 'react';
import { Printer, X, CheckCircle2, Settings, Store, Edit3, MessageCircle, Send, Phone } from 'lucide-react';
import { 
  formatRupiah, 
  formatDateTime, 
  formatStock, 
  formatStockWithAlias,
  formatWhatsAppNumber,
  extractPhoneNumber,
  generateWhatsAppReceiptText
} from '../lib/utils';
import { Product, StoreProfile } from '../types';
import { DEFAULT_STORE_PROFILE, fetchStoreProfile } from '../services/api';
import { EditStoreProfileModal } from './EditStoreProfileModal';

interface ReceiptItem {
  product: Product;
  qty: number;
  unit: string;
  subtotal: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
  items: ReceiptItem[];
  totalAmount: number;
  cashReceived?: number;
  changeAmount?: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  date?: string;
  storeProfile?: StoreProfile;
  onUpdateStoreProfile?: (profile: StoreProfile) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  saleId,
  items,
  totalAmount,
  cashReceived,
  changeAmount,
  paymentMethod,
  customerName,
  customerPhone,
  date,
  storeProfile: initialStoreProfile,
  onUpdateStoreProfile,
}) => {
  const [profile, setProfile] = useState<StoreProfile>(initialStoreProfile || DEFAULT_STORE_PROFILE);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // WhatsApp Send Modal State
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waError, setWaError] = useState('');
  const [waSuccessNotice, setWaSuccessNotice] = useState(false);
  const [showPreviewText, setShowPreviewText] = useState(false);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState('');

  // Auto-fill WhatsApp number if available from customer phone or embedded in name/notes
  useEffect(() => {
    if (customerPhone) {
      setWaPhone(customerPhone);
    } else {
      const extracted = extractPhoneNumber(customerName);
      if (extracted) {
        setWaPhone(extracted);
      } else {
        setWaPhone('');
      }
    }
    setWaError('');
    setWaSuccessNotice(false);
    setLastGeneratedUrl('');
  }, [customerPhone, customerName, isOpen]);

  useEffect(() => {
    if (initialStoreProfile) {
      setProfile(initialStoreProfile);
    } else {
      fetchStoreProfile().then((res) => {
        if (res) setProfile(res);
      });
    }
  }, [initialStoreProfile, isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleProfileUpdated = (updated: StoreProfile) => {
    setProfile(updated);
    if (onUpdateStoreProfile) {
      onUpdateStoreProfile(updated);
    }
  };

  const handleSendWhatsApp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!waPhone.trim()) {
      setWaError('Silakan masukkan nomor WhatsApp pelanggan.');
      return;
    }

    const sanitized = formatWhatsAppNumber(waPhone);
    if (sanitized.length < 9) {
      setWaError('Nomor WhatsApp tidak valid (minimal 9 digit, contoh: 08123456789).');
      return;
    }

    const receiptText = generateWhatsAppReceiptText({
      storeProfile: profile,
      saleId,
      items,
      totalAmount,
      cashReceived,
      changeAmount,
      paymentMethod,
      customerName,
      date,
    });

    const url = `https://api.whatsapp.com/send?phone=${sanitized}&text=${encodeURIComponent(receiptText)}`;
    setLastGeneratedUrl(url);
    setWaSuccessNotice(true);

    // Open in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[92vh] my-auto border border-gray-100">
          {/* Modal Header */}
          <div className="no-print bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <h3 className="font-bold text-base">Struk Transaksi</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                title="Edit Header & Footer Struk Toko"
                className="p-1.5 text-emerald-100 hover:text-white rounded-xl hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <Settings className="w-4 h-4" />
                <span className="text-[11px] font-medium hidden sm:inline">Ubah Info Struk</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Area - Thermal Paper Style */}
          <div className="p-5 sm:p-6 overflow-y-auto font-mono text-sm leading-tight text-gray-800 bg-white" id="printable-receipt">
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400 group relative">
              <h2 className="font-bold text-xl tracking-wide uppercase text-gray-900 font-mono">
                {profile.store_name || 'TOKO BERKAH'}
              </h2>
              {profile.tagline && (
                <p className="text-xs text-gray-600 mt-0.5 font-sans">{profile.tagline}</p>
              )}
              {profile.address && (
                <p className="text-xs text-gray-500 font-sans mt-0.5">{profile.address}</p>
              )}
              {profile.phone && (
                <p className="text-xs text-gray-500 font-mono">WhatsApp: {profile.phone}</p>
              )}

              {/* Quick edit hint for screen view only */}
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                className="no-print mt-1 text-[10px] text-[#2E7D32] hover:text-[#1B5E20] inline-flex items-center gap-1 font-sans opacity-70 hover:opacity-100 underline decoration-dotted cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Sesuaikan Header/Footer</span>
              </button>
            </div>

            {/* Transaction Metadata */}
            <div className="py-2.5 border-b border-dashed border-gray-400 text-xs space-y-1">
              <div className="flex justify-between">
                <span>No. Nota:</span>
                <span className="font-semibold">
                  {(() => {
                    const match = saleId.match(/#ORD-(\d+)/i) || saleId.match(/ORD-(\d+)/i) || (customerName || '').match(/#ORD-(\d+)/i);
                    if (match) return `#ORD-${match[1]}`;
                    if (saleId.startsWith('sale_online_')) return `#ORD-${saleId.replace('sale_online_', '').slice(0, 5)}`;
                    return saleId.slice(0, 12).toUpperCase();
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formatDateTime(date || new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>Petugas Shift #01</span>
              </div>
              {customerName && (
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-semibold">{customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Metode:</span>
                <span className="font-bold uppercase text-[#2E7D32]">
                  {(() => {
                    const m = (paymentMethod || '').toUpperCase();
                    if (m === 'COD' || m.includes('COD') || m.includes('BAYAR DI TEMPAT')) return 'COD (Bayar di Tempat)';
                    if (m === 'CASH' || m === 'TUNAI') return 'Tunai / Cash';
                    if (m === 'QRIS') return 'QRIS';
                    if (m === 'TRANSFER') return 'Transfer Bank';
                    if (m === 'UTANG') return 'Utang / Bon';
                    return paymentMethod;
                  })()}
                </span>
              </div>
            </div>

            {/* Itemized list */}
            <div className="py-3 border-b border-dashed border-gray-400 space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-medium text-gray-900 line-clamp-1">{item.product.name}</div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      {formatStockWithAlias(item.qty, item.unit || item.product.unit || 'kg')} x {formatRupiah(item.product.selling_price)}
                    </span>
                    <span className="font-semibold text-gray-900">{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Calculation */}
            <div className="py-3 border-b border-dashed border-gray-400 text-xs space-y-1.5">
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>TOTAL BELANJA</span>
                <span>{formatRupiah(totalAmount)}</span>
              </div>
              {cashReceived !== undefined && cashReceived > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Tunai Diterima:</span>
                    <span>{formatRupiah(cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Kembalian:</span>
                    <span className="text-[#2E7D32]">{formatRupiah(changeAmount || 0)}</span>
                  </div>
                </>
              )}
              {paymentMethod === 'UTANG' && (
                <div className="mt-1 p-1.5 bg-amber-50 rounded border border-amber-300 text-amber-900 text-center font-bold text-xs">
                  STATUS: UTANG / BON (Belum Lunas)
                </div>
              )}
            </div>

            {/* Footer Note & Custom Quotes */}
            <div className="text-center pt-3 text-xs text-gray-600 space-y-1 font-sans">
              {profile.footer_message && (
                <p className="font-semibold text-gray-800">{profile.footer_message}</p>
              )}
              {profile.footer_policy && (
                <p className="text-[11px] text-gray-500 leading-normal">{profile.footer_policy}</p>
              )}
              {profile.footer_quote && (
                <p className="font-bold text-gray-900 text-[11px] pt-1 font-mono">{profile.footer_quote}</p>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="no-print p-3 sm:p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Struk</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsWaModalOpen(true);
                setWaError('');
                setWaSuccessNotice(false);
              }}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" />
              <span>Kirim WA</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditProfileOpen(true)}
              title="Edit Teks Struk"
              className="p-2 sm:px-3 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Edit Info</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Send Dialog Popup */}
      {isWaModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#25D366] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">Kirim Struk via WhatsApp</h4>
                  <p className="text-[11px] text-white/90">Kirim nota langsung ke WhatsApp pelanggan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSendWhatsApp} className="p-4 sm:p-5 space-y-4">
              {/* Transaction Summary Card */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>No. Nota:</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {(() => {
                      const match =
                        saleId.match(/#ORD-(\d+)/i) ||
                        saleId.match(/ORD-(\d+)/i) ||
                        (customerName || '').match(/#ORD-(\d+)/i);
                      if (match) return `#ORD-${match[1]}`;
                      if (saleId.startsWith('sale_online_')) return `#ORD-${saleId.replace('sale_online_', '').slice(0, 5)}`;
                      return saleId.slice(0, 12).toUpperCase();
                    })()}
                  </span>
                </div>
                {customerName && (
                  <div className="flex justify-between text-gray-600">
                    <span>Pelanggan:</span>
                    <span className="font-semibold text-gray-900">{customerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 pt-1.5 border-t border-emerald-200/60 font-medium">
                  <span>Total Belanja:</span>
                  <span className="font-bold text-[#1B5E20] text-sm">{formatRupiah(totalAmount)}</span>
                </div>
              </div>

              {/* WhatsApp Phone Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Nomor WhatsApp Pelanggan</span>
                  {customerPhone && (
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Terisi otomatis
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    autoFocus
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    value={waPhone}
                    onChange={(e) => {
                      setWaPhone(e.target.value);
                      setWaError('');
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-sm font-mono focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all placeholder:font-sans placeholder:text-xs text-gray-900"
                  />
                </div>
                {waError ? (
                  <p className="text-xs text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {waError}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Mendukung format <span className="font-mono">08xxx</span> atau <span className="font-mono">628xxx</span> (disesuaikan otomatis).
                  </p>
                )}
              </div>

              {/* Preview Toggle */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowPreviewText(!showPreviewText)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 cursor-pointer underline decoration-dotted"
                >
                  <span>{showPreviewText ? 'Sembunyikan pratinjau pesan' : 'Lihat pratinjau pesan WhatsApp'}</span>
                </button>
                {showPreviewText && (
                  <div className="mt-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-mono text-gray-800 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                    {generateWhatsAppReceiptText({
                      storeProfile: profile,
                      saleId,
                      items,
                      totalAmount,
                      cashReceived,
                      changeAmount,
                      paymentMethod,
                      customerName,
                      date,
                    })}
                  </div>
                )}
              </div>

              {/* Feedback banner if link was opened */}
              {waSuccessNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>WhatsApp dibuka di tab baru!</span>
                  </div>
                  {lastGeneratedUrl && (
                    <a
                      href={lastGeneratedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900 ml-2"
                    >
                      Buka Lagi
                    </a>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWaModalOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Struk Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Store Profile & Receipt Settings Modal */}
      <EditStoreProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentProfile={profile}
        onProfileUpdated={handleProfileUpdated}
      />
    </>
  );
};
