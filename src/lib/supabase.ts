import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://seven-houses-report.loca.lt';

export const SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (url, options = {}) => {
      const headers = new Headers(options.headers || {});
      // Bypass Localtunnel reminder page
      headers.set('bypass-tunnel-reminder', 'true');
      headers.set('Bypass-Tunnel-Reminder', 'true');
      // Pass Basic Auth credentials if Studio/Kong requires it
      if (!headers.has('Authorization')) {
        headers.set('Authorization', 'Basic ' + btoa('supabase:this_is_a_secret_change_me'));
      }
      return fetch(url, { ...options, headers });
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 0,
    },
  },
});

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
