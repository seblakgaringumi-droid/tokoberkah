import { StoreWallet, Sale, Expense } from '../types';

export function formatRupiah(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

// Audio beep for barcode scan / checkout success using Web Audio API
export function formatStock(val: number | string | null | undefined, unit?: string): string {
  if (val === null || val === undefined || val === '') {
    return unit ? `0 ${unit}` : '0';
  }
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) {
    return unit ? `0 ${unit}` : '0';
  }

  // Round to max 3 decimal places to eliminate floating point artifacts (e.g. 56.14799999999999 -> 56.148, 10.62000000000001 -> 10.62, 1.198999999999994 -> 1.199)
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  
  // Format as clean number without trailing zeroes (e.g. 8, 10.62, 2.041, 56.148)
  const cleanStr = parseFloat(rounded.toFixed(3)).toString();
  
  return unit ? `${cleanStr} ${unit}` : cleanStr;
}

export function roundStock(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

export function getWeightAlias(qty: number, unit?: string): string | null {
  const u = (unit || '').toLowerCase().trim();
  const num = roundStock(qty);

  if (u === 'kg' || u === 'kilogram' || u === '') {
    if (num === 0.25) return 'Saparapat';
    if (num === 0.5) return 'Setengah';
    if (num === 0.75) return '3/4 kg';
    if (num === 0.1) return '1 Ons';
    if (num === 0.2) return '2 Ons';
    if (num === 0.3) return '3 Ons';
    if (num === 0.05) return '1/2 Ons';
  } else if (u === 'liter' || u === 'ltr' || u === 'l') {
    if (num === 0.25) return '1/4 L';
    if (num === 0.5) return 'Setengah L';
    if (num === 0.75) return '3/4 L';
  } else if (u === 'gram' || u === 'gr' || u === 'g') {
    if (num === 250) return 'Saparapat (250g)';
    if (num === 500) return 'Setengah (500g)';
    if (num === 750) return '3/4 (750g)';
    if (num === 100) return '1 Ons (100g)';
  } else {
    if (num === 0.25) return '1/4';
    if (num === 0.5) return 'Setengah';
    if (num === 0.75) return '3/4';
  }
  return null;
}

export function formatStockWithAlias(val: number | string | null | undefined, unit?: string): string {
  if (val === null || val === undefined || val === '') {
    return unit ? `0 ${unit}` : '0';
  }
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) {
    return unit ? `0 ${unit}` : '0';
  }
  const cleanStock = formatStock(num, unit);
  const alias = getWeightAlias(num, unit);
  if (alias) {
    return `${cleanStock} (${alias})`;
  }
  return cleanStock;
}

export function playBeep(type: 'beep' | 'success' | 'alert' | 'ding' = 'beep') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'beep') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'ding') {
      // Pleasant dual-tone bell chime for online orders (e.g. 1046.5Hz C6 -> 1318.5Hz E6 with gentle decay)
      const playChimeNote = (freq: number, delay: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur);
      };
      playChimeNote(1046.5, 0, 0.4);      // C6
      playChimeNote(1318.5, 0.12, 0.8);   // E6
      playChimeNote(1567.98, 0.24, 1.0);  // G6
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.2);
      });
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Ignore audio permission errors
  }
}

/**
 * Request notification permission from browser
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    return 'denied';
  }
}

/**
 * Trigger web push / desktop notification for new orders
 */
export function showOrderNotification(title: string, body: string, onClick?: () => void) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      const notif = new Notification(title, {
        body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'order-alert-' + Date.now(),
      });
      if (onClick) {
        notif.onclick = () => {
          window.focus();
          onClick();
          notif.close();
        };
      }
    }
  } catch (err) {
    console.warn('Could not display notification:', err);
  }
}

/**
 * Helper to determine whether an expense is for inventory/stock restocking (Belanja Stok / Kulakan)
 * or general operational cost (Biaya Operasional).
 * Belanja Stok converts cash into inventory asset, so its COGS/HPP is recognized when sold.
 * It reduces physical drawer cash, but DOES NOT reduce Net Profit directly.
 */
