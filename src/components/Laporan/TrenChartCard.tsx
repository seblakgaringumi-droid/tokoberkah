import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign, Calendar, Filter, Target } from 'lucide-react';
import { Sale, Expense } from '../../types';
import { formatRupiah, formatDate } from '../../lib/utils';
import { isStockExpense } from './LaporanView';

interface TrenChartCardProps {
  sales: Sale[];
  expenses: Expense[];
  onOpenBEPModal: () => void;
}

export const TrenChartCard: React.FC<TrenChartCardProps> = ({
  sales,
  expenses,
  onOpenBEPModal,
}) => {
  const [chartPeriod, setChartPeriod] = useState<'7_hari' | '30_hari' | 'semua'>('7_hari');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Group data by date
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { 
      dateStr: string; 
      revenue: number; 
      cost: number; 
      drawerExpense: number; 
      kasBesarExpense: number;
      totalExpense: number;
      grossProfit: number; 
      netProfit: number 
    }> = {};
    
    // Determine cutoff date based on period
    const now = new Date();
    let cutoffDays = 7;
    if (chartPeriod === '30_hari') cutoffDays = 30;
    if (chartPeriod === 'semua') cutoffDays = 365;

    // Pre-populate last N days
    const dayKeys: string[] = [];
    for (let i = cutoffDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayKeys.push(key);
      dailyMap[key] = {
        dateStr: key,
        revenue: 0,
        cost: 0,
        drawerExpense: 0,
        kasBesarExpense: 0,
        totalExpense: 0,
        grossProfit: 0,
        netProfit: 0,
      };
    }

    // Process sales
    for (const sale of sales) {
      if (!sale.created_at) continue;
      const key = sale.created_at.split('T')[0];
      if (dailyMap[key]) {
        const rev = Number(sale.total_amount) || 0;
        dailyMap[key].revenue += rev;

        let saleCost = 0;
        if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
          for (const it of sale.items) {
            saleCost += (it.cost_price || 0) * (it.qty_kg || 0);
          }
        } else {
          saleCost = rev * 0.8;
        }
        dailyMap[key].cost += saleCost;
      }
    }

    // Process expenses with source & category distinction
    for (const exp of expenses) {
      if (!exp.created_at) continue;
      const key = exp.created_at.split('T')[0];
      if (dailyMap[key]) {
        const amt = Number(exp.amount) || 0;
        dailyMap[key].totalExpense += amt;
        const isKasBesar = (exp.source || '').toUpperCase() === 'KAS_BESAR';
        const isStock = isStockExpense(exp);
        if (isKasBesar) {
          dailyMap[key].kasBesarExpense += amt;
        } else if (!isStock) {
          // Only operational expenses reduce daily Net Profit (Stock is inventory asset)
          dailyMap[key].drawerExpense += amt;
        }
      }
    }

    // Calculate profits (Daily drawer net profit = Gross Profit - Operational Expenses)
    return dayKeys.map((k) => {
      const item = dailyMap[k];
      item.grossProfit = Math.max(0, item.revenue - item.cost);
      item.netProfit = item.grossProfit - item.drawerExpense;
      return item;
    });
  }, [sales, expenses, chartPeriod]);

  // Chart dimensions & scaling
  const maxVal = useMemo(() => {
    let m = 200000; // default minimum
    for (const d of chartData) {
      if (d.revenue > m) m = d.revenue;
      if (d.netProfit > m) m = d.netProfit;
    }
    return Math.ceil(m * 1.15);
  }, [chartData]);

  const DAILY_BEP_LINE = 195400; // Rp 195.400 fixed sinking fund

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-5 space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              Grafik Tren Omzet vs Laba Bersih
            </h3>
            <p className="text-[11px] text-gray-500">
              Analisis performa finansial harian dan perbandingan garis target BEP
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl self-start sm:self-auto text-xs font-semibold">
          {[
            { id: '7_hari', label: '7 Hari' },
            { id: '30_hari', label: 'Bulanan' },
            { id: 'semua', label: 'Semua' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setChartPeriod(p.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartPeriod === p.id
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & BEP shortcut */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#2E7D32]" />
            <span className="text-gray-700 font-medium">Omzet Penjualan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-300" />
            <span className="text-gray-700 font-medium">Laba Bersih Harian</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-500 border-t border-dashed border-amber-500" />
            <span className="text-amber-800 font-medium">Target Beban Harian ({formatRupiah(DAILY_BEP_LINE)})</span>
          </div>
        </div>

        <button
          onClick={onOpenBEPModal}
          className="text-[#1B5E20] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
        >
          <Target className="w-3.5 h-3.5" />
          <span>Analisis BEP Data-Driven</span>
        </button>
      </div>

      {/* SVG Bar & Line Chart Container */}
      <div className="relative pt-2 pb-1">
        <div className="h-64 sm:h-72 w-full">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 700 240" preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = 200 - ratio * 180;
              const val = Math.round(maxVal * ratio);
              return (
                <g key={i}>
                  <line x1="40" y1={y} x2="690" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="monospace">
                    {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`}
                  </text>
                </g>
              );
            })}

            {/* Target BEP Dashed Line */}
            {(() => {
              const bepRatio = Math.min(1, DAILY_BEP_LINE / maxVal);
              const yBep = 200 - bepRatio * 180;
              return (
                <g>
                  <line
                    x1="40"
                    y1={yBep}
                    x2="690"
                    y2={yBep}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text x="685" y={yBep - 4} textAnchor="end" fontSize="8" fill="#d97706" fontWeight="bold">
                    BEP {formatRupiah(DAILY_BEP_LINE)}
                  </text>
                </g>
              );
            })()}

            {/* Bars */}
            {chartData.map((d, index) => {
              const count = chartData.length;
              const availableWidth = 650;
              const colWidth = availableWidth / count;
              const xCenter = 45 + index * colWidth + colWidth / 2;
              
              const barWidth = Math.min(22, Math.max(8, colWidth * 0.35));
              
              const revHeight = (d.revenue / maxVal) * 180;
              const netHeight = Math.max(0, (d.netProfit / maxVal) * 180);

              const yRev = 200 - revHeight;
              const yNet = 200 - netHeight;

              const isHovered = hoveredIndex === index;

              return (
                <g
                  key={d.dateStr}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  {/* Hover column background */}
                  {isHovered && (
                    <rect
                      x={45 + index * colWidth}
                      y="15"
                      width={colWidth}
                      height="190"
                      fill="#f8fafc"
                      rx="4"
                    />
                  )}

                  {/* Omzet Bar */}
                  <rect
                    x={xCenter - barWidth - 1}
                    y={yRev}
                    width={barWidth}
                    height={Math.max(2, revHeight)}
                    fill={isHovered ? '#1B5E20' : '#2E7D32'}
                    rx="3"
                  />

                  {/* Laba Bersih Bar */}
                  <rect
                    x={xCenter + 1}
                    y={yNet}
                    width={barWidth}
                    height={Math.max(2, netHeight)}
                    fill={isHovered ? '#34d399' : '#6ee7b7'}
                    rx="3"
                  />

                  {/* X Axis Label */}
                  <text
                    x={xCenter}
                    y="218"
                    textAnchor="middle"
                    fontSize="9"
                    fill={isHovered ? '#0f172a' : '#64748b'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                  >
                    {chartPeriod === '7_hari'
                      ? d.dateStr.slice(5) // MM-DD
                      : index % Math.ceil(count / 7) === 0
                      ? d.dateStr.slice(5)
                      : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Floating Tooltip when bar hovered */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div className="absolute top-2 right-4 bg-gray-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-xs border border-gray-800 space-y-1.5 z-10 pointer-events-none">
            <div className="font-bold text-gray-200 border-b border-gray-700 pb-1 flex justify-between gap-3">
              <span>{formatDate(chartData[hoveredIndex].dateStr)}</span>
              <span className="font-mono text-emerald-400">
                {chartData[hoveredIndex].revenue >= DAILY_BEP_LINE ? '✓ Capai BEP' : '⚠ Di Bawah BEP'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Omzet:</span>
              <span className="font-mono font-bold text-white">
                {formatRupiah(chartData[hoveredIndex].revenue)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Laba Kotor:</span>
              <span className="font-mono text-emerald-300">
                {formatRupiah(chartData[hoveredIndex].grossProfit)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Biaya Laci Kasir:</span>
              <span className="font-mono text-rose-300">
                -{formatRupiah(chartData[hoveredIndex].drawerExpense)}
              </span>
            </div>
            {chartData[hoveredIndex].kasBesarExpense > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Biaya Kas Besar:</span>
                <span className="font-mono text-blue-300">
                  -{formatRupiah(chartData[hoveredIndex].kasBesarExpense)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
              <span className="text-gray-300 font-semibold">Laba Bersih Harian:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatRupiah(chartData[hoveredIndex].netProfit)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
