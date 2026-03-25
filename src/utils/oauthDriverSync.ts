export const isOAuthLoginType = (loginType?: string | null): boolean => {
  return loginType === 'line' || loginType === 'apple' || loginType === 'google';
};

const extractErrorTextFromData = (data: unknown): string => {
  if (!data || typeof data !== 'object') return '';

  const record = data as Record<string, unknown>;
  const directMessage = [record.message, record.error, record.details]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  if (directMessage) return directMessage;

  if (record.data && typeof record.data === 'object') {
    const nested = record.data as Record<string, unknown>;
    return [nested.message, nested.error, nested.details]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();
  }

  return '';
};

export const isDriverNotFoundError = (
  error: string | null | undefined,
  data?: unknown
): boolean => {
  const errorText = (error || '').toLowerCase();
  const dataText = extractErrorTextFromData(data);
  return errorText.includes('driver not found') || dataText.includes('driver not found');
};
