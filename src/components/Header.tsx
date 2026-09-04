import React from 'react';
import { Database, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { StoreWallet, StoreProfile } from '../types';
import { formatRupiah } from '../lib/utils';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  dbConnected: boolean;
  dbMessage: string;
  onRefreshDb: () => void;
  isRefreshing: boolean;
  wallet: StoreWallet | null;
  lowStockCount: number;
  storeProfile?: StoreProfile;
  onOpenStoreSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  dbConnected,
  dbMessage,
  onRefreshDb,
  isRefreshing,
  wallet,
  lowStockCount,
  storeProfile,
  onOpenStoreSettings,
}) => {
  const storeName = storeProfile?.store_name || 'TOKO BERKAH';
  const tagline = storeProfile?.tagline || 'Sembako & Retail';
  const initialLetter = storeName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'TB';

  return (
    <header className="h-20 bg-white border-b border-gray-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Brand Title & Terminal Info */}
      <div 
        onClick={onOpenStoreSettings}
        className="flex flex-col cursor-pointer group select-none pr-3"
        title="Klik untuk mengubah informasi & identitas struk toko"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight group-hover:text-[#1B5E20] transition-colors flex items-center gap-1.5">
            <span>{storeName}</span>
          </h1>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-[#1B5E20] border border-emerald-100 max-w-[200px] truncate">
            {tagline}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-[#2E7D32] font-semibold tracking-widest uppercase">
            POS Terminal #01
          </span>
          <span className="text-[10px] text-gray-400 group-hover:text-emerald-700 transition-colors hidden sm:inline">
            • Klik untuk edit struk
          </span>
        </div>
      </div>

      {/* Right controls: PWA Install, Wallet, Stock Alert, Store Settings Button, Live DB Status, & Cashier Avatar */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* PWA Install Button / Desktop Mode Badge */}
        <PWAInstallButton />

        {/* Store Profile & Receipt Settings Trigger Button */}
        {onOpenStoreSettings && (
          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-[#1B5E20] text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Ubah Header & Footer Struk Toko"
          >
            <Settings className="w-3.5 h-3.5 text-[#2E7D32]" />
            <span className="hidden md:inline">Profil & Struk</span>
          </button>
        )}

        {/* Low stock pill */}
        {lowStockCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>{lowStockCount} Menipis</span>
          </div>
        )}

        {/* Quick Wallet Cash Pill */}
        {wallet && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
            <span className="text-gray-500 font-normal">Kas Toko:</span>
            <span className="font-bold text-[#1B5E20]">{formatRupiah(wallet.initial_cash)}</span>
          </div>
        )}

        {/* Supabase Status Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            dbConnected
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
          title={dbMessage}
        >
          <Database className="w-3.5 h-3.5 opacity-70" />
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                dbConnected ? 'bg-[#2E7D32] animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="hidden sm:inline font-medium">
              {dbConnected ? 'Database Online' : 'Koneksi Terputus'}
            </span>
          </div>
          <button
            onClick={onRefreshDb}
            disabled={isRefreshing}
            aria-label="Refresh database connection"
            className="ml-1 p-0.5 text-gray-400 hover:text-gray-800 rounded transition-transform active:rotate-180"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Cashier Badge Avatar (Clean Minimalism Archetype) */}
        <div 
          onClick={onOpenStoreSettings}
          className="h-9 w-9 sm:h-10 sm:w-10 bg-[#2E7D32]/10 rounded-full flex items-center justify-center border border-[#2E7D32] shadow-2xs shrink-0 select-none cursor-pointer hover:bg-[#2E7D32]/20 transition-colors"
          title={`Identitas Toko: ${storeName} (Klik untuk edit profil)`}
        >
          <span className="text-[#2E7D32] font-bold text-xs sm:text-sm">{initialLetter}</span>
        </div>
      </div>
    </header>
  );
};

