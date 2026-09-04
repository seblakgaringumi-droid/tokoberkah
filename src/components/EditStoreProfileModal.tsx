import React, { useState, useEffect } from 'react';
import { 
  Store, 
  X, 
  Save, 
  RotateCcw, 
  Check, 
  FileText, 
  Phone, 
  MapPin, 
  Sparkles, 
  Quote, 
  CheckCircle2, 
  Eye,
  Printer
} from 'lucide-react';
import { StoreProfile } from '../types';
import { DEFAULT_STORE_PROFILE, saveStoreProfile } from '../services/api';

interface EditStoreProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: StoreProfile;
  onProfileUpdated: (updated: StoreProfile) => void;
}

export const EditStoreProfileModal: React.FC<EditStoreProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onProfileUpdated,
}) => {
  const [formData, setFormData] = useState<StoreProfile>(currentProfile || DEFAULT_STORE_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(currentProfile || DEFAULT_STORE_PROFILE);
      setSavedSuccess(false);
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleChange = (field: keyof StoreProfile, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetDefault = () => {
    setFormData(DEFAULT_STORE_PROFILE);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const saved = await saveStoreProfile(formData);
      onProfileUpdated(saved);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save store profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] my-auto border border-gray-100">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Store className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Pengaturan Identitas & Struk Toko</h3>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Kustomisasi nama toko, alamat, WhatsApp, dan pesan footer struk
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

        {/* Content Body with 2-column layout (Form + Live Thermal Receipt Preview) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Inputs (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* SECTION 1: HEADER STRUK */}
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 text-xs font-bold text-gray-900 uppercase tracking-wider">
                  <Store className="w-4 h-4 text-[#1B5E20]" />
                  <span>Informasi Header Toko</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama Toko <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.store_name}
                    onChange={(e) => handleChange('store_name', e.target.value)}
                    placeholder="Contoh: TOKO BERKAH"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wide bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tagline / Kategori Toko
                  </label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => handleChange('tagline', e.target.value)}
                    placeholder="Contoh: Sembako, Bumbu, & Kebutuhan Harian"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>Alamat Lengkap Toko</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      placeholder="Contoh: Jl. Berkah Raya No. 88, Sejahtera"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>Nomor Telepon / WhatsApp</span>
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm font-mono text-gray-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: FOOTER STRUK & QUOTES */}
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 text-xs font-bold text-gray-900 uppercase tracking-wider">
                  <Quote className="w-4 h-4 text-[#1B5E20]" />
                  <span>Pesan & Footer Struk Belanja</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Pesan Terima Kasih (Baris Utama)
                  </label>
                  <input
                    type="text"
                    value={formData.footer_message}
                    onChange={(e) => handleChange('footer_message', e.target.value)}
                    placeholder="Contoh: Terima kasih atas kunjungan Anda!"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Syarat & Kebijakan Penukaran (Baris Catatan)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.footer_policy}
                    onChange={(e) => handleChange('footer_policy', e.target.value)}
                    placeholder="Contoh: Barang yang sudah dibeli dapat ditukar jika ada kerusakan dalam 1x24 jam."
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm text-gray-800 bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Quote / Penutup Struk Akhir
                  </label>
                  <input
                    type="text"
                    value={formData.footer_quote}
                    onChange={(e) => handleChange('footer_quote', e.target.value)}
                    placeholder="Contoh: *** BERKAH SELALU ***"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#2E7D32] focus:ring-2 focus:ring-emerald-50 outline-none text-xs sm:text-sm font-semibold text-gray-800 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Thermal Receipt Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Eye className="w-3.5 h-3.5 text-[#1B5E20]" />
                  <span>Pratinjau Struk Thermal (Live)</span>
                </span>
                <span className="text-[10px] bg-emerald-50 text-[#1B5E20] font-semibold px-2 py-0.5 rounded-md border border-emerald-200">
                  Kertas 58mm / 80mm
                </span>
              </div>

              {/* Thermal Paper Card */}
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-5 shadow-xs font-mono text-xs text-gray-800 leading-tight space-y-3">
                {/* Header Preview */}
                <div className="text-center pb-2.5 border-b border-dashed border-gray-300 space-y-0.5">
                  <h4 className="font-bold text-sm tracking-wide text-gray-900 uppercase">
                    {formData.store_name || 'TOKO BERKAH'}
                  </h4>
                  {formData.tagline && (
                    <p className="text-[11px] text-gray-600 font-sans">{formData.tagline}</p>
                  )}
                  {formData.address && (
                    <p className="text-[10px] text-gray-500 font-sans">{formData.address}</p>
                  )}
                  {formData.phone && (
                    <p className="text-[10px] text-gray-500 font-mono">WhatsApp: {formData.phone}</p>
                  )}
                </div>

                {/* Sample Transaction Meta */}
                <div className="py-1.5 border-b border-dashed border-gray-300 text-[11px] space-y-0.5 text-gray-600">
                  <div className="flex justify-between">
                    <span>No. Nota:</span>
                    <span className="font-semibold text-gray-900">#TB-20260903</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>03/09/2026 19:30</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>Petugas Shift #01</span>
                  </div>
                </div>

                {/* Sample Items */}
                <div className="py-2 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
                  <div>
                    <div className="font-medium text-gray-900">Beras Pandan Wangi Super</div>
                    <div className="flex justify-between text-gray-500">
                      <span>2 kg x Rp 16.000</span>
                      <span className="font-semibold text-gray-900">Rp 32.000</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Minyak Bimoli 2L</div>
                    <div className="flex justify-between text-gray-500">
                      <span>1 pouch x Rp 36.000</span>
                      <span className="font-semibold text-gray-900">Rp 36.000</span>
                    </div>
                  </div>
                </div>

                {/* Sample Totals */}
                <div className="py-1.5 border-b border-dashed border-gray-300 text-[11px] space-y-1">
                  <div className="flex justify-between font-bold text-gray-900 text-xs">
                    <span>TOTAL:</span>
                    <span>Rp 68.000</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tunai:</span>
                    <span>Rp 100.000</span>
                  </div>
                  <div className="flex justify-between text-[#1B5E20] font-semibold">
                    <span>Kembali:</span>
                    <span>Rp 32.000</span>
                  </div>
                </div>

                {/* Footer Preview */}
                <div className="text-center pt-2 space-y-1 font-sans">
                  {formData.footer_message && (
                    <p className="font-medium text-[11px] text-gray-800">
                      {formData.footer_message}
                    </p>
                  )}
                  {formData.footer_policy && (
                    <p className="text-[10px] text-gray-500 leading-normal">
                      {formData.footer_policy}
                    </p>
                  )}
                  {formData.footer_quote && (
                    <p className="font-bold text-[10px] text-gray-800 pt-0.5 font-mono">
                      {formData.footer_quote}
                    </p>
                  )}
                </div>
              </div>

              {/* Reset to Default Button */}
              <button
                type="button"
                onClick={handleResetDefault}
                className="w-full py-2 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                <span>Kembalikan ke Teks Bawaan (Default)</span>
              </button>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500 text-center sm:text-left">
              Perubahan akan otomatis diterapkan ke seluruh struk kasir & laporan penjualan.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Tersimpan!</span>
                  </>
                ) : isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Pengaturan Struk</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
