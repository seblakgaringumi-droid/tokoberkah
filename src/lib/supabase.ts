import { createClient } from '@supabase/supabase-js';

// Allow dynamic URL overriding from localStorage so users on hosted Workers/PWA can update their Tunnel URL anytime!
export const getActiveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tokoberkah_supabase_url');
    if (saved && saved.trim()) return saved.trim();
  }
  return (import.meta as any).env?.VITE_SUPABASE_URL || 'https://benefit-vast-ratios-senators.trycloudflare.com';
};

export const SUPABASE_URL = getActiveSupabaseUrl();

export const SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 0,
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
