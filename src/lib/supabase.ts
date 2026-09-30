import { createClient } from '@supabase/supabase-js';

// Project Supabase Resmi Toko Berkah (Akun Lama Aktif: kquxfvcbgogjpthhsseg)
export const DEFAULT_SUPABASE_URL = 'https://claitrxfqezqdvvckloa.supabase.co';
export const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsYWl0cnhmcWV6cWR2dmNrbG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Nzg5MTYsImV4cCI6MjEwNjM1NDkxNn0.Mq3e79VW-dAcxc9Xdcuy6sYgyQJdAAr2pWzU5sNfNdw';

export const getActiveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tokoberkah_supabase_url');
    // Bersihkan sisa tunnel lama (raceroute / pinggy / akun uji coba)
    if (!saved || saved.includes('raceroute') || saved.includes('pinggy') || saved.includes('claitrxfqezqdvvckloa')) {
      localStorage.setItem('tokoberkah_supabase_url', DEFAULT_SUPABASE_URL);
      return DEFAULT_SUPABASE_URL;
    }
    return saved.trim();
  }
  return (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
};

export const getActiveSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tokoberkah_supabase_anon_key');
    // Bersihkan sisa anon key lama
    if (!saved || saved.length < 50 || saved.includes('dc_X5iR_VP_qT0zsiyj_I') || saved.includes('Mq3e79VW-dAcxc9Xdcuy6sYgyQJdAAr2pWzU5sNfNdw')) {
      localStorage.setItem('tokoberkah_supabase_anon_key', DEFAULT_ANON_KEY);
      return DEFAULT_ANON_KEY;
    }
    return saved.trim();
  }
  return (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
};

export const SUPABASE_URL = getActiveSupabaseUrl();
export const SUPABASE_ANON_KEY = getActiveSupabaseAnonKey();

// Supabase Client Resmi Toko Berkah
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const setCustomSupabaseUrl = (newUrl: string) => {
  if (typeof window !== 'undefined') {
    if (!newUrl || !newUrl.trim()) {
      localStorage.removeItem('tokoberkah_supabase_url');
    } else {
      let cleaned = newUrl.trim();
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = 'https://' + cleaned;
      }
      localStorage.setItem('tokoberkah_supabase_url', cleaned);
    }
    window.location.reload();
  }
};

/**
 * Check if the connection to Supabase is active
 */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Terhubung ke Database Supabase' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Gagal tersambung ke Supabase' };
  }
}
