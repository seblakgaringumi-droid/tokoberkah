import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { KasirView } from './components/Kasir/KasirView';
import { StokView } from './components/Stok/StokView';
import { PesananView } from './components/Pesanan/PesananView';
import { UtangView } from './components/Utang/UtangView';
import { LaporanView } from './components/Laporan/LaporanView';
import { EditStoreProfileModal } from './components/EditStoreProfileModal';
import { 
  ActiveTab, 
  Product, 
  Sale, 
  Order, 
  DebtCredit, 
  Expense, 
  StoreWallet, 
  StoreProfile 
} from './types';
import { 
  fetchProducts, 
  fetchSales, 
  fetchOrders, 
  fetchDebtsCredits, 
  fetchExpenses, 
  fetchStoreWallets,
  fetchStoreProfile,
  DEFAULT_STORE_PROFILE,
  seedInitialProductsIfEmpty,
  syncCompletedOrdersToSales
} from './services/api';
import { supabase, testConnection } from './lib/supabase';
import { formatRupiah, playBeep, requestNotificationPermission, showOrderNotification } from './lib/utils';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('kasir');

  // Supabase Connection Status
  const [dbConnected, setDbConnected] = useState(true);
  const [dbMessage, setDbMessage] = useState('Terhubung ke Supabase');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Core Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [debts, setDebts] = useState<DebtCredit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [wallet, setWallet] = useState<StoreWallet | null>(null);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_STORE_PROFILE);
  const [isStoreSettingsOpen, setIsStoreSettingsOpen] = useState(false);

  // Web Notification Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  };

  // Check connection and load all tables
  const loadAllData = useCallback(async (isInitial = false) => {
    try {
      setIsRefreshing(true);

      // Test connection first
      const status = await testConnection();
      setDbConnected(status.ok);
      setDbMessage(status.message);

      // Fetch in parallel
      const [
        prodsRes, 
        salesRes, 
        ordersRes, 
        debtsRes, 
        expensesRes, 
        walletRes,
        profileRes
      ] = await Promise.allSettled([
        fetchProducts(),
        fetchSales(),
        fetchOrders(),
        fetchDebtsCredits(),
        fetchExpenses(),
        fetchStoreWallets(),
        fetchStoreProfile(),
      ]);

      let currentProducts: Product[] = [];
      if (prodsRes.status === 'fulfilled') {
        currentProducts = prodsRes.value;
        setProducts(currentProducts);
      } else {
        console.warn('Failed to fetch products:', prodsRes.reason);
      }

      let currentSales = salesRes.status === 'fulfilled' ? salesRes.value : [];
      let currentOrders = ordersRes.status === 'fulfilled' ? ordersRes.value : [];

      if (salesRes.status === 'fulfilled') setSales(currentSales);
      if (ordersRes.status === 'fulfilled') setOrders(currentOrders);
      if (debtsRes.status === 'fulfilled') setDebts(debtsRes.value);
      if (expensesRes.status === 'fulfilled') setExpenses(expensesRes.value);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
      if (profileRes.status === 'fulfilled' && profileRes.value) setStoreProfile(profileRes.value);

      // Check if any completed orders need auto-syncing to sales/reports
      const hasCompletedOrders = currentOrders.some(o => (o.status || '').toUpperCase() === 'COMPLETED');
      if (hasCompletedOrders) {
        try {
          const syncRes = await syncCompletedOrdersToSales();
          if (syncRes.syncedCount > 0) {
            setSales(syncRes.sales);
          }
        } catch (syncErr) {
          console.warn('Completed orders auto-sync note:', syncErr);
        }
      }

      // If initial load and 0 products, offer auto-seed
      if (isInitial && currentProducts.length === 0 && status.ok) {
        try {
          const seeded = await seedInitialProductsIfEmpty();
          if (seeded) {
            const reloadedProds = await fetchProducts();
            setProducts(reloadedProds);
            const reloadedWallet = await fetchStoreWallets();
            if (reloadedWallet) setWallet(reloadedWallet);
          }
        } catch (seedErr) {
          console.warn('Auto seed check error:', seedErr);
        }
      }

    } catch (err: any) {
      console.error('Data loading error:', err);
      setDbConnected(false);
      setDbMessage(err.message || 'Gagal memuat data dari Supabase');
    } finally {
      setIsRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData(true);
  }, [loadAllData]);

  // Real-time Database Subscription for Orders Table (Supabase Realtime postgres_changes)
  useEffect(() => {
    const ordersChannel = supabase
      .channel('realtime:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as Order;
          if (!newOrder) return;

          // 1. Prepend new order if not already in state
          setOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev];
          });

          // 2. Play audio alert chime (ding.mp3 sound synthesized via Web Audio)
          playBeep('ding');

          // 3. Show Web Notification if permitted
          const title = `Pesanan Baru Masuk! (#ORD-${newOrder.id})`;
          const body = `Pelanggan: ${newOrder.customer_name || 'Pelanggan'} - Total: ${formatRupiah(newOrder.total_amount)}`;
          showOrderNotification(title, body, () => {
            setActiveTab('pesanan');
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updatedOrder = payload.new as Order;
          if (!updatedOrder) return;
          setOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          const oldOrder = payload.old as { id: number };
          if (oldOrder?.id) {
            setOrders((prev) => prev.filter((o) => o.id !== oldOrder.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const [cartCount, setCartCount] = useState<number>(0);

  // Derived Badges Counters
  const lowStockCount = products.filter((p) => p.stock_kg <= (p.min_stock || 10)).length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
  const unpaidDebtsCount = debts.filter((d) => d.status !== 'paid').length;

  return (
    <div className="min-h-screen flex flex-row bg-[#f0f2f0] font-sans text-gray-800 overflow-x-hidden">
      {/* Navigation (Left Vertical Rail on Desktop, Bottom Bar on Mobile) */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        cartCount={cartCount}
        lowStockCount={lowStockCount}
        pendingOrdersCount={pendingOrdersCount}
        unpaidDebtsCount={unpaidDebtsCount}
        onRefreshDb={() => loadAllData(false)}
        isRefreshing={isRefreshing}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Header */}
        <Header
          dbConnected={dbConnected}
          dbMessage={dbMessage}
          onRefreshDb={() => loadAllData(false)}
          isRefreshing={isRefreshing}
          wallet={wallet}
          lowStockCount={lowStockCount}
          storeProfile={storeProfile}
          onOpenStoreSettings={() => setIsStoreSettingsOpen(true)}
        />

        {/* Connection Notice if DB issue */}
        {!dbConnected && (
          <div className="px-4 sm:px-8 mt-4 w-full">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 text-amber-900 text-sm shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Status Koneksi Supabase:</p>
                  <p className="text-xs text-amber-800 mt-0.5">{dbMessage}</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Pastikan tabel Supabase mengizinkan akses anonim (RLS policies) atau periksa koneksi internet Anda.
                  </p>
                </div>
              </div>
              <button
                onClick={() => loadAllData(false)}
                disabled={isRefreshing}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Coba Lagi</span>
              </button>
            </div>
          </div>
        )}

        {/* Main View Area */}
        <main className="flex-1 pb-20 md:pb-6">
          {initialLoading ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#2E7D32] flex items-center justify-center text-white shadow-lg animate-pulse mb-4">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Memuat {storeProfile.store_name} POS...</h3>
              <p className="text-xs text-gray-500 mt-1">Menghubungkan ke Supabase Database</p>
            </div>
          ) : (
            <>
              {activeTab === 'kasir' && (
                <KasirView
                  products={products}
                  onRefreshProducts={async () => {
                    const prods = await fetchProducts();
                    setProducts(prods);
                  }}
                  onSaleCompleted={() => {
                    loadAllData(false);
                  }}
                  storeProfile={storeProfile}
                  onUpdateStoreProfile={setStoreProfile}
                  onCartCountChange={setCartCount}
                />
              )}

              {activeTab === 'stok' && (
                <StokView
                  products={products}
                  onRefresh={async () => {
                    const prods = await fetchProducts();
                    setProducts(prods);
                  }}
                />
              )}

              {activeTab === 'pesanan' && (
                <PesananView
                  orders={orders}
                  products={products}
                  onRefresh={async () => {
                    const [ords, prods, s] = await Promise.all([
                      fetchOrders(),
                      fetchProducts(),
                      fetchSales(),
                    ]);
                    setOrders(ords);
                    setProducts(prods);
                    setSales(s);
                  }}
                  notificationPermission={notifPermission}
                  onRequestPermission={handleRequestPermission}
                />
              )}

              {activeTab === 'utang' && (
                <UtangView
                  debts={debts}
                  onRefresh={async () => {
                    const d = await fetchDebtsCredits();
                    setDebts(d);
                  }}
                />
              )}

              {activeTab === 'laporan' && (
                <LaporanView
                  sales={sales}
                  expenses={expenses}
                  wallet={wallet}
                  onRefresh={async () => {
                    await loadAllData(false);
                  }}
                  storeProfile={storeProfile}
                  onUpdateStoreProfile={setStoreProfile}
                />
              )}
            </>
          )}
        </main>

        {/* Clean Minimalism Bottom Status Bar */}
        <footer className="h-12 bg-white border-t border-gray-200/80 px-6 flex items-center justify-between text-[11px] font-medium text-gray-500 shrink-0 select-none">
          <div className="flex items-center space-x-6">
            <span>
              Status Database:{' '}
              <span className={dbConnected ? 'text-[#2E7D32] font-bold' : 'text-amber-600 font-bold'}>
                {dbConnected ? 'Online' : 'Offline'}
              </span>
            </span>
            <span className="hidden sm:inline">Sinkronisasi: Realtime Supabase</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-[#2E7D32]' : 'bg-amber-500'}`} />
            <span>Sesi Kasir: Petugas Shift #01 - {storeProfile.store_name}</span>
          </div>
        </footer>
      </div>

      {/* Edit Store Profile & Receipt Settings Modal */}
      <EditStoreProfileModal
        isOpen={isStoreSettingsOpen}
        onClose={() => setIsStoreSettingsOpen(false)}
        currentProfile={storeProfile}
        onProfileUpdated={(updated) => setStoreProfile(updated)}
      />
    </div>
  );
}
