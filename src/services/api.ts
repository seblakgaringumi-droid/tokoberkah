import { supabase } from '../lib/supabase';
import { Product, Sale, SaleItem, Expense, Order, DebtCredit, StoreWallet, StoreProfile } from '../types';
import { roundStock } from '../lib/utils';

// ==================== LOCAL CACHE HELPERS ====================

const PRODUCTS_CACHE_KEY = 'pos_products_cache';
const PRODUCT_IMAGES_KEY = 'pos_product_images_cache';
const SALES_CACHE_KEY = 'pos_sales_cache';
const EXPENSES_CACHE_KEY = 'pos_expenses_cache';
const DEBTS_CACHE_KEY = 'pos_debts_cache';
const ORDERS_CACHE_KEY = 'pos_orders_cache';
const WALLET_CACHE_KEY = 'pos_wallet_cache';
const STORE_PROFILE_CACHE_KEY = 'pos_store_profile_cache';

export const DEFAULT_STORE_PROFILE: StoreProfile = {
  store_name: 'TOKO BERKAH',
  tagline: 'Sembako, Bumbu, & Kebutuhan Harian',
  address: 'Jl. Kapalanunggal I, Sindangkasih, Ciamis',
  phone: '0852-9499-6696',
  footer_message: 'Jazakumullah khairan, terima kasih banyak sudah berbelanja di Toko Sembako Berkah.',
  footer_policy: 'Semoga belanjaan ini membawa keberkahan dan kesehatan untuk seluruh keluarga di rumah, serta rezeki Kakak dilipatgandakan dan dimudahkan selalu. Aamiin Yaa Robbal Aalamiin',
  footer_quote: '*** BARAKALLAAHU FIIKUM ***',
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
    // Clean out any expired blob URLs from cache
    Object.keys(map).forEach((key) => {
      if (typeof map[key] === 'string' && map[key].startsWith('blob:')) {
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

// ==================== PRODUCTS ====================

export async function fetchProducts(): Promise<Product[]> {
  const localMap = getLocalImageMap();
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetch products returned error, using local cache:', error.message);
      const cached = getLocalProducts();
      if (cached.length > 0) {
        return cached.map((p) => {
          const rawImg = p.image_url || (p as any).image || localMap[p.id] || null;
          const validImg = rawImg && !rawImg.startsWith('blob:') ? rawImg : null;
          return { ...p, image_url: validImg };
        });
      }
      return [];
    }

    // Clean floating point artifacts and resolve permanent database image
    const processed: Product[] = (data || []).map((p: any) => {
      // Prioritize database image_url or image column
      const dbImg = p.image_url || p.image || null;
      const cachedImg = localMap[p.id] || null;
      const chosenImg = (dbImg && !dbImg.startsWith('blob:')) 
        ? dbImg 
        : (cachedImg && !cachedImg.startsWith('blob:') ? cachedImg : null);

      return {
        ...p,
        image_url: chosenImg,
        stock_kg: typeof p.stock_kg === 'number' ? roundStock(p.stock_kg) : p.stock_kg,
        min_stock: typeof p.min_stock === 'number' ? roundStock(p.min_stock) : p.min_stock,
      };
    });

    saveLocalProducts(processed);
    return processed;
  } catch (err: any) {
    console.warn('fetchProducts network/fetch exception, falling back to cache:', err);
    const cached = getLocalProducts();
    if (cached.length > 0) {
      return cached.map((p) => {
        const rawImg = p.image_url || (p as any).image || localMap[p.id] || null;
        const validImg = rawImg && !rawImg.startsWith('blob:') ? rawImg : null;
        return {
          ...p,
          image_url: validImg,
        };
      });
    }
    return [];
  }
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const cleanImageUrl = product.image_url && !product.image_url.startsWith('blob:') ? product.image_url : null;
  const cleanPayload = {
    ...product,
    image_url: cleanImageUrl,
    stock_kg: roundStock(Number(product.stock_kg) || 0),
    min_stock: roundStock(Number(product.min_stock) || 0),
  };

  const tempId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const localProduct: Product = {
    id: tempId,
    ...cleanPayload,
    image_url: cleanImageUrl,
  };

  if (cleanImageUrl) {
    saveLocalImage(tempId, cleanImageUrl);
  }

  const localList = getLocalProducts();
  saveLocalProducts([localProduct, ...localList]);

  try {
    const { data, error } = await supabase
      .from('products')
      .insert([cleanPayload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert note, checking column fallback:', error.message);
      if (cleanImageUrl) {
        // Retry with 'image' column in case database table used 'image' instead of 'image_url'
        const withAlternativeColumn = { ...cleanPayload, image: cleanImageUrl } as any;
        delete withAlternativeColumn.image_url;
        const { data: retryData, error: retryError } = await supabase
          .from('products')
          .insert([withAlternativeColumn])
          .select()
          .single();
        if (!retryError && retryData) {
          saveLocalImage(retryData.id, cleanImageUrl);
          return { ...retryData, image_url: cleanImageUrl };
        }
      }
      return localProduct;
    }

    const finalImageUrl = data.image_url || (data as any).image || cleanImageUrl;
    if (finalImageUrl) {
      saveLocalImage(data.id, finalImageUrl);
    }
    return { ...data, image_url: finalImageUrl };
  } catch (err) {
    console.warn('createProduct fetch exception, returned local product:', err);
    return localProduct;
  }
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const cleanUpdates = { ...updates };
  if (cleanUpdates.stock_kg !== undefined) {
    cleanUpdates.stock_kg = roundStock(Number(cleanUpdates.stock_kg) || 0);
  }
  if (cleanUpdates.min_stock !== undefined) {
    cleanUpdates.min_stock = roundStock(Number(cleanUpdates.min_stock) || 0);
  }

  // Ensure no blob: URL is sent
  if ('image_url' in cleanUpdates) {
    if (cleanUpdates.image_url && cleanUpdates.image_url.startsWith('blob:')) {
      cleanUpdates.image_url = null;
    }
    saveLocalImage(id, cleanUpdates.image_url || null);
  }

  // Update local cache immediately
  const localList = getLocalProducts();
  const idx = localList.findIndex((p) => String(p.id) === String(id));
  let updatedLocal: Product;
  if (idx >= 0) {
    updatedLocal = { ...localList[idx], ...cleanUpdates };
    localList[idx] = updatedLocal;
    saveLocalProducts(localList);
  } else {
    updatedLocal = { id, ...cleanUpdates } as Product;
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update note, checking image column fallback:', error.message);
      if ('image_url' in cleanUpdates) {
        const withAlternativeColumn = { ...cleanUpdates, image: cleanUpdates.image_url } as any;
        delete withAlternativeColumn.image_url;
        const { data: retryData, error: retryError } = await supabase
          .from('products')
          .update(withAlternativeColumn)
          .eq('id', id)
          .select()
          .single();
        if (!retryError && retryData) {
          const finalImg = retryData.image_url || retryData.image || cleanUpdates.image_url || null;
          saveLocalImage(id, finalImg);
          return { ...retryData, image_url: finalImg };
        }
      }
      return updatedLocal;
    }

    const finalImg = data.image_url || (data as any).image || cleanUpdates.image_url || null;
    if (finalImg) {
      saveLocalImage(data.id, finalImg);
    }
    return {
      ...data,
      image_url: finalImg,
    };
  } catch (err) {
    console.warn('updateProduct fetch error, preserved in local cache:', err);
    return updatedLocal;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const localList = getLocalProducts().filter((p) => String(p.id) !== String(id));
  saveLocalProducts(localList);
  saveLocalImage(id, null);

  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete product note:', error.message);
    }
  } catch (err) {
    console.warn('deleteProduct fetch note:', err);
  }
}

export async function adjustProductStock(id: string, deltaStock: number): Promise<void> {
  const localList = getLocalProducts();
  const idx = localList.findIndex((p) => String(p.id) === String(id));
  if (idx >= 0) {
    localList[idx].stock_kg = roundStock(Math.max(0, (localList[idx].stock_kg || 0) + deltaStock));
    saveLocalProducts(localList);
  }

  try {
    const { data: current, error: fetchErr } = await supabase
      .from('products')
      .select('stock_kg')
      .eq('id', id)
      .single();

    if (!fetchErr && current) {
      const newStock = roundStock(Math.max(0, Number(current.stock_kg || 0) + deltaStock));
      await supabase
        .from('products')
        .update({ stock_kg: newStock })
        .eq('id', id);
    }
  } catch (err) {
    console.warn('adjustProductStock note:', err);
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

// ==================== SALES & SALE ITEMS ====================

export interface CheckoutPayload {
  total_amount: number;
  payment_method: string;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  cash_received?: number;
  change_amount?: number;
  items: {
    product: Product;
    qty: number;
    unit: string;
    subtotal: number;
  }[];
  // If payment_method is UTANG
  debt_due_date?: string;
}

export async function processSale(payload: CheckoutPayload): Promise<{ sale: Sale; items: SaleItem[] }> {
  const tempSaleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  const constructedItems: SaleItem[] = payload.items.map((item, idx) => ({
    id: `item_${Date.now()}_${idx}`,
    sale_id: tempSaleId,
    product_id: item.product.id,
    qty_kg: item.qty,
    subtotal: item.subtotal,
    cost_price: item.product.cost_price || 0,
    original_qty: item.qty,
    unit: item.unit || item.product.unit || 'kg',
    custom_subtotal: item.subtotal,
    product: item.product,
  }));

  const localSale: Sale = {
    id: tempSaleId,
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

  // Pre-save to local sales cache
  const cachedSales = getLocalSales();
  saveLocalSales([localSale, ...cachedSales]);

  let finalSale = localSale;
  let finalItems = constructedItems;

  try {
    // 1. Insert into sales
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([{
        total_amount: payload.total_amount,
        payment_method: payload.payment_method,
        status: payload.payment_method === 'UTANG' ? 'unpaid' : 'paid',
        notes: payload.notes || (payload.customer_name ? `Pelanggan: ${payload.customer_name}` : null),
      }])
      .select()
      .single();

    if (!saleError && saleData) {
      finalSale = {
        ...saleData,
        items: constructedItems,
        sale_items: constructedItems,
        cash_received: payload.cash_received,
        change_amount: payload.change_amount,
        customer_name: payload.customer_name,
      };

      // 2. Insert into sale_items
      const saleItemsPayload = payload.items.map(item => ({
        sale_id: saleData.id,
        product_id: item.product.id,
        qty_kg: item.qty,
        subtotal: item.subtotal,
        cost_price: item.product.cost_price || 0,
        original_qty: item.qty,
        unit: item.unit || item.product.unit || 'kg',
        custom_subtotal: item.subtotal,
      }));

      const { data: insertedItems } = await supabase
        .from('sale_items')
        .insert(saleItemsPayload)
        .select();

      if (insertedItems && insertedItems.length > 0) {
        finalItems = insertedItems.map((ins, idx) => ({
          ...ins,
          product: payload.items[idx]?.product,
        }));
        finalSale.items = finalItems;
        finalSale.sale_items = finalItems;
      }

      // Update cache with real Supabase sale ID
      const updatedList = getLocalSales().map((s) => (s.id === tempSaleId ? finalSale : s));
      saveLocalSales(updatedList);

      // 3. Deduct stock for each product
      for (const item of payload.items) {
        try {
          const newStock = roundStock(Math.max(0, (item.product.stock_kg || 0) - item.qty));
          await supabase
            .from('products')
            .update({ stock_kg: newStock })
            .eq('id', item.product.id);
        } catch (stockErr) {
          console.warn('Failed to update product stock for', item.product.name, stockErr);
        }
      }

      // 4. If payment is UTANG, also create record in debts_credits
      if (payload.payment_method === 'UTANG') {
        try {
          await supabase
            .from('debts_credits')
            .insert([{
              type: 'PIUTANG',
              customer_or_supplier_name: payload.customer_name || 'Pelanggan Kasir',
              phone_number: payload.customer_phone || null,
              total_amount: payload.total_amount,
              remaining_amount: payload.total_amount,
              status: 'unpaid',
              due_date: payload.debt_due_date || null,
              sale_id: saleData.id,
              notes: `Transaksi kasir ${saleData.id.slice(0, 8)}`,
            }]);
        } catch (debtErr) {
          console.error('Failed to create debt record:', debtErr);
        }
      }
    }
  } catch (err) {
    console.warn('processSale Supabase write exception, using local store:', err);
  }

  return { sale: finalSale, items: finalItems };
}

export async function fetchSales(): Promise<Sale[]> {
  const localCached = getLocalSales();
  const localProducts = getLocalProducts();
  const productMap: Record<string, Product> = {};
  localProducts.forEach(p => { productMap[p.id] = p; });

  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          id,
          sale_id,
          product_id,
          qty_kg,
          subtotal,
          cost_price,
          unit,
          product:products (id, name, unit, selling_price, cost_price, image_url, category, barcode)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Sale items join fallback:', error.message);
      // Fallback: simple sales + sale_items
      const { data: simpleSales, error: simpleErr } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (simpleErr || !simpleSales) {
        if (localCached.length > 0) return localCached;
        return [];
      }

      // Try to fetch sale_items separately
      let allItems: any[] = [];
      try {
        const saleIds = simpleSales.map(s => s.id);
        if (saleIds.length > 0) {
          const { data: itemsData } = await supabase
            .from('sale_items')
            .select('*, product:products(*)')
            .in('sale_id', saleIds);
          allItems = itemsData || [];
        }
      } catch (itemFetchErr) {
        console.warn('Separate sale_items fetch error:', itemFetchErr);
      }

      const itemsBySaleId: Record<string, SaleItem[]> = {};
      for (const it of allItems) {
        if (!itemsBySaleId[it.sale_id]) itemsBySaleId[it.sale_id] = [];
        const prod = it.product || productMap[it.product_id];
        itemsBySaleId[it.sale_id].push({
          id: it.id,
          sale_id: it.sale_id,
          product_id: it.product_id,
          qty_kg: Number(it.qty_kg) || Number(it.original_qty) || 1,
          subtotal: Number(it.subtotal) || 0,
          cost_price: Number(it.cost_price) || 0,
          original_qty: Number(it.original_qty) || Number(it.qty_kg) || 1,
          unit: it.unit || prod?.unit || 'kg',
          product: prod,
        });
      }

      const mergedSales: Sale[] = simpleSales.map(s => {
        const cachedMatch = localCached.find(c => c.id === s.id);
        const items = itemsBySaleId[s.id] || cachedMatch?.items || [];
        return {
          ...s,
          items,
          sale_items: items,
          cash_received: cachedMatch?.cash_received,
          change_amount: cachedMatch?.change_amount,
          customer_name: cachedMatch?.customer_name,
        };
      });

      saveLocalSales(mergedSales);
      return mergedSales;
    }

    const normalizedSales: Sale[] = (data || []).map((sale: any) => {
      const rawItems = sale.sale_items || sale.items || [];
      const cachedMatch = localCached.find(c => c.id === sale.id);

      const items: SaleItem[] = rawItems.map((it: any) => {
        const prod = it.product || productMap[it.product_id] || (cachedMatch?.items?.find(ci => ci.product_id === it.product_id)?.product);
        return {
          id: it.id,
          sale_id: it.sale_id || sale.id,
          product_id: it.product_id,
          qty_kg: Number(it.qty_kg) || Number(it.original_qty) || 1,
          subtotal: Number(it.subtotal) || 0,
          cost_price: Number(it.cost_price) || 0,
          original_qty: Number(it.original_qty) || Number(it.qty_kg) || 1,
          unit: it.unit || prod?.unit || 'kg',
          product: prod ? {
            id: prod.id || it.product_id,
            name: prod.name || 'Barang Sembako',
            category: prod.category || 'Sembako',
            selling_price: prod.selling_price || (it.subtotal && it.qty_kg ? it.subtotal / it.qty_kg : 0),
            cost_price: prod.cost_price || it.cost_price || 0,
            stock_kg: prod.stock_kg || 0,
            min_stock: prod.min_stock || 0,
            is_active: true,
            image_url: prod.image_url || null,
            unit: prod.unit || it.unit || 'kg',
            barcode: prod.barcode || null,
          } : undefined,
        };
      });

      return {
        ...sale,
        items,
        sale_items: items,
        cash_received: cachedMatch?.cash_received,
        change_amount: cachedMatch?.change_amount,
        customer_name: cachedMatch?.customer_name,
      };
    });

    saveLocalSales(normalizedSales);
    return normalizedSales;
  } catch (err) {
    console.warn('fetchSales exception, fallback to local cache:', err);
    return localCached;
  }
}

// ==================== EXPENSES ====================

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }

  // Normalize source if not set in DB
  return (data || []).map((exp: any) => {
    let source = exp.source;
    if (!source) {
      const cat = (exp.category || '').toUpperCase();
      const title = (exp.title || '').toUpperCase();
      if (cat.includes('KAS BESAR') || title.includes('KAS BESAR') || cat.includes('CADANGAN')) {
        source = 'KAS_BESAR';
      } else {
        source = 'LACI';
      }
    }
    return {
      ...exp,
      source,
    };
  });
}

