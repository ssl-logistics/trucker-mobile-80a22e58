import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thetroob.mobile',
  appName: 'The Troob Mobile',
  webDir: 'dist',
  // Use HTTPS origin (https://localhost) inside Android WebView.
  // This avoids auth/CORS allow-list issues that reject non-https origins.
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  ios: {
    // iOS specific configurations
    // These will be used when running `npx cap sync`
    // The actual Info.plist entries need to be added manually or via Xcode
  }
};

export default config;
