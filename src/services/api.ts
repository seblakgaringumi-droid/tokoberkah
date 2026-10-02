import { supabase } from '../lib/supabase';
import { Product, Sale, SaleItem, Expense, Order, DebtCredit, DebtPayment, CashFlowEntry, StoreWallet, StoreProfile } from '../types';
import { roundStock } from '../lib/utils';

// ==================== LOCAL CACHE HELPERS ====================

const PRODUCTS_CACHE_KEY = 'pos_products_cache';
const PRODUCT_IMAGES_KEY = 'pos_product_images_cache';
const SALES_CACHE_KEY = 'pos_sales_cache';
const EXPENSES_CACHE_KEY = 'pos_expenses_cache';
const DEBTS_CACHE_KEY = 'pos_debts_cache';
const DEBT_PAYMENTS_CACHE_KEY = 'pos_debt_payments_cache';
const CASH_FLOW_CACHE_KEY = 'pos_cash_flow_cache';
const ORDERS_CACHE_KEY = 'pos_orders_cache';
const WALLET_CACHE_KEY = 'pos_wallet_cache';
const STORE_PROFILE_CACHE_KEY = 'pos_store_profile_cache';

export const DEFAULT_STORE_PROFILE: StoreProfile = {
  store_name: 'TOKO BERKAH',
  tagline: 'Sembako, Bumbu, & Kebutuhan Harian',
  address: 'Jl. Berkah Raya No. 88, Sejahtera',
  phone: '0812-3456-7890',
  footer_message: 'Terima kasih atas kunjungan Anda!',
  footer_policy: 'Barang yang sudah dibeli dapat ditukar jika ada kerusakan dalam 1x24 jam.',
  footer_quote: '*** BERKAH SELALU ***',
};

function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalProducts(products: Product[]) {
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  } catch (e) {
    console.warn('Local storage save products note:', e);
  }
}

function getLocalImageMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PRODUCT_IMAGES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    Object.keys(map).forEach((key) => {
      if (typeof map[key] === 'string' && (map[key].startsWith('blob:') || map[key].includes('kquxfvcbgogjpthhsseg'))) {
        delete map[key];
      }
    });
    return map;
  } catch {
    return {};
  }
}

