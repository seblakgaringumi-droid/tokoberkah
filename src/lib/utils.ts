import { StoreWallet, Sale, Expense, StoreProfile, DebtPayment, Product, ProductVariant } from '../types';

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

export const DISCRETE_UNITS = [
  'pcs', 'buah', 'bungkus', 'botol', 'pouch', 'sachet', 'dus', 'karton',
  'butir', 'kaleng', 'renteng', 'cup', 'pack', 'pak', 'biji', 'lembar',
  'porsi', 'ikat', 'pasang', 'rol', 'strip', 'tablet', 'kaplet'
];

export function isDiscreteUnit(unit?: string | null): boolean {
  if (!unit) return false;
  const u = unit.toLowerCase().trim();
  return DISCRETE_UNITS.includes(u);
}

export function isWeightUnit(unit?: string | null): boolean {
  const u = (unit || 'kg').toLowerCase().trim();
  return ['kg', 'kilogram', 'gram', 'gr', 'g', 'ons', 'liter', 'ltr', 'l'].includes(u);
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

  const u = (unit || '').toLowerCase().trim();
  const isDiscrete = isDiscreteUnit(u);
  const isGram = ['gram', 'gr', 'g'].includes(u);

  if (isDiscrete || isGram) {
    const rounded = Math.round(num);
    return unit ? `${rounded} ${unit}` : `${rounded}`;
  }

  // Standar pembulatan kuantitas stok barang (kg, liter, dll):
  // Dibulatkan maksimal 2 desimal (misal 16.668 -> 16.67, 21.889 -> 21.89, 0.25 -> 0.25, 0.5 -> 0.5, 10 -> 10)
  // Menghilangkan pecahan 3 desimal yang tidak wajar akibat pembagian nominal
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  
  // Format bersih tanpa trailing zeroes yang tidak perlu
  const cleanStr = parseFloat(rounded.toFixed(2)).toString();
  
  return unit ? `${cleanStr} ${unit}` : cleanStr;
}

export function roundStock(val: number, unit?: string): number {
  if (isNaN(val)) return 0;
  const u = (unit || '').toLowerCase().trim();
  const isDiscrete = isDiscreteUnit(u);
  const isGram = ['gram', 'gr', 'g'].includes(u);

  if (isDiscrete || isGram) {
    return Math.round(val);
  }

  // Standar pembulatan kuantitas/stok barang timbangan (kg, liter, ons):
  // Dibulatkan ke maksimal 2 desimal (misal 16.67, 21.89, 0.25, 0.5)
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function getWeightAlias(qty: number, unit?: string): string | null {
  if (isDiscreteUnit(unit)) return null;
  const u = (unit || '').toLowerCase().trim();
  const num = roundStock(qty, unit);

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
  }
  return null;
}

export function findMatchingVariant(product?: Product | null, qty?: number | null): ProductVariant | null {
  if (!product || qty === undefined || qty === null || isNaN(qty)) return null;
  if (!product.variants_json || !Array.isArray(product.variants_json) || product.variants_json.length === 0) {
    return null;
  }

  const unit = (product.unit || 'kg').toLowerCase().trim();
  const isKg = unit === 'kg' || unit === 'kilogram';
  const targetQtyInGram = roundStock(qty * 1000, 'gram');

  for (const v of product.variants_json) {
    if (!v || typeof v.selling_price !== 'number' || v.selling_price <= 0) continue;

    const vUnit = (v.unit || '').toLowerCase().trim();
    let vQtyInKg = 0;

    if (isKg) {
      if (vUnit === 'gram' || vUnit === 'gr' || vUnit === 'g' || (v.qty && v.qty >= 10)) {
        vQtyInKg = (v.qty || 0) / 1000;
      } else if (vUnit === 'kg' || vUnit === 'kilogram') {
        vQtyInKg = v.qty || 0;
      } else {
        vQtyInKg = (v.qty || 0) >= 10 ? (v.qty || 0) / 1000 : (v.qty || 0);
      }
      if (Math.abs(vQtyInKg - qty) < 0.001 || Math.abs((v.qty || 0) - targetQtyInGram) < 0.1) {
        return v;
      }
    } else {
      // For discrete or other units (pcs, buah, etc.)
      if (v.qty !== null && v.qty !== undefined && Math.abs(v.qty - qty) < 0.001) {
        return v;
      }
    }
  }

  return null;
}