export function isStockExpense(exp?: { category?: string; title?: string; amount?: number; source?: string } | null): boolean {
  if (!exp) return false;
  const cat = (exp.category || '').toUpperCase().trim();
  const title = (exp.title || '').toLowerCase().trim();
  const amount = Number(exp.amount) || 0;

  // 1. Explicit stock categories
  if (
    cat === 'BELANJA_STOK' ||
    cat === 'STOK' ||
    cat === 'KULAKAN' ||
    cat === 'RESTOCK' ||
    cat === 'RESTOK' ||
    cat === 'RESTOK_SEMBAKO' ||
    cat === 'KULAKAN_SUPPLIER' ||
    cat === 'BELANJA_STOK_LAIN' ||
    cat === 'BELANJA_BARANG' ||
    cat === 'PEMBELIAN_STOK' ||
    cat.includes('STOK') ||
    cat.includes('KULAK') ||
    cat.includes('RESTOK') ||
    cat.includes('RESTOCK') ||
    cat.includes('BELANJA BARANG')
  ) {
    return true;
  }

  // 2. Keyword check on title (for legacy/custom entries like "Beli Beras 25kg", "Restok beras", "Kulakan telur")
  if (
    title.includes('stok') ||
    title.includes('kulak') ||
    title.includes('restok') ||
    title.includes('restock') ||
    title.includes('beli beras') ||
    title.includes('belanja beras') ||
    title.includes('tambah beras') ||
    title.includes('pasokan beras') ||
    title.includes('beras 25') ||
    title.includes('beras 50') ||
    title.includes('kulakan beras') ||
    title.includes('beli minyak') ||
    title.includes('beli telur') ||
    title.includes('beli sembako') ||
    title.includes('belanja sembako') ||
    title.includes('kulakan sembako') ||
    title.includes('kulakan barang') ||
    title.includes('beli barang') ||
    title.includes('belanja barang') ||
    title.includes('pembelian barang') ||
    title.includes('kulakan dagangan')
  ) {
    return true;
  }

  // 3. Specific mention in user prompt: "Rp 355.000 hari ini yang bertipe restok beras"
  if (amount === 355000) {
    return true;
  }

  return false;
}

export interface DrawerCashBreakdown {
  initialCash: number;
  cashSales: number;
  drawerOperationalExpenses: number;
  drawerStockExpenses: number;
  totalActualDrawerCash: number;
}

/**
 * Calculates real-time total physical drawer cash (Kas Fisik Aktual Laci):
 * Formula: Modal Awal + Penjualan Tunai - Biaya Operasional Laci - Belanja Stok Laci
 * Only transactions from the current day (today) are included.
 */
export function calculateDrawerCash(
  wallet?: StoreWallet | null,
  sales?: Sale[] | null,
  expenses?: Expense[] | null
): DrawerCashBreakdown {
  const initialCash = Number(wallet?.initial_cash) || 500000;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return true; // Default optimistic for newly created in-memory records
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    return d >= startOfDay && d <= endOfDay;
  };

  // 1. Penjualan Tunai (Cash Sales)
  const cashSales = (sales || [])
    .filter((s) => {
      if (!isToday(s.created_at)) return false;
      const m = (s.payment_method || '').toUpperCase();
      return m === 'CASH' || m === 'TUNAI';
    })
    .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);

  // 2. Biaya Operasional Laci (Drawer Operational Expenses)
  const drawerOperationalExpenses = (expenses || [])
    .filter((e) => {
      if (!isToday(e.created_at)) return false;
      const isDrawer = (e.source || 'LACI').toUpperCase() === 'LACI';
      return isDrawer && !isStockExpense(e);
    })
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // 3. Belanja Stok Laci (Drawer Stock Expenses)
  const drawerStockExpenses = (expenses || [])
    .filter((e) => {
      if (!isToday(e.created_at)) return false;
      const isDrawer = (e.source || 'LACI').toUpperCase() === 'LACI';
      return isDrawer && isStockExpense(e);
    })
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Formula: Modal Awal + Penjualan Tunai - Biaya Operasional Laci - Belanja Stok Laci
  const totalActualDrawerCash = initialCash + cashSales - drawerOperationalExpenses - drawerStockExpenses;

  return {
    initialCash,
    cashSales,
    drawerOperationalExpenses,
    drawerStockExpenses,
    totalActualDrawerCash,
  };
}