export async function createExpense(expense: { title: string; amount: number; category: string; source?: string }): Promise<Expense> {
  const expenseToInsert: any = {
    title: expense.title,
    amount: expense.amount,
    category: expense.category,
    source: expense.source || 'LACI',
  };

  const { data, error } = await supabase
    .from('expenses')
    .insert([expenseToInsert])
    .select()
    .single();

  if (error) {
    // If column 'source' does not exist in the database table schema, fallback
    if (error.message && (error.message.toLowerCase().includes('source') || error.message.toLowerCase().includes('column'))) {
      console.warn('Fallback: column source not found in expenses table, saving without source column');
      const fallbackExpense = {
        title: expense.title,
        amount: expense.amount,
        category: expense.source === 'KAS_BESAR' ? `${expense.category} (KAS BESAR)` : expense.category,
      };
      const { data: fbData, error: fbErr } = await supabase
        .from('expenses')
        .insert([fallbackExpense])
        .select()
        .single();
      if (fbErr) throw fbErr;
      return { ...fbData, source: expense.source || 'LACI' };
    }
    console.error('Error creating expense:', error);
    throw error;
  }
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

// ==================== ORDERS ====================

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
  return data || [];
}

export async function processOnlineSaleToReports(order: Order): Promise<Sale | null> {
  try {
    const orderIdStr = `#ORD-${order.id}`;
    const paymentMethodUpper = (order.payment_method || 'COD').toUpperCase();
    const isCash = paymentMethodUpper.includes('COD') || paymentMethodUpper.includes('TUNAI') || paymentMethodUpper === 'CASH';
    const finalPaymentMethod = isCash ? 'CASH' : (paymentMethodUpper.includes('QRIS') ? 'QRIS' : 'TRANSFER');

    // Parse items safely with fallbacks
    const rawItems = Array.isArray(order.items_json) ? order.items_json : [];
    const localProducts = getLocalProducts();
    const productMap: Record<string, Product> = {};
    localProducts.forEach(p => { productMap[p.id] = p; });

    const tempSaleId = `sale_online_${order.id}_${Date.now()}`;

    const constructedItems: SaleItem[] = rawItems.map((item: any, idx: number) => {
      const prodId = item.product_id || item.productId || item.id || `prod_${idx}`;
      const foundProd = productMap[prodId] || {
        id: String(prodId),
        name: item.product_name || item.name || item.title || 'Produk',
        category: 'Umum',
        cost_price: Number(item.cost_price) || (Number(item.price) || 0) * 0.8,
        selling_price: Number(item.price) || 0,
        stock_kg: 100,
        min_stock: 10,
        is_active: true,
        image_url: null,
        unit: item.unit || item.satuan || 'pcs',
        barcode: null
      };

      const qty = Number(item.qty || item.quantity || item.amount || 1);
      const subtotal = Number(item.subtotal || (Number(item.price || 0) * qty) || 0);

      return {
        id: `item_online_${Date.now()}_${idx}`,
        sale_id: tempSaleId,
        product_id: String(prodId),
        qty_kg: qty,
        subtotal: subtotal,
        cost_price: Number(foundProd.cost_price) || (Number(item.price || 0) * 0.8),
        original_qty: qty,
        unit: item.unit || item.satuan || foundProd.unit || 'pcs',
        custom_subtotal: subtotal,
        product: foundProd
      };
    });

    const localSale: Sale = {
      id: tempSaleId,
      total_amount: Number(order.total_amount) || 0,
      payment_method: finalPaymentMethod,
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
      notes: `Pesanan Online ${orderIdStr} - ${order.customer_name || 'Pelanggan'} (${order.delivery_address || ''})`,
      items: constructedItems,
      sale_items: constructedItems,
      cash_received: isCash ? Number(order.total_amount) : 0,
      change_amount: 0,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone
    };

    // Save to local cache first
    const cachedSales = getLocalSales();
    const existingIndex = cachedSales.findIndex(s => s.notes?.includes(orderIdStr) || s.id === tempSaleId);
    if (existingIndex >= 0) {
      cachedSales[existingIndex] = localSale;
      saveLocalSales([...cachedSales]);
    } else {
      saveLocalSales([localSale, ...cachedSales]);
    }

    // Try inserting into Supabase sales table
    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          total_amount: Number(order.total_amount) || 0,
          payment_method: finalPaymentMethod,
          status: 'COMPLETED',
          notes: `Pesanan Online ${orderIdStr} - ${order.customer_name || 'Pelanggan'} (${order.delivery_address || ''})`,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (!saleError && saleData) {
        const saleId = saleData.id;
        // Insert sale_items
        if (constructedItems.length > 0) {
          const itemsPayload = constructedItems.map(it => ({
            sale_id: saleId,
            product_id: it.product_id,
            qty_kg: it.qty_kg,
            subtotal: it.subtotal,
            cost_price: it.cost_price || 0,
            original_qty: it.original_qty || it.qty_kg,
            unit: it.unit || 'pcs',
            custom_subtotal: it.custom_subtotal || it.subtotal
          }));

          await supabase.from('sale_items').insert(itemsPayload);
        }

        const fullSale: Sale = {
          ...saleData,
          items: constructedItems,
          sale_items: constructedItems,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone
        };

        const updatedSales = getLocalSales().map(s => s.id === tempSaleId ? fullSale : s);
        saveLocalSales(updatedSales);
        return fullSale;
      }
    } catch (dbErr) {
      console.warn('Supabase insert online sale error, preserved in local cache:', dbErr);
    }

    return localSale;
  } catch (err) {
    console.error('Error processing online sale to reports:', err);
    return null;
  }
}

