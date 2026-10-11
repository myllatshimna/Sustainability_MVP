/**
 * Currency & Time Formatters for Bengaluru Pilot
 * - Currency: INR (₹)
 * - Timezone: Asia/Kolkata (IST)
 */

export function formatInrCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Free';
  }
  if (amount === 0) {
    return 'Free (₹0)';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatBengaluruDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (e) {
    return isoString;
  }
}

export function formatBengaluruDateOnly(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return isoString;
  }
}
