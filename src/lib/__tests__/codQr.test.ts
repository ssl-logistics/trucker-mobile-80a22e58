import { describe, it, expect } from 'vitest';
import { isQrPaid, secondsLeft, formatCountdown } from '../codQr';

describe('codQr', () => {
  it('pending is not paid, PAID is paid', () => {
    expect(isQrPaid('PENDING')).toBe(false);
    expect(isQrPaid(null)).toBe(false);
    expect(isQrPaid('PAID')).toBe(true);
  });
  it('counts down to expiry and stops at 0', () => {
    const exp = '2026-10-26T10:14:11+07:00';
    expect(secondsLeft(exp, Date.parse('2026-10-26T10:04:11+07:00'))).toBe(600);
    expect(secondsLeft(exp, Date.parse('2026-10-26T10:20:00+07:00'))).toBe(0);
    expect(formatCountdown(600)).toBe('10:00');
  });
});
