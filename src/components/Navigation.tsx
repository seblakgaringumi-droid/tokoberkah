import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  ClipboardList, 
  BookOpen, 
  BarChart3, 
  Store,
  RefreshCw 
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  cartCount: number;
  lowStockCount: number;
  pendingOrdersCount: number;
  unpaidDebtsCount: number;
  onRefreshDb?: () => void;
  isRefreshing?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  cartCount,
  lowStockCount,
  pendingOrdersCount,
  unpaidDebtsCount,
  onRefreshDb,
  isRefreshing,
}) => {
  const navItems = [
    {
      id: 'kasir' as ActiveTab,
      label: 'Kasir',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
      badgeColor: 'bg-white text-[#2E7D32]',
    },
    {
      id: 'stok' as ActiveTab,
      label: 'Stok',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-amber-400 text-gray-900',
    },
    {
      id: 'pesanan' as ActiveTab,
      label: 'Pesanan',
      icon: ClipboardList,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      badgeColor: 'bg-amber-400 text-gray-900 font-extrabold animate-pulse',
    },
    {
      id: 'utang' as ActiveTab,
      label: 'Utang',
      icon: BookOpen,
      badge: unpaidDebtsCount > 0 ? unpaidDebtsCount : null,
      badgeColor: 'bg-rose-400 text-white',
    },
    {
      id: 'laporan' as ActiveTab,
      label: 'Laporan',
      icon: BarChart3,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <>
      {/* Desktop Left Navigation Rail (Clean Minimalism) */}
      <nav className="hidden md:flex w-20 bg-[#2E7D32] flex-col items-center py-6 shadow-xl z-20 shrink-0 select-none min-h-screen">
        {/* Brand Icon Header */}
        <div 
          className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-8 shadow-xs text-white cursor-pointer hover:bg-white/25 transition-colors"
          title="Toko Berkah POS"
          onClick={() => onChangeTab('kasir')}
        >
          <Store className="w-7 h-7" />
        </div>

        {/* Navigation Rail Buttons */}
        <div className="flex flex-col space-y-4 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                title={item.label}
                className={`relative p-3 rounded-xl transition-all duration-150 group flex flex-col items-center justify-center ${
                  isActive
                    ? 'bg-white/15 text-white shadow-xs ring-1 ring-white/30'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform group-hover:scale-105 ${isActive ? 'stroke-[2.2px]' : 'stroke-2'}`} />
                <span className="text-[10px] font-medium tracking-tight mt-1 opacity-90">{item.label}</span>
                {item.badge !== null && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center text-[9px] font-bold px-1 rounded-full shadow-xs ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Rail Action: Refresh / Status */}
        {onRefreshDb && (
          <div className="mt-auto pt-4">
            <button
              onClick={onRefreshDb}
              disabled={isRefreshing}
              title="Sinkronisasi Data"
              className="p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Navigation Bar (Fixed bottom navigation) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-lg px-2 py-1 safe-area-pb">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors min-h-[50px] ${
                  isActive
                    ? 'text-[#2E7D32] font-semibold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4px]' : 'stroke-2'}`} />
                  {item.badge !== null && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 min-w-4 h-4 flex items-center justify-center text-[10px] font-bold px-1 rounded-full ${
                        isActive ? 'bg-[#2E7D32] text-white' : 'bg-rose-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