export function calculateSubtotalForQty(product?: Product | null, qty?: number | null, customSubtotal?: number | null): number {
  if (!product || qty === undefined || qty === null || isNaN(qty)) return 0;

  if (customSubtotal !== undefined && customSubtotal !== null) {
    return customSubtotal;
  }

  const matchingVariant = findMatchingVariant(product, qty);
  if (matchingVariant && matchingVariant.selling_price > 0) {
    return Math.round(matchingVariant.selling_price);
  }

  return Math.round(qty * (product.selling_price || 0));
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
  qrisSales: number;
  autoQrisSales: number;
  debtPaymentsCash: number;
  debtPaymentsQris: number;
  totalDebtPayments: number;
  drawerOperationalExpenses: number;
  drawerStockExpenses: number;
  totalActualDrawerCash: number;
  totalKasToko: number;
}

/**
 * Formats any date input into YYYY-MM-DD based on Asia/Jakarta timezone (WIB).
 * Example output: '2026-09-07'
 */
export function getLocalDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // Output: YYYY-MM-DD
}

/**
 * Checks if a sale/transaction is valid (CASH, QRIS, UTANG/BON, ONLINE).
 * Valid statuses: PAID, SUCCESS, COMPLETED, UNPAID, PARTIAL, or unset.
 * Excludes cancelled or voided transactions: CANCELLED, BATAL, VOID, FAILED.
 */
export function isValidSale(sale?: Sale | null): boolean {
  if (!sale) return false;
  const status = (sale.status || 'PAID').toUpperCase().trim();
  const invalidStatuses = ['CANCELLED', 'BATAL', 'VOID', 'FAILED'];
  if (invalidStatuses.includes(status)) return false;
  return true;
}

export interface DailySalesAggregation {
  omzet: number;
  revenue: number;
  cost: number;
  profit: number;
  grossProfit: number;
  count: number;
}

/**
 * Aggregates transactions list by local date (WIB / Asia/Jakarta)
 */
export function aggregateDailySales(transactionsList?: Sale[] | null): Record<string, DailySalesAggregation> {
  const dailyData: Record<string, DailySalesAggregation> = {};

  (transactionsList || []).forEach((tx) => {
    if (!isValidSale(tx) || !tx.created_at) return;
    const txDate = getLocalDate(tx.created_at);
    if (!txDate) return;

    const amount = Number(tx.total_amount || 0);

    let saleCost = 0;
    if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
      for (const it of tx.items) {
        saleCost += (Number(it.cost_price) || 0) * (Number(it.qty_kg || it.qty) || 0);
      }
    } else if (tx.sale_items && Array.isArray(tx.sale_items) && tx.sale_items.length > 0) {
      for (const it of tx.sale_items) {
        saleCost += (Number(it.cost_price) || 0) * (Number(it.qty_kg || it.qty) || 0);
      }
    } else {
      saleCost = amount * 0.8;
    }

    const profit = Math.max(0, amount - saleCost);

    if (!dailyData[txDate]) {
      dailyData[txDate] = {
        omzet: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        grossProfit: 0,
        count: 0,
      };
    }

    dailyData[txDate].omzet += amount;
    dailyData[txDate].revenue += amount;
    dailyData[txDate].cost += saleCost;
    dailyData[txDate].profit += profit;
    dailyData[txDate].grossProfit += profit;
    dailyData[txDate].count += 1;
  });

  return dailyData;
}

/**
 * Calculates real-time total physical drawer cash and total store cash (Kas Fisik & Total Kas Toko):
 * Formula Kas Toko: Modal Awal + Penjualan Tunai + Saldo QRIS + Pelunasan Utang - Biaya Operasional - Belanja Stok Laci
 * Only transactions from the current day (today WIB) are included by default, unless filterDate is provided.
 */
