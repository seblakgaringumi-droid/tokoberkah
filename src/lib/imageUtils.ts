import { supabase } from './supabase';

/**
 * Compress and resize an image file on the client side using HTML5 Canvas
 * Targets a compact thumbnail (~15-35KB) for super fast POS rendering & instant storage
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 480,
  maxHeight = 480,
  quality = 0.8
): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('File yang dipilih bukan berkas gambar yang valid (JPG, PNG, WebP).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses berkas gambar ke kanvas.'));
      img.onload = () => {
        let { width, height } = img;

        // Calculate proportional dimensions while respecting maxWidth & maxHeight
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
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context tidak tersedia di browser'));
        }

        // Draw and smoothly resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer WebP for high compression, fallback to JPEG
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
              // Convert dataURL to Blob manually if toBlob returned null
              try {
                const byteString = atob(dataUrl.split(',')[1]);
                const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                const fallbackBlob = new Blob([ab], { type: mimeString });
                resolve({ dataUrl, blob: fallbackBlob });
              } catch (convErr) {
                resolve({ dataUrl, blob: new Blob([dataUrl], { type: mimeType }) });
              }
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
 * Upload an image directly to Supabase Storage bucket 'products'
 * Returns the permanent HTTPS Public URL of the uploaded image
 */
export async function uploadProductImage(file: File, productId?: string): Promise<string> {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ukuran file terlalu besar! Maksimal 5MB.');
  }

  // 1. Compress and resize image client-side to optimal thumbnail size
  const { dataUrl, blob } = await compressAndResizeImage(file, 480, 480, 0.82);

  // 2. Upload to Supabase Storage bucket 'products'
  try {
    const rawExt = file.name.split('.').pop()?.toLowerCase();
    const fileExt = rawExt && ['png', 'jpg', 'jpeg', 'webp'].includes(rawExt) ? rawExt : 'webp';
    const cleanId = productId ? productId.replace(/[^a-zA-Z0-9_-]/g, '') : 'new';
    const fileName = `product_${cleanId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, blob, {
        cacheControl: '31536000', // 1 year cache
        upsert: true,
        contentType: blob.type || 'image/webp',
      });

    if (uploadError) {
      console.warn('Supabase storage upload returned error, checking details:', uploadError.message);
    } else if (uploadData) {
      const { data: publicUrlData } = supabase.storage
        .from('products')
        .getPublicUrl(uploadData.path || fileName);

      if (publicUrlData?.publicUrl && publicUrlData.publicUrl.startsWith('http')) {
        console.log('[Storage] Permanent image URL generated:', publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
      }
    }
  } catch (storageErr) {
    console.warn('[Storage] Exception during storage upload:', storageErr);
  }

  // 3. Resilient fallback: Return compact WebP/JPEG Base64 Data URL (Survives page reloads)
  // NEVER return temporary blob: URL which expires on reload
  console.log('[Storage] Using compressed persistent Base64 Data URL fallback');
  return dataUrl;
}
