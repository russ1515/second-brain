import type { UsageUnit } from '@second-brain/shared';
import type { TranslationKey } from './i18n';

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

type Translate = (key: TranslationKey) => string;

export function usageMetricLabel(key: string, t: Translate): string {
  const known: Record<string, TranslationKey> = {
    documents: 'usage.metric.documents',
    storage: 'usage.metric.storage',
    ai_questions: 'usage.metric.ai_questions',
    voice_minutes: 'usage.metric.voice_minutes',
  };
  const translation = known[key];
  if (translation) return t(translation);
  const readable = key.replace(/[_-]+/g, ' ').trim();
  return readable ? readable.charAt(0).toLocaleUpperCase() + readable.slice(1) : key;
}

export function formatUsageValue(
  value: number,
  unit: UsageUnit,
  formatLocale: string,
  t: Translate,
): string {
  if (unit === 'bytes') {
    if (value >= GB) return `${formatDecimal(value / GB, formatLocale)} ${t('usage.gb')}`;
    if (value >= MB) return `${formatDecimal(value / MB, formatLocale)} ${t('usage.mb')}`;
    return `${formatDecimal(value / KB, formatLocale)} ${t('usage.kb')}`;
  }
  const formatted = new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 1 }).format(value);
  return unit === 'minutes' ? `${formatted} ${t('usage.min')}` : formatted;
}

export function formatResetAt(resetAt: string | null, formatLocale: string): string | null {
  if (!resetAt) return null;
  const value = new Date(resetAt);
  if (Number.isNaN(value.getTime())) return null;
  return value.toLocaleString(formatLocale, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDecimal(value: number, formatLocale: string): string {
  return new Intl.NumberFormat(formatLocale, { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value);
}
