import { formatInTimeZone } from 'date-fns-tz';
import { th, enUS, ko } from 'date-fns/locale';

const THAILAND_TIMEZONE = 'Asia/Bangkok';

export const formatDate = (date: string | Date, language: 'th' | 'en' | 'ko' = 'th'): string => {
  const locale = language === 'th' ? th : language === 'ko' ? ko : enUS;
  return formatInTimeZone(
    new Date(date),
    THAILAND_TIMEZONE,
    'd MMM yy',
    { locale }
  );
};

export const formatDateTime = (date: string | Date, language: 'th' | 'en' | 'ko' = 'th'): string => {
  const locale = language === 'th' ? th : language === 'ko' ? ko : enUS;
  return formatInTimeZone(
    new Date(date),
    THAILAND_TIMEZONE,
    'd MMM yyyy HH:mm',
    { locale }
  );
};

export const formatTime = (date: string | Date): string => {
  return formatInTimeZone(
    new Date(date),
    THAILAND_TIMEZONE,
    'HH:mm'
  );
};

export const formatFullDate = (date: string | Date, language: 'th' | 'en' | 'ko' = 'th'): string => {
  const locale = language === 'th' ? th : language === 'ko' ? ko : enUS;
  return formatInTimeZone(
    new Date(date),
    THAILAND_TIMEZONE,
    'd MMMM yyyy',
    { locale }
  );
};