export async function updateOrderStatus(orderId: number, status: 'PENDING' | 'PROCESSED' | 'COMPLETED' | 'CANCELLED'): Promise<Order> {
  // 1. Fetch current order to check state
  let currentOrder: Order | null = null;
  try {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    currentOrder = data;
  } catch (fetchErr) {
    console.warn('Error reading order before update:', fetchErr);
  }

  // 2. If moving from PENDING to PROCESSED, deduct stock for products in items_json
  if (status === 'PROCESSED' && currentOrder && currentOrder.status === 'PENDING' && currentOrder.items_json) {
    try {
      const items = Array.isArray(currentOrder.items_json) ? currentOrder.items_json : [];
      for (const item of items) {
        const prodId = item.product_id || item.productId || item.id;
        const qty = Number(item.qty || item.quantity || item.amount) || 0;
        if (prodId && qty > 0) {
          try {
            const { data: prodData } = await supabase
              .from('products')
              .select('id, stock_kg, name')
              .eq('id', prodId)
              .single();

            if (prodData) {
              const currentStock = Number(prodData.stock_kg) || 0;
              const newStock = roundStock(Math.max(0, currentStock - qty));
              await supabase
                .from('products')
                .update({ stock_kg: newStock })
                .eq('id', prodId);
            }
          } catch (stockDeductErr) {
            console.warn(`Could not deduct stock for product ${prodId}:`, stockDeductErr);
          }
        }
      }
    } catch (orderCheckErr) {
      console.warn('Error reading order for stock deduction:', orderCheckErr);
    }
  }

  // 3. If completing the order (COMPLETED), record to Sales & Reports
  if (status === 'COMPLETED' && currentOrder && currentOrder.status !== 'COMPLETED') {
    try {
      await processOnlineSaleToReports(currentOrder);
    } catch (reportErr) {
      console.warn('Could not record online order to sales report:', reportErr);
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
  return data;
}

export async function createOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert([order])
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error);
    throw error;
  }
  return data;
}