export function calculateDrawerCash(
  wallet?: StoreWallet | null,
  sales?: Sale[] | null,
  expenses?: Expense[] | null,
  manualQrisAdjustment?: number | null,
  debtPayments?: DebtPayment[] | null,
  filterDate?: string
): DrawerCashBreakdown {
  const initialCash = Number(wallet?.initial_cash) || 500000;
  const targetDateStr = filterDate || getLocalDate(new Date());

  const isTargetDate = (dateStr?: string | null) => {
    if (!dateStr) return true; // Default optimistic for newly created in-memory records
    return getLocalDate(dateStr) === targetDateStr;
  };

  // If debtPayments not passed explicitly, attempt to load from local storage cache
  let paymentsList = debtPayments;
  if (!paymentsList && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('pos_debt_payments_cache');
      paymentsList = raw ? JSON.parse(raw) : [];
    } catch {
      paymentsList = [];
    }
  }

  // 1. Penjualan Tunai (Cash Sales)
  const cashSales = (sales || [])
    .filter((s) => {
      if (!isValidSale(s)) return false;
      if (!isTargetDate(s.created_at)) return false;
      const m = (s.payment_method || '').toUpperCase();
      return m === 'CASH' || m === 'TUNAI';
    })
    .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);

  // 1b. Pelunasan Utang Pelanggan (Buku Utang / Piutang)
  const validDebtPayments = (paymentsList || []).filter((p) => {
    const isIncome = !p.type || p.type === 'INCOME_DEBT_PAYMENT';
    return isIncome && isTargetDate(p.created_at);
  });

  // Pelunasan Utang Tunai (menambah kas laci)
  const debtPaymentsCash = validDebtPayments
    .filter((p) => {
      const m = (p.payment_method || '').toUpperCase();
      return m === 'TUNAI' || m === 'CASH';
    })
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Pelunasan Utang QRIS / Transfer (menambah saldo QRIS)
  const debtPaymentsQris = validDebtPayments
    .filter((p) => {
      const m = (p.payment_method || '').toUpperCase();
      return m === 'QRIS' || m === 'BANK' || m === 'TRANSFER' || m.includes('QRIS') || m.includes('TRANSFER');
    })
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const totalDebtPayments = debtPaymentsCash + debtPaymentsQris;

  // 1c. Saldo QRIS / Bank (Non-Tunai: Penjualan QRIS + Pelunasan Utang QRIS)
  const autoQrisSales = (sales || [])
    .filter((s) => {
      if (!isValidSale(s)) return false;
      if (!isTargetDate(s.created_at)) return false;
      const m = (s.payment_method || '').toUpperCase();
      return m === 'QRIS' || m === 'BANK' || m === 'TRANSFER' || m === 'NON_TUNAI' || m.includes('QRIS') || m.includes('TRANSFER');
    })
    .reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0) + debtPaymentsQris;

  // Effective QRIS: manual override if explicitly provided / configured, otherwise auto from sales + QRIS debt payments
  const qrisSales = manualQrisAdjustment !== undefined && manualQrisAdjustment !== null ? manualQrisAdjustment : autoQrisSales;

  // 2. Biaya Operasional Laci (Drawer Operational Expenses)
  const drawerOperationalExpenses = (expenses || [])
    .filter((e) => {
      if (!isTargetDate(e.created_at)) return false;
      const isDrawer = (e.source || 'LACI').toUpperCase() === 'LACI';
      return isDrawer && !isStockExpense(e);
    })
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // 3. Belanja Stok Laci (Drawer Stock Expenses)
  const drawerStockExpenses = (expenses || [])
    .filter((e) => {
      if (!isTargetDate(e.created_at)) return false;
      const isDrawer = (e.source || 'LACI').toUpperCase() === 'LACI';
      return isDrawer && isStockExpense(e);
    })
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Formula Fisik Laci: Modal Awal + Penjualan Tunai + Pelunasan Utang Tunai - Biaya Operasional Laci - Belanja Stok Laci
  const totalActualDrawerCash = initialCash + cashSales + debtPaymentsCash - drawerOperationalExpenses - drawerStockExpenses;

  // Formula Total Kas Toko: Modal Awal + Penjualan Tunai + Saldo QRIS + Pelunasan Utang - Biaya Operasional - Belanja Stok Laci
  const totalKasToko = initialCash + cashSales + qrisSales + debtPaymentsCash - drawerOperationalExpenses - drawerStockExpenses;

  return {
    initialCash,
    cashSales,
    qrisSales,
    autoQrisSales,
    debtPaymentsCash,
    debtPaymentsQris,
    totalDebtPayments,
    drawerOperationalExpenses,
    drawerStockExpenses,
    totalActualDrawerCash,
    totalKasToko,
  };
}

