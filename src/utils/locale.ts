import i18next from 'i18next';

/**
 * Returns the current active language code ('en' or 'ar')
 */
export function getCurrentLang(): 'en' | 'ar' {
  const current = i18next.language || 'en';
  return current.startsWith('ar') ? 'ar' : 'en';
}

/**
 * Formats a Date object, string, or number into a localized format.
 * E.g., July 21, 2026 or ٢١ يوليو ٢٠٢٦
 */
export function formatDate(
  date: Date | string | number, 
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const lang = getCurrentLang();
    // ar-EG or ar-SA can be used; ar-SA usually formats dates with Hijri depending on exact system, 
    // so using 'ar' standard formatting gives Gregorian with Arabic text which is perfect.
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', options).format(d);
  } catch (err) {
    return String(date);
  }
}

/**
 * Formats relative times (e.g. "2 hours ago", "yesterday", "قبل ساعتين")
 */
export function formatRelativeTime(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const lang = getCurrentLang();
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });

    if (Math.abs(diffSec) < 60) {
      return rtf.format(diffSec, 'second');
    } else if (Math.abs(diffMin) < 60) {
      return rtf.format(diffMin, 'minute');
    } else if (Math.abs(diffHour) < 24) {
      return rtf.format(diffHour, 'hour');
    } else {
      return rtf.format(diffDay, 'day');
    }
  } catch (err) {
    return '';
  }
}

/**
 * Formats numbers into localized representation.
 * E.g., 1,234.56 or ١٬٢٣٤٫٥٦ depending on language
 */
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  try {
    const lang = getCurrentLang();
    return new Intl.NumberFormat(lang === 'ar' ? 'ar' : 'en-US', options).format(num);
  } catch (err) {
    return String(num);
  }
}

/**
 * Formats duration localized in minutes/hours
 */
export function formatMinutesLocalized(minutes: number): string {
  const lang = getCurrentLang();
  if (minutes <= 0) return lang === 'ar' ? '٠ دقيقة' : '0 min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (lang === 'ar') {
    if (hours === 0) return `${formatNumber(mins)} دقيقة`;
    if (mins === 0) {
      if (hours === 1) return 'ساعة واحدة';
      if (hours === 2) return 'ساعتان';
      if (hours >= 3 && hours <= 10) return `${formatNumber(hours)} ساعات`;
      return `${formatNumber(hours)} ساعة`;
    }
    return `${formatNumber(hours)} ساعة و ${formatNumber(mins)} دقيقة`;
  } else {
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }
}
