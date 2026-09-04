import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://kquxfvcbgogjpthhsseg.supabase.co';

export const SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxdXhmdmNiZ29nanB0aGhzc2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDI0OTEsImV4cCI6MjEwMTk3ODQ5MX0.xYs1LZHOYbNssk_6T0zpLzsXACjJxh4ksJnCMkUky9s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
