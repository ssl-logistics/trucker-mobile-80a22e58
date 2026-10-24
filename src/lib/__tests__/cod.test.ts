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
