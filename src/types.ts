export interface Product {
  id: string;
  name: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_kg: number;
  min_stock: number;
  is_active: boolean;
  image_url: string | null;
  unit: string;
  variants_json?: any;
  barcode: string | null;
}

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  qty_kg: number;
  subtotal: number;
  cost_price?: number;
  original_qty?: number;
  unit: string;
  custom_subtotal?: number | null;
  product?: Product;
}

export interface Sale {
  id: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  status: string;
  notes?: string | null;
  items?: SaleItem[];
  sale_items?: SaleItem[];
  cash_received?: number;
  change_amount?: number;
  customer_name?: string;
  customer_phone?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  unit: string;
  subtotal: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  created_at: string;
  category: string;
  source?: 'LACI' | 'KAS_BESAR' | string;
}

export interface OrderItem {
  id?: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items_json: OrderItem[] | any;
  total_amount: number;
  payment_method: string;
  status: 'PENDING' | 'PROCESSED' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Customer {
  id: number;
  phone: string;
  password?: string;
  full_name: string;
  address: string;
  created_at: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DebtCredit {
  id: string;
  type: 'UTANG' | 'PIUTANG' | string;
  customer_or_supplier_name: string;
  total_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date?: string | null;
  created_at: string;
  sale_id?: string | null;
  phone_number?: string | null;
  notes?: string | null;
}

export interface StoreWallet {
  id: number;
  shopping_budget: number;
  operational_budget: number;
  owner_budget: number;
  initial_cash: number;
}

export interface StoreProfile {
  store_name: string;
  tagline: string;
  address: string;
  phone: string;
  footer_message: string;
  footer_policy: string;
  footer_quote: string;
}

export type ActiveTab = 'kasir' | 'stok' | 'pesanan' | 'utang' | 'laporan';