// ==================== DEBTS & CREDITS ====================

export async function fetchDebtsCredits(): Promise<DebtCredit[]> {
  const { data, error } = await supabase
    .from('debts_credits')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching debts_credits:', error);
    throw error;
  }
  return data || [];
}

export async function createDebtCredit(debt: {
  type: 'UTANG' | 'PIUTANG' | string;
  customer_or_supplier_name: string;
  total_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date?: string | null;
  phone_number?: string | null;
  notes?: string | null;
}): Promise<DebtCredit> {
  const { data, error } = await supabase
    .from('debts_credits')
    .insert([debt])
    .select()
    .single();

  if (error) {
    console.error('Error creating debt credit:', error);
    throw error;
  }
  return data;
}

export async function payDebtCredit(id: string, paymentAmount: number): Promise<DebtCredit> {
  // 1. Fetch current remaining amount
  const { data: current, error: fetchErr } = await supabase
    .from('debts_credits')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr) throw fetchErr;

  const newRemaining = Math.max(0, Number(current.remaining_amount) - paymentAmount);
  const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

  const { data, error } = await supabase
    .from('debts_credits')
    .update({
      remaining_amount: newRemaining,
      status: newStatus,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error recording debt payment:', error);
    throw error;
  }
  return data;
}

export async function deleteDebtCredit(id: string): Promise<void> {
  const { error } = await supabase
    .from('debts_credits')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting debt record:', error);
    throw error;
  }
}

