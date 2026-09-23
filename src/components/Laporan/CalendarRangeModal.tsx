import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
  Clock,
  Sparkles
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface CalendarRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onApply: (start: string, end: string) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// Format Date object to YYYY-MM-DD
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate total days between two YYYY-MM-DD strings inclusive
function countDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const diffTime = Math.abs(e.getTime() - s.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export const CalendarRangeModal: React.FC<CalendarRangeModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  onApply,
}) => {
  const todayStr = useMemo(() => toDateString(new Date()), []);

  const [tempStart, setTempStart] = useState<string>(startDate || todayStr);
  const [tempEnd, setTempEnd] = useState<string>(endDate || todayStr);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);

  // Current view month & year for the primary calendar
  const [viewYear, setViewYear] = useState<number>(() => {
    if (startDate) return new Date(startDate + 'T00:00:00').getFullYear();
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (startDate) return new Date(startDate + 'T00:00:00').getMonth();
    return new Date().getMonth();
  });

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const validStart = startDate || todayStr;
      const validEnd = endDate || todayStr;
      setTempStart(validStart);
      setTempEnd(validEnd);
      setIsSelectingEnd(false);
      setHoverDate(null);

      const d = new Date(validStart + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [isOpen, startDate, endDate, todayStr]);

  // Determine active visual range (pure expressions, no conditional hooks)
  const activeEffectiveStart = isSelectingEnd && hoverDate && hoverDate < tempStart ? hoverDate : tempStart;
  const activeEffectiveEnd = isSelectingEnd && hoverDate && hoverDate >= tempStart ? hoverDate : tempEnd;

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Calendar cells generator for a specific year and month
  const generateMonthGrid = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    // In Indonesia Monday is day 0, Sunday is day 6
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Preceding empty/previous month days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
      const prevD = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        dateStr: toDateString(prevD),
        dayNum: prevMonthDays - i,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const currD = new Date(year, month, d);
      days.push({
        dateStr: toDateString(currD),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days to fill 6 rows (42 cells) or 5 rows (35 cells)
    const remaining = 42 - days.length;
    for (let nextD = 1; nextD <= remaining; nextD++) {
      const nextDate = new Date(year, month + 1, nextD);
      days.push({
        dateStr: toDateString(nextDate),
        dayNum: nextD,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  // Handle clicking on a calendar day
  const handleDayClick = (dateStr: string) => {
    if (!isSelectingEnd) {
      // First click: select new start date and wait for end date
      setTempStart(dateStr);
      setTempEnd(dateStr);
      setIsSelectingEnd(true);
    } else {
      // Second click: select end date
      if (dateStr < tempStart) {
        // Swap if user clicked earlier date
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
      setIsSelectingEnd(false);
      setHoverDate(null);
    }
  };

  // Preset Handlers
  const applyPreset = (start: string, end: string) => {
    setTempStart(start);
    setTempEnd(end);
    setIsSelectingEnd(false);
    setHoverDate(null);

    const d = new Date(start + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const presets = [
    {
      label: 'Hari Ini',
      action: () => {
        applyPreset(todayStr, todayStr);
      },
    },
    {
      label: 'Kemarin',
      action: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const s = toDateString(d);
        applyPreset(s, s);
      },
    },
    {
      label: '7 Hari Terakhir',
      action: () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        applyPreset(toDateString(d), todayStr);
      },
    },
    {
      label: '14 Hari Terakhir',
      action: () => {
        const d = new Date();
        d.setDate(d.getDate() - 13);
        applyPreset(toDateString(d), todayStr);
      },
    },
    {
      label: '30 Hari Terakhir',
      action: () => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        applyPreset(toDateString(d), todayStr);
      },
    },
    {
      label: 'Minggu Ini',
      action: () => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        applyPreset(toDateString(monday), todayStr);
      },
    },
    {
      label: 'Bulan Ini',
      action: () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        applyPreset(toDateString(firstDay), todayStr);
      },
    },
    {
      label: 'Bulan Lalu',
      action: () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        applyPreset(toDateString(firstDay), toDateString(lastDay));
      },
    },
    {
      label: 'Tahun Ini (YTD)',
      action: () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), 0, 1);
        applyPreset(toDateString(firstDay), todayStr);
      },
    },
  ];

  const handleApply = () => {
    let finalStart = tempStart;
    let finalEnd = tempEnd;
    if (finalStart > finalEnd) {
      const tmp = finalStart;
      finalStart = finalEnd;
      finalEnd = tmp;
    }
    onApply(finalStart, finalEnd);
    onClose();
  };

  const totalDays = countDays(tempStart, tempEnd);

  // If modal is not open, return null here (all hooks have already executed in identical order)
  if (!isOpen) return null;

  const primaryMonthDays = generateMonthGrid(viewYear, viewMonth);
  // Secondary month is next month
  const secondaryYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const secondaryMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondaryMonthDays = generateMonthGrid(secondaryYear, secondaryMonth);

  // Render individual month calendar view
  const renderMonth = (year: number, month: number, days: typeof primaryMonthDays, isPrimary: boolean) => {
    return (
      <div className="flex-1 min-w-[280px]">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <span>{MONTH_NAMES[month]}</span>
            <span className="text-gray-400 font-normal">{year}</span>
          </div>
          {isPrimary ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* If secondary isn't visible (e.g. mobile), show next button on primary */}
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer md:hidden"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer hidden md:block"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`text-[11px] font-bold py-1 ${
                i === 5 || i === 6 ? 'text-amber-600' : 'text-gray-400'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center text-xs">
          {days.map((item, idx) => {
            const isToday = item.dateStr === todayStr;
            const isStart = item.dateStr === activeEffectiveStart;
            const isEnd = item.dateStr === activeEffectiveEnd;
            const isInRange =
              item.dateStr > activeEffectiveStart && item.dateStr < activeEffectiveEnd;
            const isSingleSelected = isStart && isEnd;

            let buttonClass = 'relative w-full h-8 flex items-center justify-center font-medium transition-all text-xs cursor-pointer ';
            let containerClass = 'p-0 relative ';

            if (!item.isCurrentMonth) {
              buttonClass += 'text-gray-300 hover:text-gray-500 ';
            } else {
              buttonClass += 'text-gray-800 hover:bg-emerald-50 ';
            }

            // Highlighting Range
            if (isSingleSelected) {
              buttonClass += 'bg-[#2E7D32] text-white font-bold rounded-xl shadow-xs scale-95 z-10 ';
            } else if (isStart) {
              buttonClass += 'bg-[#2E7D32] text-white font-bold rounded-l-xl shadow-xs z-10 ';
              containerClass += 'bg-emerald-100/70 rounded-l-xl ';
            } else if (isEnd) {
              buttonClass += 'bg-[#2E7D32] text-white font-bold rounded-r-xl shadow-xs z-10 ';
              containerClass += 'bg-emerald-100/70 rounded-r-xl ';
            } else if (isInRange) {
              buttonClass += 'text-emerald-950 font-semibold ';
              containerClass += 'bg-emerald-100/70 ';
            }

            if (isToday && !isStart && !isEnd) {
              buttonClass += 'font-extrabold text-[#1B5E20] ring-1 ring-[#2E7D32]/40 rounded-xl ';
            }

            return (
              <div key={idx} className={containerClass}>
                <button
                  type="button"
                  onClick={() => handleDayClick(item.dateStr)}
                  onMouseEnter={() => {
                    if (isSelectingEnd) setHoverDate(item.dateStr);
                  }}
                  className={buttonClass}
                >
                  <span>{item.dayNum}</span>
                  {isToday && (
                    <span
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        isStart || isEnd ? 'bg-white' : 'bg-[#2E7D32]'
                      }`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-[#1B5E20] flex items-center justify-center border border-emerald-200/80 shadow-2xs">
              <CalendarRange className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                Pilih Rentang Tanggal Laporan
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                  Visual Kalender
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Pilih tanggal mulai & tanggal akhir pada kalender atau gunakan preset cepat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-5 overflow-y-auto">
          {/* Left Column: Quick Presets */}
          <div className="w-full lg:w-48 shrink-0 flex flex-col gap-1.5 pb-3 lg:pb-0 border-b lg:border-b-0 lg:border-r border-gray-100 lg:pr-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Pilihan Cepat
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={p.action}
                  className="px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/80 text-gray-700 hover:text-[#1B5E20] cursor-pointer flex items-center justify-between group"
                >
                  <span>{p.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#2E7D32] transition-colors" />
                </button>
              ))}
            </div>

            {/* Quick manual inputs */}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Input Manual
              </span>
              <div className="space-y-1.5 text-xs">
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Dari:</label>
                  <input
                    type="date"
                    value={tempStart}
                    onChange={(e) => {
                      setTempStart(e.target.value);
                      setIsSelectingEnd(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 outline-none focus:border-[#2E7D32]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Sampai:</label>
                  <input
                    type="date"
                    value={tempEnd}
                    onChange={(e) => {
                      setTempEnd(e.target.value);
                      setIsSelectingEnd(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 outline-none focus:border-[#2E7D32]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Month Calendars (Single on mobile, Dual on tablet/desktop) */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col md:flex-row gap-6">
              {renderMonth(viewYear, viewMonth, primaryMonthDays, true)}
              <div className="hidden md:block w-px bg-gray-100" />
              <div className="hidden md:block flex-1">
                {renderMonth(secondaryYear, secondaryMonth, secondaryMonthDays, false)}
              </div>
            </div>

            {/* Range Selection Status Banner */}
            <div className="mt-5 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white text-[#2E7D32] flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-emerald-800 font-medium block">
                    {isSelectingEnd ? 'Klik tanggal kedua untuk mengakhiri rentang:' : 'Rentang Terpilih:'}
                  </span>
                  <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                    <span>{formatDate(tempStart)}</span>
                    <span className="text-gray-400 font-normal">s/d</span>
                    <span>{formatDate(tempEnd)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span className="px-3 py-1 bg-white font-extrabold text-[#1B5E20] rounded-xl border border-emerald-200 shadow-2xs text-xs">
                  {totalDays} Hari Terpilih
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              applyPreset(todayStr, todayStr);
            }}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Hari Ini</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan Rentang Tanggal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
