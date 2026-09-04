import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Upload, Trash2, Link as LinkIcon, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadProductImage } from '../../lib/imageUtils';

interface ProductImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export const ProductImageUploader: React.FC<ProductImageUploaderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file gambar (JPG, PNG, WebP, GIF) yang didukung.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5MB.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const uploadedUrl = await uploadProductImage(file);
      onChange(uploadedUrl);
    } catch (err: any) {
      console.error('Upload image error:', err);
      setUploadError(err.message || 'Gagal memproses gambar produk');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // Reset file input value to allow selecting same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setUploadError(null);
    setCustomUrl('');
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    onChange(customUrl.trim());
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-gray-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-[#2E7D32]" />
          <span>Foto / Gambar Produk</span>
          <span className="text-gray-400 font-normal text-xs">(Opsional)</span>
        </label>

        {!value && (
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] text-[#2E7D32] hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <LinkIcon className="w-3 h-3" />
            <span>{showUrlInput ? 'Tutup Input URL' : 'Gunakan URL Gambar'}</span>
          </button>
        )}
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Manual URL Input Form if toggled */}
      {showUrlInput && !value && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
          <p className="text-[11px] text-gray-500">Tempelkan link gambar web langsung (contoh: Unsplash/CDN):</p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-[#2E7D32]"
            />
            <button
              type="button"
              onClick={handleApplyCustomUrl}
              className="px-3 py-1.5 bg-[#2E7D32] text-white text-xs font-semibold rounded-lg hover:bg-[#1B5E20] transition-colors"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Preview Card vs Dropzone Area */}
      {value ? (
        <div className="flex items-center gap-3.5 p-3 bg-gray-50 border border-gray-200 rounded-2xl">
          {/* Image Thumbnail Preview */}
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white border border-gray-200 shrink-0 shadow-xs flex items-center justify-center">
            <img
              src={value}
              alt="Preview Produk"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Handle broken link fallback
                (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Gambar+Error';
              }}
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-xs">
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Details & Action Buttons */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" />
              <span>Foto Produk Terpasang</span>
            </div>
            <p className="text-[11px] text-gray-500 truncate">
              Gambar akan muncul pada menu kasir dan etalase stok.
            </p>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-gray-500" />
                <span>Ganti Gambar</span>
              </button>

              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={handleRemove}
                className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                title="Hapus foto produk"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Foto</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone Component when no image is uploaded */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#2E7D32] bg-emerald-50/70 scale-[1.01]'
              : 'border-gray-300 hover:border-[#2E7D32] hover:bg-emerald-50/20 bg-gray-50/50'
          } ${disabled || isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-2 space-y-2">
              <RefreshCw className="w-7 h-7 text-[#2E7D32] animate-spin" />
              <p className="text-xs font-semibold text-gray-700">Mengompres & memproses foto...</p>
              <p className="text-[10px] text-gray-400">Harap tunggu sebentar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-1 space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#2E7D32] flex items-center justify-center shadow-xs">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-gray-800">
                  <span className="text-[#2E7D32] underline underline-offset-2">Pilih Foto Produk</span> atau tarik file ke sini
                </p>
                <p className="text-[11px] text-gray-400">
                  Dukung format JPG, PNG, WebP (Maks 5MB - otomatis dikompres)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