// ==================== STORE WALLETS ====================

export async function fetchStoreWallets(): Promise<StoreWallet | null> {
  const { data, error } = await supabase
    .from('store_wallets')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching store_wallets:', error);
    return null;
  }
  return data;
}

export async function updateStoreWallet(id: number, updates: Partial<StoreWallet>): Promise<StoreWallet> {
  const { data, error } = await supabase
    .from('store_wallets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating store wallet:', error);
    throw error;
  }
  return data;
}

export async function upsertStoreWallet(wallet: StoreWallet): Promise<StoreWallet> {
  const { data, error } = await supabase
    .from('store_wallets')
    .upsert(wallet)
    .select()
    .single();

  if (error) {
    console.error('Error upserting store wallet:', error);
    throw error;
  }
  return data;
}

// ==================== STORE PROFILE & RECEIPT SETTINGS ====================

export async function fetchStoreProfile(): Promise<StoreProfile> {
  // 1. Check local storage cache first
  let cached: StoreProfile = DEFAULT_STORE_PROFILE;
  try {
    const raw = localStorage.getItem(STORE_PROFILE_CACHE_KEY);
    if (raw) {
      cached = { ...DEFAULT_STORE_PROFILE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Error reading store profile cache:', e);
  }

  // 2. Try fetching from Supabase table `store_profile` or `settings` if available
  try {
    const { data, error } = await supabase
      .from('store_profile')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const merged: StoreProfile = {
        store_name: data.store_name || data.name || cached.store_name,
        tagline: data.tagline || data.category || cached.tagline,
        address: data.address || cached.address,
        phone: data.phone || data.whatsapp || cached.phone,
        footer_message: data.footer_message || cached.footer_message,
        footer_policy: data.footer_policy || cached.footer_policy,
        footer_quote: data.footer_quote || cached.footer_quote,
      };
      try {
        localStorage.setItem(STORE_PROFILE_CACHE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (err) {
    // If table doesn't exist yet, gracefully use local cached
  }

  return cached;
}

export async function saveStoreProfile(profile: StoreProfile): Promise<StoreProfile> {
  const cleanProfile: StoreProfile = {
    store_name: profile.store_name?.trim() || DEFAULT_STORE_PROFILE.store_name,
    tagline: profile.tagline?.trim() || DEFAULT_STORE_PROFILE.tagline,
    address: profile.address?.trim() || DEFAULT_STORE_PROFILE.address,
    phone: profile.phone?.trim() || DEFAULT_STORE_PROFILE.phone,
    footer_message: profile.footer_message?.trim() || DEFAULT_STORE_PROFILE.footer_message,
    footer_policy: profile.footer_policy?.trim() || DEFAULT_STORE_PROFILE.footer_policy,
    footer_quote: profile.footer_quote?.trim() || DEFAULT_STORE_PROFILE.footer_quote,
  };

  // 1. Save to local storage for immediate persistence
  try {
    localStorage.setItem(STORE_PROFILE_CACHE_KEY, JSON.stringify(cleanProfile));
  } catch (e) {
    console.warn('Failed to save store profile to localStorage:', e);
  }

  // 2. Attempt upsert to Supabase
  try {
    await supabase
      .from('store_profile')
      .upsert({
        id: 1,
        ...cleanProfile,
        updated_at: new Date().toISOString(),
      });
  } catch (err) {
    console.info('Saved store profile locally (store_profile table optional in Supabase)');
  }

  return cleanProfile;
}

// ==================== INITIAL DATA SEEDER (IF EMPTY) ====================

export async function seedInitialProductsIfEmpty(): Promise<boolean> {
  try {
    const { data: existing, error } = await supabase.from('products').select('id').limit(1);
    if (error) return false;
    if (existing && existing.length > 0) return false; // Already has data

    const sampleProducts = [
      {
        name: 'Beras Pandan Wangi Super',
        category: 'Sembako',
        cost_price: 13500,
        selling_price: 16000,
        stock_kg: 100,
        min_stock: 20,
        is_active: true,
        unit: 'kg',
        barcode: '899100100001',
      },
      {
        name: 'Minyak Goreng Bimoli 2 Liter',
        category: 'Sembako',
        cost_price: 32000,
        selling_price: 36000,
        stock_kg: 40,
        min_stock: 10,
        is_active: true,
        unit: 'pouch',
        barcode: '899100100002',
      },
      {
        name: 'Gula Pasir Gulaku 1kg',
        category: 'Sembako',
        cost_price: 15500,
        selling_price: 18000,
        stock_kg: 50,
        min_stock: 15,
        is_active: true,
        unit: 'bungkus',
        barcode: '899100100003',
      },
      {
        name: 'Telur Ayam Ras Segar',
        category: 'Sembako',
        cost_price: 26000,
        selling_price: 29500,
        stock_kg: 35,
        min_stock: 10,
        is_active: true,
        unit: 'kg',
        barcode: '899100100004',
      },
      {
        name: 'Bawang Merah Brebes Pilihan',
        category: 'Bumbu Dapur',
        cost_price: 30000,
        selling_price: 38000,
        stock_kg: 15,
        min_stock: 5,
        is_active: true,
        unit: 'kg',
        barcode: '899100100005',
      },
      {
        name: 'Bawang Putih Kating',
        category: 'Bumbu Dapur',
        cost_price: 34000,
        selling_price: 42000,
        stock_kg: 12,
        min_stock: 5,
        is_active: true,
        unit: 'kg',
        barcode: '899100100006',
      },
      {
        name: 'Cabai Merah Keriting Segar',
        category: 'Sayur & Bumbu',
        cost_price: 40000,
        selling_price: 52000,
        stock_kg: 8,
        min_stock: 5,
        is_active: true,
        unit: 'kg',
        barcode: '899100100007',
      },
      {
        name: 'Tepung Terigu Segitiga Biru 1kg',
        category: 'Sembako',
        cost_price: 11000,
        selling_price: 13000,
        stock_kg: 30,
        min_stock: 8,
        is_active: true,
        unit: 'bungkus',
        barcode: '899100100008',
      },
      {
        name: 'Indomie Goreng Original (Karton)',
        category: 'Makanan Instan',
        cost_price: 108000,
        selling_price: 118000,
        stock_kg: 15,
        min_stock: 5,
        is_active: true,
        unit: 'karton',
        barcode: '899100100009',
      },
      {
        name: 'Kecap Manis Bango 520ml',
        category: 'Bumbu Dapur',
        cost_price: 21000,
        selling_price: 24500,
        stock_kg: 24,
        min_stock: 6,
        is_active: true,
        unit: 'pouch',
        barcode: '899100100010',
      },
    ];

    const { error: insertErr } = await supabase.from('products').insert(sampleProducts);
    if (insertErr) {
      console.warn('Auto-seed products info:', insertErr.message);
      return false;
    }

    // Also initialize store_wallets if not present
    const { data: walletData } = await supabase.from('store_wallets').select('id').limit(1);
    if (!walletData || walletData.length === 0) {
      await supabase.from('store_wallets').insert([{
        id: 1,
        initial_cash: 500000,
        shopping_budget: 2000000,
        operational_budget: 750000,
        owner_budget: 1000000,
      }]);
    }

    return true;
  } catch (err) {
    console.warn('Seeding check exception:', err);
    return false;
  }
}
