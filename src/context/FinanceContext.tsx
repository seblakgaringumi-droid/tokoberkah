import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Sale, Expense, StoreWallet } from '../types';
import { calculateDrawerCash, DrawerCashBreakdown, getLocalDate, isValidSale, isStockExpense } from '../lib/utils';

interface FinanceContextType {
  manualQrisBalance: number | null;
  setManualQrisBalance: (val: number | null) => void;
  updateManualQrisBalance: (val: number | null) => void;
  
  // Real-time Global Kas Toko Summary
  getDrawerCashSummary: (
    wallet?: StoreWallet | null,
    sales?: Sale[] | null,
    expenses?: Expense[] | null,
    filterDate?: string
  ) => DrawerCashBreakdown;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const QRIS_STORAGE_KEY = 'pos_manual_qris_balance';

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manualQrisBalance, setManualQrisState] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(QRIS_STORAGE_KEY);
      if (saved !== null && saved !== '') {
        const num = Number(saved);
        return isNaN(num) ? null : num;
      }
    } catch (_) {}
    return null;
  });

  const updateManualQrisBalance = (val: number | null) => {
    setManualQrisState(val);
    try {
      if (val === null) {
        localStorage.removeItem(QRIS_STORAGE_KEY);
      } else {
        localStorage.setItem(QRIS_STORAGE_KEY, String(val));
      }
    } catch (_) {}
  };

  const getDrawerCashSummary = useMemo(() => {
    return (
      wallet?: StoreWallet | null,
      sales?: Sale[] | null,
      expenses?: Expense[] | null,
      filterDate?: string
    ): DrawerCashBreakdown => {
      return calculateDrawerCash(wallet, sales, expenses, manualQrisBalance);
    };
  }, [manualQrisBalance]);

  return (
    <FinanceContext.Provider
      value={{
        manualQrisBalance,
        setManualQrisBalance: updateManualQrisBalance,
        updateManualQrisBalance,
        getDrawerCashSummary,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = (): FinanceContextType => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
