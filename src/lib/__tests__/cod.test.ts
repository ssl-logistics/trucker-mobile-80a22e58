import { describe, it, expect } from 'vitest';
import { getCodForPoint } from '../cod';

describe('getCodForPoint', () => {
  it('single trip reads job-level cod', () => {
    const job = { cod: { enabled: true, amount: 12500, payment_method: 'qr' }, destinations: [] };
    expect(getCodForPoint(job, null)).toEqual({ enabled: true, amount: 12500, method: 'qr' });
  });

  it('multi destination reads cod of that sequence only', () => {
    const job = {
      cod: { enabled: false, amount: null, payment_method: null },
      destinations: [
        { sequence_number: 1, cod: { enabled: true, amount: 8200, payment_method: 'cash' } },
        { sequence_number: 2, cod: { enabled: false, amount: null, payment_method: null } },
      ],
    };
    expect(getCodForPoint(job, 1)).toEqual({ enabled: true, amount: 8200, method: 'cash' });
    expect(getCodForPoint(job, 2).enabled).toBe(false);
  });

  it('job without cod is not enabled', () => {
    expect(getCodForPoint({ destinations: [] }, null).enabled).toBe(false);
  });
});

import { jobHasCod } from '../cod';
describe('jobHasCod', () => {
  it('single trip cod', () => expect(jobHasCod({ cod: { enabled: true } })).toBe(true));
  it('one destination cod', () => expect(jobHasCod({ destinations: [{}, { cod: { enabled: true } }] })).toBe(true));
  it('no cod', () => expect(jobHasCod({ cod: { enabled: false }, destinations: [{}] })).toBe(false));
});

import { codTotal, tabCount } from '../cod';
describe('codTotal', () => {
  it('sums multi-stop COD amounts', () => {
    expect(codTotal({ destinations: [{ sequence_number: 1, cod: { enabled: true, amount: 100 } }, { sequence_number: 2, cod: { enabled: true, amount: 50 } }, { sequence_number: 3 }] })).toEqual({ total: 150, points: 2 });
  });
  it('does not double count single trip', () => {
    expect(codTotal({ cod: { enabled: true, amount: 120 }, destinations: [{ cod: { enabled: true, amount: 120 } }] })).toEqual({ total: 120, points: 1 });
  });
  it('null total when no amount', () => {
    expect(codTotal({ cod: { enabled: true } }).total).toBeNull();
  });
  it('tab count caps at 99+', () => {
    expect(tabCount(0)).toBe('0'); expect(tabCount(99)).toBe('99'); expect(tabCount(100)).toBe('99+');
  });
});
