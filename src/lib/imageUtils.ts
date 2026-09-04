import { supabase } from './supabase';

/**
 * Compress and resize an image file on the client side using HTML5 Canvas
 * Targets a compact thumbnail (~10-25KB) for fast POS rendering
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 360,
  maxHeight = 360,
  quality = 0.72
): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File yang dipilih bukan berkas gambar yang valid'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses berkas gambar'));
      img.onload = () => {
        let { width, height } = img;

        // Calculate proportional dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context tidak tersedia'));
        }

        // Draw and smoothly resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP or fallback to JPEG
        let mimeType = 'image/webp';
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            mimeType = 'image/jpeg';
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ dataUrl, blob });
            } else {
              resolve({ dataUrl, blob: new Blob([dataUrl], { type: mimeType }) });
            }
          },
          mimeType,
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image to Supabase Storage if bucket exists, or fallback to compressed Data URL
 */
export async function uploadProductImage(file: File): Promise<string> {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ukuran file terlalu besar! Maksimal 5MB.');
  }

  // Compress and resize image client-side to keep size very small (~10-25KB)
  const { dataUrl, blob } = await compressAndResizeImage(file, 360, 360, 0.7);

  // Attempt Supabase storage upload if available
  try {
    const fileExt = file.name.split('.').pop() || 'webp';
    const cleanFileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `products/${cleanFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: blob.type || 'image/webp',
      });

    if (!uploadError && uploadData) {
      const { data: publicUrlData } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (storageErr) {
    console.warn('Storage upload note (using optimized inline image):', storageErr);
  }

  // Fallback: return lightweight compressed dataUrl directly
  return dataUrl;
}

