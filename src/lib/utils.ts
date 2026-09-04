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

// Audio beep for barcode scan / checkout success using Web Audio API
export function formatStock(val: number | string | null | undefined, unit?: string): string {
  if (val === null || val === undefined || val === '') {
    return unit ? `0 ${unit}` : '0';
  }
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) {
    return unit ? `0 ${unit}` : '0';
  }

  // Round to max 3 decimal places to eliminate floating point artifacts (e.g. 56.14799999999999 -> 56.148, 10.62000000000001 -> 10.62, 1.198999999999994 -> 1.199)
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  
  // Format as clean number without trailing zeroes (e.g. 8, 10.62, 2.041, 56.148)
  const cleanStr = parseFloat(rounded.toFixed(3)).toString();
  
  return unit ? `${cleanStr} ${unit}` : cleanStr;
}

export function roundStock(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

export function getWeightAlias(qty: number, unit?: string): string | null {
  const u = (unit || '').toLowerCase().trim();
  const num = roundStock(qty);

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
  } else {
    if (num === 0.25) return '1/4';
    if (num === 0.5) return 'Setengah';
    if (num === 0.75) return '3/4';
  }
  return null;
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

export function playBeep(type: 'beep' | 'success' | 'alert' = 'beep') {
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
