import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('platform push identifiers', () => {
  it('sends APNs using the installed iOS app identifier', () => {
    const source = readFileSync('supabase/functions/send-push-notification/index.ts', 'utf8');
    const bundleId = source.match(/const bundleId = '([^']+)'/)?.[1];
    expect(bundleId).toBe('com.thetrucker.mobile');
    expect(source).toMatch(/'apns-topic': bundleId/);
  });

  it('preserves the Android app identifier', () => {
    const source = readFileSync('capacitor.config.ts', 'utf8');
    expect(source.match(/appId: '([^']+)'/)?.[1]).toBe('com.thetroob.mobile');
  });
});