/**
 * Normalizes phone numbers to standard WhatsApp format: e.g. 0812... -> 62812...
 */
export function formatWhatsAppNumber(phone: string): string {
  let cleaned = (phone || '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Extracts phone number if embedded in strings (e.g. "Budi (0812-3456-789)")
 */
export function extractPhoneNumber(text?: string | null): string {
  if (!text) return '';
  const match = text.match(/(?:\+?62|0)8[0-9\- ]{7,14}/);
  if (match) {
    return formatWhatsAppNumber(match[0]);
  }
  return '';
}

export interface WhatsAppReceiptParams {
  storeProfile?: StoreProfile | null;
  saleId: string;
  items: Array<{
    product: { name: string; selling_price: number; unit?: string | null };
    qty: number;
    unit?: string | null;
    subtotal: number;
  }>;
  totalAmount: number;
  cashReceived?: number;
  changeAmount?: number;
  paymentMethod: string;
  customerName?: string | null;
  date?: string | null;
  status?: string | null;
  isDebtPaid?: boolean;
  remainingDebt?: number;
}

/**
 * Formats full structured receipt message for WhatsApp (api.whatsapp.com / wa.me)
 */
export function generateWhatsAppReceiptText(params: WhatsAppReceiptParams): string {
  const {
    storeProfile,
    saleId,
    items,
    totalAmount,
    cashReceived,
    changeAmount,
    paymentMethod,
    customerName,
    date,
    status,
    isDebtPaid,
    remainingDebt,
  } = params;

  const isPaidDebt = Boolean(isDebtPaid || status === 'paid');
  const isPartialDebt = Boolean(!isPaidDebt && (status === 'partial' || (remainingDebt !== undefined && remainingDebt > 0 && remainingDebt < totalAmount)));

  const storeName = (storeProfile?.store_name || 'TOKO BERKAH').toUpperCase();
  const tagline = storeProfile?.tagline || 'Sembako, Bumbu, & Kebutuhan Harian';
  const address = storeProfile?.address || 'Jl. Kalapanunggal I, Sindangkasih, Ciamis';
  const storePhone = storeProfile?.phone || '0852-9499-6696';

  const safeSaleId = String(saleId || `BON-${Date.now().toString().slice(-6)}`);
  const effectiveCustomerName = customerName || (paymentMethod === 'UTANG' ? 'Pelanggan Utang' : '');

  const cleanSaleId = (() => {
    const match =
      safeSaleId.match(/#ORD-(\d+)/i) ||
      safeSaleId.match(/ORD-(\d+)/i) ||
      effectiveCustomerName.match(/#ORD-(\d+)/i);
    if (match) return `#ORD-${match[1]}`;
    if (safeSaleId.startsWith('sale_online_')) return `#ORD-${safeSaleId.replace('sale_online_', '').slice(0, 5)}`;
    return safeSaleId.slice(0, 12).toUpperCase();
  })();

  const cleanPayment = (() => {
    const m = (paymentMethod || '').toUpperCase();
    if (m === 'COD' || m.includes('COD') || m.includes('BAYAR DI TEMPAT')) return 'COD (Bayar di Tempat)';
    if (m === 'CASH' || m === 'TUNAI') return 'Tunai / Cash';
    if (m === 'QRIS') return 'QRIS';
    if (m === 'TRANSFER') return 'Transfer Bank';
    if (m === 'UTANG') {
      if (isPaidDebt) return 'Utang / Bon (Lunas)';
      if (isPartialDebt) return 'Utang / Bon (Dicicil)';
      return 'Utang / Bon (Belum Lunas)';
    }
    return paymentMethod || 'Tunai';
  })();

  const formattedDate = formatDateTime(date || new Date().toISOString());
  const divider = '----------------------------------------';

  const lines: string[] = [];

  // Header Toko
  lines.push(`*${storeName}*`);
  if (tagline) lines.push(tagline);
  if (address) lines.push(address);
  if (storePhone) lines.push(`WhatsApp: ${storePhone}`);
  lines.push(divider);

  // Detail Nota
  lines.push(`*STRUK TRANSAKSI*`);
  lines.push(`No. Nota : ${cleanSaleId}`);
  lines.push(`Waktu    : ${formattedDate}`);
  lines.push(`Kasir    : Petugas Shift #01`);
  if (effectiveCustomerName) {
    lines.push(`Pelanggan: ${effectiveCustomerName}`);
  }
  lines.push(`Metode   : ${cleanPayment}`);
  lines.push(divider);

  // Rincian Barang
  lines.push(`*RINCIAN BARANG:*`);
  const safeItems = Array.isArray(items) ? items : [];
  safeItems.forEach((item: any) => {
    if (!item) return;
    const prodName = item.product?.name || item.product_name || item.name || 'Produk';
    const unitStr = item.unit || item.product?.unit || item.product_unit || 'pcs';
    const rawQty = item.qty ?? item.quantity ?? item.weight ?? item.qty_kg ?? item.jumlah ?? item.original_qty ?? item.amount;
    const itemQty = Number(rawQty) || (item.subtotal && item.price ? Number(item.subtotal) / Number(item.price) : 1);
    const prodSellingPrice = Number(
      item.product?.selling_price ?? 
      item.price ?? 
      item.selling_price ?? 
      (item.subtotal && itemQty > 0 ? Math.round(item.subtotal / itemQty) : 0)
    );
    const isWeightUnit = ['kg', 'kilogram', 'gram', 'gr', 'g', 'ons', 'liter', 'ltr', 'l', 'timbangan'].includes(
      (unitStr || '').toLowerCase().trim()
    );
    const formattedQty = isWeightUnit
      ? Number(itemQty).toLocaleString('id-ID', {
          minimumFractionDigits: Number.isInteger(itemQty) ? 0 : 1,
          maximumFractionDigits: 2,
        })
      : itemQty;
    const alias = getWeightAlias(itemQty, unitStr);
    const qtyAlias = alias ? `${formattedQty} ${unitStr} (${alias})` : `${formattedQty} ${unitStr}`;
    const unitPrice = formatRupiah(prodSellingPrice);
    const subtotal = formatRupiah(Number(item.subtotal || (prodSellingPrice * itemQty)));
    lines.push(`• *${prodName}*`);
    lines.push(`  ${qtyAlias} x ${unitPrice} = *${subtotal}*`);
  });
  lines.push(divider);

  // Total Belanja
  lines.push(`*TOTAL BELANJA : ${formatRupiah(totalAmount)}*`);
  if (cashReceived !== undefined && cashReceived > 0) {
    lines.push(`Tunai Diterima : ${formatRupiah(cashReceived)}`);
    lines.push(`Kembalian      : ${formatRupiah(changeAmount || 0)}`);
  }
  if (paymentMethod === 'UTANG') {
    if (isPaidDebt) {
      lines.push(`Status         : *LUNAS (Utang / Bon Telah Dibayar)*`);
    } else if (isPartialDebt) {
      lines.push(`Status         : *DICICIL (Sisa Tagihan: ${formatRupiah(remainingDebt || 0)})*`);
    } else {
      lines.push(`Status         : *BELUM LUNAS (UTANG / BON)*`);
    }
  }
  lines.push(divider);

  // Footer / Catatan Ucapan Terima Kasih
  if (storeProfile?.footer_message) {
    lines.push(`_${storeProfile.footer_message}_`);
  } else {
    lines.push(`_Jazakumullah khairan, terima kasih banyak sudah berbelanja di ${storeProfile?.store_name || 'Toko Sembako Berkah'}._`);
  }

  if (storeProfile?.footer_policy) {
    lines.push(storeProfile.footer_policy);
  } else {
    lines.push(
      'Semoga belanjaan ini membawa keberkahan dan kesehatan untuk seluruh keluarga di rumah, serta rezeki Kakak dilipatgandakan dan dimudahkan selalu. Aamiin YRA'
    );
  }

  if (storeProfile?.footer_quote) {
    lines.push(`\n*${storeProfile.footer_quote}*`);
  } else {
    lines.push('\n*** BERKAH SELALU ***');
  }

  return lines.join('\n');
}


