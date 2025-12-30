import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trucker.mobile',
  appName: 'The Troob',
  webDir: 'dist',
  server: {
    url: 'https://58dbc0b4-f7db-4735-aa15-2391efc8b797.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
