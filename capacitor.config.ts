import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thetroob.mobile',
  appName: 'The Troob Mobile',
  webDir: 'dist',
  plugins: {
    Camera: {
      // Android permissions are handled in AndroidManifest.xml
      // These settings help with camera behavior
      presentationStyle: 'fullscreen'
    }
  }
};

export default config;
