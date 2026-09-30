import { createClient } from '@supabase/supabase-js';

// Allow dynamic URL overriding from localStorage so users on hosted Workers/PWA can update their Tunnel URL anytime!
export const getActiveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tokoberkah_supabase_url');
    if (saved && saved.trim()) return saved.trim();
  }
  return (import.meta as any).env?.VITE_SUPABASE_URL || 'https://phmph-202-155-14-124.run.pinggy-free.link';
};

export const SUPABASE_URL = getActiveSupabaseUrl();

export const SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

// Custom fetch to seamlessly support both standard Supabase Gateway (/rest/v1) and direct PostgREST tunnels!
const customFetch: typeof fetch = (input, init) => {
  let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  
  // If the tunnel points directly to PostgREST on port 3000, strip the `/rest/v1` prefix so queries hit PostgREST tables directly
  if (url.includes('/rest/v1/')) {
    url = url.replace('/rest/v1/', '/');
  } else if (url.endsWith('/rest/v1')) {
    url = url.replace(/\/rest\/v1$/, '/');
  }

  // Clone headers safely
  const customInit = init ? { ...init } : {};
  if (customInit.headers) {
    const headers = new Headers(customInit.headers as any);
    // PostgREST without Envoy might reject Authorization in CORS preflight unless configured
    // apikey is sufficient for PostgREST
    if (headers.has('apikey') && headers.has('Authorization')) {
      const auth = headers.get('Authorization');
      if (auth && auth.includes(SUPABASE_ANON_KEY)) {
        headers.delete('Authorization');
      }
    }
    customInit.headers = headers;
  }

  return fetch(url, customInit);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: customFetch,
  },
  realtime: {
    // Disable realtime channel if direct tunnel doesn't support WebSocket
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