function saveLocalImage(id: string, url: string | null) {
  try {
    const map = getLocalImageMap();
    if (url && !url.startsWith('blob:')) {
      map[id] = url;
    } else {
      delete map[id];
    }
    localStorage.setItem(PRODUCT_IMAGES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Local storage save image note:', e);
  }
}

function getLocalWallet(): StoreWallet {
  try {
    const raw = localStorage.getItem(WALLET_CACHE_KEY);
    return raw ? JSON.parse(raw) : {
      id: 1,
      initial_cash: 0,
      operational_budget: 0,
      shopping_budget: 0,
      owner_budget: 0,
    };
  } catch {
    return {
      id: 1,
      initial_cash: 0,
      operational_budget: 0,
      shopping_budget: 0,
      owner_budget: 0,
    };
  }
}

function getLocalSales(): Sale[] {
  try {
    const raw = localStorage.getItem(SALES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSales(sales: Sale[]) {
  try {
    localStorage.setItem(SALES_CACHE_KEY, JSON.stringify(sales));
  } catch (e) {
    console.warn('Local storage save sales note:', e);
  }
}

export function getLocalDebts(): DebtCredit[] {
  try {
    const raw = localStorage.getItem(DEBTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalDebts(debts: DebtCredit[]) {
  try {
    localStorage.setItem(DEBTS_CACHE_KEY, JSON.stringify(debts));
  } catch (e) {
    console.warn('Local storage save debts note:', e);
  }
}

export function getLocalDebtPayments(): DebtPayment[] {
  try {
    const raw = localStorage.getItem(DEBT_PAYMENTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalDebtPayments(payments: DebtPayment[]) {
  try {
    localStorage.setItem(DEBT_PAYMENTS_CACHE_KEY, JSON.stringify(payments));
  } catch (e) {
    console.warn('Local storage save debt payments note:', e);
  }
}

export function getLocalCashFlow(): CashFlowEntry[] {
  try {
    const raw = localStorage.getItem(CASH_FLOW_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalCashFlow(entries: CashFlowEntry[]) {
  try {
    localStorage.setItem(CASH_FLOW_CACHE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Local storage save cash flow note:', e);
  }
}

function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: Order[]) {
  try {
    localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn('Local storage save orders note:', e);
  }
}

// ==================== PRODUCTS ====================

export async function fetchProducts(): Promise<Product[]> {
  const localMap = getLocalImageMap();
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      const cached = getLocalProducts();
      return cached;
    }

    const processed: Product[] = (data || []).map((p: any) => {
      const dbImg = p.image_url || p.image || null;
      const cachedImg = localMap[p.id] || null;
      let chosenImg = (dbImg && !dbImg.startsWith('blob:')) ? dbImg : (cachedImg && !cachedImg.startsWith('blob:') ? cachedImg : null);

      if (chosenImg && chosenImg.includes('kquxfvcbgogjpthhsseg')) {
        chosenImg = chosenImg.replace('kquxfvcbgogjpthhsseg.supabase.co', 'bjogkxquvqgikypjpmkz.supabase.co');
      }
      if (chosenImg && chosenImg.includes(' ') && !chosenImg.includes('%20')) {
        const urlParts = chosenImg.split('/products/');
        if (urlParts.length === 2) {
          chosenImg = `${urlParts[0]}/products/${encodeURIComponent(urlParts[1])}`;
        }
      }

      return {
        ...p,
        image_url: chosenImg,
        stock_kg: typeof p.stock_kg === 'number' ? roundStock(p.stock_kg, p.unit) : p.stock_kg,
        min_stock: typeof p.min_stock === 'number' ? roundStock(p.min_stock, p.unit) : p.min_stock,
      };
    });

    saveLocalProducts(processed);
    return processed;
  } catch {
    return getLocalProducts();
  }
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const cleanImageUrl = product.image_url && !product.image_url.startsWith('blob:') ? product.image_url : null;
  const cleanPayload = {
    ...product,
    image_url: cleanImageUrl,
    stock_kg: roundStock(Number(product.stock_kg) || 0, product.unit),
    min_stock: roundStock(Number(product.min_stock) || 0, product.unit),
  };

  const tempId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const localProduct: Product = { id: tempId, ...cleanPayload, image_url: cleanImageUrl };
  if (cleanImageUrl) saveLocalImage(tempId, cleanImageUrl);
  saveLocalProducts([localProduct, ...getLocalProducts()]);

  try {
    const { data, error } = await supabase.from('products').insert([cleanPayload]).select().single();
    if (error) return localProduct;
    if (data.image_url) saveLocalImage(data.id, data.image_url);
    return data;
  } catch {
    return localProduct;
  }
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const cleanUpdates = { ...updates };
  if (cleanUpdates.stock_kg !== undefined) cleanUpdates.stock_kg = roundStock(Number(cleanUpdates.stock_kg) || 0, cleanUpdates.unit);
  if (cleanUpdates.min_stock !== undefined) cleanUpdates.min_stock = roundStock(Number(cleanUpdates.min_stock) || 0, cleanUpdates.unit);

  if ('image_url' in cleanUpdates) {
    if (cleanUpdates.image_url?.startsWith('blob:')) cleanUpdates.image_url = null;
    saveLocalImage(id, cleanUpdates.image_url || null);
  }

  const localList = getLocalProducts();
  const idx = localList.findIndex((p) => String(p.id) === String(id));
  let updatedLocal: Product = idx >= 0 ? { ...localList[idx], ...cleanUpdates } : { id, ...updates } as Product;
  if (idx >= 0) { localList[idx] = updatedLocal; saveLocalProducts(localList); }

  try {
    const { data, error } = await supabase.from('products').update(cleanUpdates).eq('id', id).select().single();
    if (error) return updatedLocal;
    return data;
  } catch {
    return updatedLocal;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  saveLocalProducts(getLocalProducts().filter((p) => String(p.id) !== String(id)));
  saveLocalImage(id, null);
  try { await supabase.from('products').delete().eq('id', id); } catch {}
}

export async function adjustProductStock(id: string, deltaStock: number): Promise<void> {
  const localList = getLocalProducts();
  const idx = localList.findIndex((p) => String(p.id) === String(id));
  if (idx >= 0) {
    localList[idx].stock_kg = roundStock(Math.max(0, (localList[idx].stock_kg || 0) + deltaStock), localList[idx].unit);
    saveLocalProducts(localList);
  }
  try {
    const { data } = await supabase.from('products').select('stock_kg, unit').eq('id', id).single();
    if (data) {
      const newStock = roundStock(Math.max(0, Number(data.stock_kg || 0) + deltaStock), data.unit);
      await supabase.from('products').update({ stock_kg: newStock }).eq('id', id);
    }
  } catch {}
}

// ==================== SALES ====================

export interface CheckoutPayload {
  total_amount: number;
  payment_method: string;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  cash_received?: number;
  change_amount?: number;
  items: { product: Product; qty: number; unit: string; subtotal: number }[];
  debt_due_date?: string;
}

export async function processSale(payload: CheckoutPayload): Promise<{ sale: Sale; items: SaleItem[] }> {
  const generatedUuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  const constructedItems: SaleItem[] = payload.items.map((item, idx) => ({
    id: `item_${Date.now()}_${idx}`,
    sale_id: generatedUuid,
    product_id: item.product.id,
    qty_kg: item.qty,
    qty: item.qty,
    subtotal: item.subtotal,
    cost_price: item.product.cost_price || 0,
    original_qty: item.qty,
    unit: item.unit || item.product.unit || 'kg',
    custom_subtotal: item.subtotal,
    product: item.product,
  }));

  const localSale: Sale = {
    id: generatedUuid,
    total_amount: payload.total_amount,
    payment_method: payload.payment_method,
    status: payload.payment_method === 'UTANG' ? 'unpaid' : 'paid',
    created_at: new Date().toISOString(),
    notes: payload.notes || (payload.customer_name ? `Pelanggan: ${payload.customer_name}` : null),
    items: constructedItems,
    sale_items: constructedItems,
    cash_received: payload.cash_received,
    change_amount: payload.change_amount,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
  };

  saveLocalSales([localSale, ...getLocalSales()]);

  try {
    await supabase.from('sales').insert([{
      id: generatedUuid,
      total_amount: payload.total_amount,
      payment_method: payload.payment_method,
      status: payload.payment_method === 'UTANG' ? 'unpaid' : 'paid',
      notes: localSale.notes,
    }]);

    const saleItemsPayload = payload.items.map(item => ({
      sale_id: generatedUuid,
      product_id: item.product.id,
      qty_kg: item.qty,
      subtotal: item.subtotal,
      cost_price: item.product.cost_price || 0,
      original_qty: item.qty,
      unit: item.unit || item.product.unit || 'kg',
      custom_subtotal: item.subtotal,
    }));

    await supabase.from('sale_items').insert(saleItemsPayload);

    for (const item of payload.items) {
      const { data: cur } = await supabase.from('products').select('stock_kg, unit').eq('id', item.product.id).single();
      if (cur) {
        const newStock = roundStock(Math.max(0, Number(cur.stock_kg || 0) - item.qty), cur.unit);
        await supabase.from('products').update({ stock_kg: newStock }).eq('id', item.product.id);
      }
    }

    if (payload.payment_method === 'UTANG') {
      await createDebtCredit({
        type: 'PIUTANG',
        customer_or_supplier_name: payload.customer_name || 'Pelanggan Utang',
        phone_number: payload.customer_phone || null,
        total_amount: payload.total_amount,
        remaining_amount: payload.total_amount,
        status: 'unpaid',
        due_date: payload.debt_due_date || null,
        notes: `Transaksi kasir ${generatedUuid.slice(0, 8)}`,
      });
    }
  } catch (err) {
    console.warn('processSale remote write note:', err);
  }

  return { sale: localSale, items: constructedItems };
}

export async function fetchSales(): Promise<Sale[]> {
  const localCached = getLocalSales();
  const localProducts = getLocalProducts();
  const productMap: Record<string, Product> = {};
  localProducts.forEach(p => { productMap[p.id] = p; });

  try {
    const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
    if (error || !data) return localCached.length > 0 ? localCached : [];

    const { data: itemsData } = await supabase.from('sale_items').select('*');
    const allSaleItems = itemsData || [];

    const itemsBySaleId: Record<string, SaleItem[]> = {};
    for (const it of allSaleItems) {
      if (!itemsBySaleId[it.sale_id]) itemsBySaleId[it.sale_id] = [];
      const prod = productMap[it.product_id] || {
        id: it.product_id, name: 'Produk Kasir', category: 'Sembako',
        selling_price: it.subtotal && it.qty_kg ? it.subtotal / it.qty_kg : 0,
        cost_price: it.cost_price || 0, stock_kg: 0, min_stock: 0, is_active: true, image_url: null, unit: it.unit || 'pcs'
      };
      itemsBySaleId[it.sale_id].push({
        id: it.id, sale_id: it.sale_id, product_id: it.product_id,
        qty_kg: Number(it.qty_kg) || 1, subtotal: Number(it.subtotal) || 0,
        cost_price: Number(it.cost_price) || 0, original_qty: Number(it.qty_kg) || 1,
        unit: it.unit || prod.unit, product: prod
      });
    }

    const normalizedSales: Sale[] = data.map((sale: any) => {
      const cachedMatch = localCached.find(c => c.id === sale.id);
      const items = itemsBySaleId[sale.id] || cachedMatch?.items || [];
      return { ...sale, items, sale_items: items, customer_name: cachedMatch?.customer_name };
    });

    saveLocalSales(normalizedSales);
    return normalizedSales;
  } catch {
    return localCached;
  }
}

// ==================== EXPENSES ====================

export async function fetchExpenses(): Promise<Expense[]> {
  try {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  } catch { return []; }
}

export async function createExpense(expense: { title: string; amount: number; category: string; source?: string }): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').insert([{ ...expense, source: expense.source || 'LACI' }]).select().single();
  if (error) throw error;
  return data;
}

// ==================== DEBTS & CREDITS ====================

export function getSaleDebtInfo(sale: Sale, debts?: DebtCredit[]): UtangSyncInfo {
  const isUtang = (sale.payment_method || '').toUpperCase() === 'UTANG';
  if (!isUtang) {
    return {
      isUtang: false, isLunas: true, isPartial: false, isUnpaid: false, remainingAmount: 0, totalAmount: Number(sale.total_amount || 0), matchingDebt: null,
      statusBadge: { label: 'Lunas', bg: 'bg-emerald-50 text-[#1B5E20] border-emerald-200', badgeText: 'LUNAS' }
    };
  }
  const allDebts = debts && debts.length > 0 ? debts : getLocalDebts();
  const saleTag = sale.id ? sale.id.slice(0, 8).toLowerCase() : '';
  const matchingDebt = allDebts.find(d => d && (d.notes || '').toLowerCase().includes(saleTag));
  const remaining = matchingDebt ? Number(matchingDebt.remaining_amount) : Number(sale.total_amount || 0);
  const isLunas = remaining <= 0;

  return {
    isUtang: true, isLunas, isPartial: !isLunas && remaining < Number(sale.total_amount || 0), isUnpaid: !isLunas && remaining === Number(sale.total_amount || 0),
    remainingAmount: Math.max(0, remaining), totalAmount: Number(sale.total_amount || 0), matchingDebt: matchingDebt || null,
    statusBadge: {
      label: isLunas ? 'Utang (Lunas)' : 'Utang (Belum Lunas)',
      bg: isLunas ? 'bg-emerald-50 text-[#1B5E20] border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300',
      badgeText: isLunas ? 'LUNAS' : 'BELUM LUNAS'
    }
  };
}

export async function fetchDebtsCredits(): Promise<DebtCredit[]> {
  try {
    const { data, error } = await supabase.from('debts_credits').select('*').order('created_at', { ascending: false });
    if (error) return getLocalDebts();
    const list = (data || []).filter(Boolean);
    saveLocalDebts(list);
    return list;
  } catch { return getLocalDebts(); }
}

export async function createDebtCredit(debt: any): Promise<DebtCredit> {
  const item = { id: `debt_${Date.now()}`, ...debt, created_at: new Date().toISOString() };
  saveLocalDebts([item, ...getLocalDebts()]);
  try {
    const { data, error } = await supabase.from('debts_credits').insert([debt]).select().single();
    if (!error && data) return data;
  } catch {}
  return item;
}

export async function payDebtCredit(id: string, paymentAmount: number): Promise<DebtCredit> {
  const cached = getLocalDebts();
  const cur = cached.find(d => d.id === id);
  const rem = Math.max(0, (cur ? Number(cur.remaining_amount) : paymentAmount) - paymentAmount);
  const updated = cached.map(d => d.id === id ? { ...d, remaining_amount: rem, status: rem <= 0 ? 'paid' : 'partial' as any } : d);
  saveLocalDebts(updated);
  try {
    const { data } = await supabase.from('debts_credits').select('*').eq('id', id).single();
    if (data) {
      const dbRem = Math.max(0, Number(data.remaining_amount) - paymentAmount);
      await supabase.from('debts_credits').update({ remaining_amount: dbRem, status: dbRem <= 0 ? 'paid' : 'partial' }).eq('id', id);
    }
  } catch {}
  return cur ? { ...cur, remaining_amount: rem, status: rem <= 0 ? 'paid' : 'partial' } : ({} as DebtCredit);
}

export async function deleteDebtCredit(id: string): Promise<void> {
  saveLocalDebts(getLocalDebts().filter(d => d.id !== id));
  try { await supabase.from('debts_credits').delete().eq('id', id); } catch {}
}

export async function recordDebtPayment(payload: { debt_id: string; customer_name?: string; amount: number; payment_method: string; notes?: string | null }): Promise<DebtPayment> {
  const dp: DebtPayment = {
    id: `dp_${Date.now()}`, debt_id: payload.debt_id, customer_name: payload.customer_name || 'Pelanggan',
    amount: Number(payload.amount), payment_method: payload.payment_method || 'TUNAI', type: 'INCOME_DEBT_PAYMENT',
    created_at: new Date().toISOString(), notes: payload.notes || null
  };
  saveLocalDebtPayments([dp, ...getLocalDebtPayments()]);
  await payDebtCredit(payload.debt_id, dp.amount);
  try { await supabase.from('debt_payments').insert([dp]); } catch {}
  return dp;
}

// ==================== ORDERS ====================

export async function fetchOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return getLocalOrders();
    saveLocalOrders(data || []);
    return data || [];
  } catch { return getLocalOrders(); }
}

export async function createOrder(order: any): Promise<Order> {
  const { data, error } = await supabase.from('orders').insert([order]).select().single();
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId: number, status: any): Promise<Order> {
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select().single();
  if (error) throw error;
  return data;
}

// ==================== STORE PROFILE ====================

export async function fetchStoreProfile(): Promise<StoreProfile> {
  try {
    const { data } = await supabase.from('store_profile').select('*').limit(1).maybeSingle();
    if (data) return { store_name: data.store_name, tagline: data.tagline, address: data.address, phone: data.phone, footer_message: data.footer_message, footer_policy: data.footer_policy, footer_quote: data.footer_quote };
  } catch {}
  return DEFAULT_STORE_PROFILE;
}

export async function saveStoreProfile(profile: StoreProfile): Promise<StoreProfile> {
  try {
    await supabase.from('store_profile').upsert({ id: 1, ...profile, updated_at: new Date().toISOString() });
  } catch {}
  return profile;
}

export async function seedInitialProductsIfEmpty(): Promise<boolean> {
  try {
    const { data } = await supabase.from('products').select('id').limit(1);
    return !!(data && data.length > 0);
  } catch { return false; }
}

export interface UtangSyncInfo {
  isUtang: boolean; isLunas: boolean; isPartial: boolean; isUnpaid: boolean;
  remainingAmount: number; totalAmount: number; matchingDebt?: DebtCredit | null;
  statusBadge: { label: string; bg: string; badgeText: string };
}

// ==================== STORE WALLETS ====================

export async function fetchStoreWallets(): Promise<StoreWallet | null> {
  try {
    const { data, error } = await supabase
      .from('store_wallets')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      return { id: 1, initial_cash: 0, operational_budget: 0, shopping_budget: 0, owner_budget: 0 };
    }
    return data || { id: 1, initial_cash: 0, operational_budget: 0, shopping_budget: 0, owner_budget: 0 };
  } catch {
    return { id: 1, initial_cash: 0, operational_budget: 0, shopping_budget: 0, owner_budget: 0 };
  }
}

export async function updateStoreWallet(id: number, updates: Partial<StoreWallet>): Promise<StoreWallet> {
  const { data, error } = await supabase
    .from('store_wallets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertStoreWallet(wallet: StoreWallet): Promise<StoreWallet> {
  const { data, error } = await supabase
    .from('store_wallets')
    .upsert(wallet)
    .select()
    .single();

  if (error) throw error;
  return data;
}
export interface DeleteSaleItemResult {
  success: boolean;
  updatedSale?: Sale;
  deletedItemName?: string;
  restoredQty?: number;
  restoredUnit?: string;
  newTotalAmount?: number;
  error?: string;
}

export async function deleteSaleItem(
  saleId: string,
  itemId: string,
  productId: string,
  qtyToRestore: number,
  subtotalToDeduct: number,
  restoreStock: boolean = true
): Promise<DeleteSaleItemResult> {
  try {
    const localSales = getLocalSales();
    const existingSale = localSales.find(s => s.id === saleId);
    const existingItems = existingSale?.items || existingSale?.sale_items || [];
    
    const targetItem = existingItems.find(it => 
      (itemId && it.id === itemId) || (productId && it.product_id === productId)
    );
    
    const prodName = targetItem?.product?.name || 'Produk';
    const prodUnit = targetItem?.unit || targetItem?.product?.unit || 'pcs';
    const actualQty = qtyToRestore || Number(targetItem?.qty_kg || targetItem?.qty || 1);
    const actualSubtotal = subtotalToDeduct || Number(targetItem?.subtotal || 0);

    if (itemId && !itemId.startsWith('item_modal_') && !itemId.startsWith('item_temp_')) {
      await supabase.from('sale_items').delete().eq('id', itemId);
    } else if (saleId && productId) {
      await supabase.from('sale_items').delete().eq('sale_id', saleId).eq('product_id', productId);
    }

    if (restoreStock && productId) {
      try {
        const { data: prodData } = await supabase.from('products').select('stock_kg, unit').eq('id', productId).single();
        if (prodData) {
          const newStock = roundStock((prodData.stock_kg || 0) + actualQty, prodData.unit);
          await supabase.from('products').update({ stock_kg: newStock }).eq('id', productId);
        }
      } catch {}

      const localProds = getLocalProducts();
      saveLocalProducts(localProds.map(p => p.id === productId ? { ...p, stock_kg: roundStock((p.stock_kg || 0) + actualQty, p.unit) } : p));
    }

    const remainingItems = existingItems.filter(it => !((itemId && it.id === itemId) || (productId && it.product_id === productId)));
    const newTotal = Math.max(0, remainingItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0));
    
    try {
      await supabase.from('sales').update({ total_amount: newTotal }).eq('id', saleId);
    } catch {}

    let updatedSale: Sale | undefined;
    const updatedSales = localSales.map(s => {
      if (s.id === saleId) {
        const up: Sale = { ...s, total_amount: newTotal, items: remainingItems, sale_items: remainingItems };
        updatedSale = up;
        return up;
      }
      return s;
    });
    saveLocalSales(updatedSales);

    return { success: true, updatedSale, deletedItemName: prodName, restoredQty: actualQty, restoredUnit: prodUnit, newTotalAmount: newTotal };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus item transaksi' };
  }
}
export async function syncCompletedOrdersToSales(): Promise<{ syncedCount: number; sales: Sale[] }> {
  try {
    const [orders, sales] = await Promise.all([fetchOrders(), fetchSales()]);
    const completedOrders = orders.filter(o => (o.status || '').toUpperCase() === 'COMPLETED');
    let syncedCount = 0;

    for (const order of completedOrders) {
      const orderIdStr = `#ORD-${order.id}`;
      const existingSale = sales.find(s => s.notes?.includes(orderIdStr) || s.id === `sale_online_${order.id}`);
      if (!existingSale) {
        try {
          const tempSaleId = `sale_online_${order.id}`;
          const salePayload = {
            id: tempSaleId,
            total_amount: Number(order.total_amount) || 0,
            payment_method: order.payment_method || 'COD',
            status: 'COMPLETED',
            notes: `Pesanan Online ${orderIdStr} - ${order.customer_name || 'Pelanggan'}`,
            created_at: order.created_at || new Date().toISOString()
          };
          await supabase.from('sales').insert([salePayload]);
          syncedCount++;
        } catch {}
      }
    }
    const updatedSales = await fetchSales();
    return { syncedCount, sales: updatedSales };
  } catch {
    return { syncedCount: 0, sales: getLocalSales() };
  }
}
export async function deleteExpense(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Error deleting expense:', err);
    throw err;
  }
}
