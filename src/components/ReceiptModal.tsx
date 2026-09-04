import React, { useState, useEffect } from 'react';
import { Printer, X, CheckCircle2, Settings, Store, Edit3 } from 'lucide-react';
import { formatRupiah, formatDateTime, formatStock, formatStockWithAlias } from '../lib/utils';
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
  date,
  storeProfile: initialStoreProfile,
  onUpdateStoreProfile,
}) => {
  const [profile, setProfile] = useState<StoreProfile>(initialStoreProfile || DEFAULT_STORE_PROFILE);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

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
                <span className="font-semibold">{saleId.slice(0, 12).toUpperCase()}</span>
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
                <span className="font-bold uppercase text-[#2E7D32]">{paymentMethod}</span>
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
          <div className="no-print p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Struk</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditProfileOpen(true)}
              title="Edit Teks Struk"
              className="px-3 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Edit Info</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>

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
