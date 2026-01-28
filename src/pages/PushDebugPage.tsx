import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Bell, Smartphone, Database, User, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getAuthItem } from '@/utils/authStorage';
import {
  isPushSupported,
  getPushPermissionStatus,
  getPlatformName,
} from '@/utils/unifiedPushNotifications';
import { isNativePlatform } from '@/utils/capacitorPushNotifications';

interface DebugInfo {
  platform: string;
  nativePlatform: string;
  isNative: boolean;
  isPushSupported: boolean;
  permissionStatus: string;
  userId: string | null;
  userIdSource: string;
  subscriptions: any[];
  lastError: string | null;
  hasFCMToken: boolean;
  hasAPNsToken: boolean;
  hasWebToken: boolean;
}

const PushDebugPage = () => {
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    platform: '',
    nativePlatform: '',
    isNative: false,
    isPushSupported: false,
    permissionStatus: 'loading...',
    userId: null,
    userIdSource: 'none',
    subscriptions: [],
    lastError: null,
    hasFCMToken: false,
    hasAPNsToken: false,
    hasWebToken: false,
  });
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
    console.log(`[PushDebug] ${message}`);
  };

  const getTokenType = (endpoint: string): 'fcm' | 'apns' | 'web' => {
    if (endpoint.startsWith('fcm://')) return 'fcm';
    if (endpoint.startsWith('apns://')) return 'apns';
    return 'web';
  };

  const getTokenLabel = (type: 'fcm' | 'apns' | 'web'): string => {
    switch (type) {
      case 'fcm': return 'FCM (Android)';
      case 'apns': return 'APNs (iOS)';
      case 'web': return 'Web Push';
    }
  };

  const loadDebugInfo = async () => {
    setLoading(true);
    addLog('Loading debug info...');

    try {
      // Platform info
      const platform = getPlatformName();
      const isNative = isNativePlatform();
      const supported = isPushSupported();
      const nativePlatform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'
      
      addLog(`Platform: ${platform}, Native: ${isNative}, Capacitor: ${nativePlatform}`);

      // Permission status
      let permStatus = 'unknown';
      try {
        permStatus = await getPushPermissionStatus();
        addLog(`Permission status: ${permStatus}`);
      } catch (e: any) {
        addLog(`Permission check error: ${e.message}`);
      }

      // User ID check
      let userId: string | null = null;
      let userIdSource = 'none';

      // Method 1: Supabase auth
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          userId = user.id;
          userIdSource = 'supabase_auth';
          addLog(`User ID from Supabase: ${userId}`);
        }
      } catch (e) {
        addLog('Supabase auth not available');
      }

      // Method 2: Preferences auth_driver_id
      if (!userId) {
        const driverId = await getAuthItem('auth_driver_id');
        if (driverId) {
          userId = driverId;
          userIdSource = 'preferences_driver_id';
          addLog(`User ID from preferences: ${userId}`);
        }
      }

      // Method 3: Preferences auth_driver object
      if (!userId) {
        const driverStr = await getAuthItem('auth_driver');
        if (driverStr) {
          try {
            const parsed = JSON.parse(driverStr);
            if (parsed?.id) {
              userId = String(parsed.id);
              userIdSource = 'preferences_driver_object';
              addLog(`User ID from driver object: ${userId}`);
            }
          } catch (e) {
            addLog('Failed to parse auth_driver');
          }
        }
      }

      // Method 4: localStorage
      if (!userId) {
        const localId = localStorage.getItem('auth_driver_id');
        if (localId) {
          userId = localId;
          userIdSource = 'localStorage';
          addLog(`User ID from localStorage: ${userId}`);
        }
      }

      if (!userId) {
        addLog('⚠️ No user ID found from any source!');
      }

      // Get subscriptions from database
      let subscriptions: any[] = [];
      let hasFCMToken = false;
      let hasAPNsToken = false;
      let hasWebToken = false;

      if (userId) {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);
        
        if (error) {
          addLog(`DB error: ${error.message}`);
        } else {
          subscriptions = data || [];
          addLog(`Found ${subscriptions.length} subscriptions in DB`);
          subscriptions.forEach((sub, i) => {
            const tokenType = getTokenType(sub.endpoint);
            if (tokenType === 'fcm') hasFCMToken = true;
            if (tokenType === 'apns') hasAPNsToken = true;
            if (tokenType === 'web') hasWebToken = true;
            addLog(`  [${i}] ${getTokenLabel(tokenType)}: ${sub.endpoint.substring(0, 40)}...`);
          });
        }
      }

      // Check if current platform has correct token
      if (nativePlatform === 'android' && !hasFCMToken) {
        addLog('⚠️ Android detected but NO FCM token in DB!');
      }
      if (nativePlatform === 'ios' && !hasAPNsToken) {
        addLog('⚠️ iOS detected but NO APNs token in DB!');
      }

      setDebugInfo({
        platform,
        nativePlatform,
        isNative,
        isPushSupported: supported,
        permissionStatus: permStatus,
        userId,
        userIdSource,
        subscriptions,
        lastError: null,
        hasFCMToken,
        hasAPNsToken,
        hasWebToken,
      });

    } catch (error: any) {
      addLog(`Error: ${error.message}`);
      setDebugInfo(prev => ({ ...prev, lastError: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPush = async () => {
    setLoading(true);
    addLog('Starting push registration...');
    addLog(`Platform: ${debugInfo.platform}, Native: ${debugInfo.isNative}, Capacitor: ${debugInfo.nativePlatform}`);

    try {
      // Step 1: Check current permission
      addLog('Step 1: Checking current permission...');
      const currentPerm = await getPushPermissionStatus();
      addLog(`Current permission: ${currentPerm}`);
      
      // Step 2: Import native registration directly for detailed logging
      addLog('Step 2: Importing native push utilities...');
      const { registerNativePushNotifications, saveNativePushToken, setupNativePushListeners } = await import('@/utils/capacitorPushNotifications');
      
      // Step 3: Call native registration directly
      addLog('Step 3: Calling registerNativePushNotifications()...');
      
      const expectedTokenType = debugInfo.nativePlatform === 'ios' ? 'APNs' : 'FCM';
      addLog(`⏳ Waiting for ${expectedTokenType} token (up to 20s)...`);
      
      const startTime = Date.now();
      
      const token = await registerNativePushNotifications();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (token) {
        addLog(`✅ Got ${expectedTokenType} token in ${duration}s!`);
        addLog(`Token prefix: ${token.substring(0, 30)}...`);
        addLog(`Token length: ${token.length}`);
        
        // Step 4: Save token
        addLog('Step 4: Saving token to database...');
        try {
          await saveNativePushToken(token);
          addLog('✅ Token saved to DB!');
          setupNativePushListeners();
          addLog('✅ Listeners set up!');
        } catch (saveError: any) {
          addLog(`❌ Save error: ${saveError.message}`);
        }
      } else {
        addLog(`❌ No ${expectedTokenType} token after ${duration}s`);
        
        if (debugInfo.nativePlatform === 'android') {
          addLog('');
          addLog('🔧 ANDROID FCM TROUBLESHOOTING:');
          addLog('1. Check google-services.json is in android/app/');
          addLog('2. Check android/build.gradle has Firebase plugin');
          addLog('3. Check android/app/build.gradle has Firebase deps');
          addLog('4. Run: npx cap sync android && cd android && ./gradlew clean');
          addLog('5. Check logcat for Firebase/FCM errors');
        } else if (debugInfo.nativePlatform === 'ios') {
          addLog('');
          addLog('🔧 iOS APNs TROUBLESHOOTING:');
          addLog('1. Enable Push Notifications capability in Xcode');
          addLog('2. Check provisioning profile has Push Notifications');
          addLog('3. Upload APNs key to Firebase Console');
          addLog('4. Check Xcode console for [NativePush] logs');
        }
      }
      
      // Step 5: Check permission again
      addLog('Step 5: Checking permission after...');
      const afterPerm = await getPushPermissionStatus();
      addLog(`Permission after: ${afterPerm}`);
      
      // Reload debug info to show updated subscriptions
      await loadDebugInfo();
      
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      addLog(`Error stack: ${error.stack?.substring(0, 200) || 'no stack'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!debugInfo.userId) {
      addLog('❌ No user ID - cannot test');
      return;
    }

    setLoading(true);
    addLog('Sending test notification...');

    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: [debugInfo.userId],
          title: '🔔 Test Notification',
          body: 'This is a test from Push Debug page',
          data: { test: true },
        },
      });

      if (error) {
        addLog(`❌ Error: ${error.message}`);
      } else {
        addLog(`✅ Response: ${JSON.stringify(data)}`);
        
        // Check if sent to correct platform
        if (data?.results) {
          const types = data.results.map((r: any) => r.type).join(', ');
          addLog(`📤 Sent via: ${types}`);
          
          if (debugInfo.nativePlatform === 'android' && !types.includes('fcm')) {
            addLog('⚠️ Android device but no FCM notification sent!');
            addLog('   This means no FCM token is registered.');
          }
          if (debugInfo.nativePlatform === 'ios' && !types.includes('apns')) {
            addLog('⚠️ iOS device but no APNs notification sent!');
            addLog('   This means no APNs token is registered.');
          }
        }
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-register push when page loads
  useEffect(() => {
    const initAndRegister = async () => {
      await loadDebugInfo();
      
      // Auto-register push if permission not denied
      addLog('🚀 Auto-registering push on page load...');
      const permStatus = await getPushPermissionStatus();
      
      if (permStatus === 'denied') {
        addLog('⚠️ Permission denied - please enable in Settings');
        return;
      }
      
      // Wait a bit for debug info to load
      setTimeout(() => {
        handleRegisterPush();
      }, 500);
    };
    
    initAndRegister();
  }, []);

  // Determine if there's a token mismatch warning
  const hasTokenMismatch = 
    (debugInfo.nativePlatform === 'android' && !debugInfo.hasFCMToken && debugInfo.subscriptions.length > 0) ||
    (debugInfo.nativePlatform === 'ios' && !debugInfo.hasAPNsToken && debugInfo.subscriptions.length > 0);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Push Debug</h1>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={loadDebugInfo}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Token Mismatch Warning */}
        {hasTokenMismatch && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Token Type Mismatch!</p>
                  <p className="text-muted-foreground mt-1">
                    {debugInfo.nativePlatform === 'android' 
                      ? 'You are on Android but only have APNs (iOS) token. FCM token is required for Android push notifications.'
                      : 'You are on iOS but only have FCM (Android) token. APNs token is required for iOS push notifications.'
                    }
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Click "Register Push" to get the correct token.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Platform Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Platform
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Platform:</span>
              <Badge variant={debugInfo.isNative ? 'default' : 'secondary'}>
                {debugInfo.platform}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Capacitor Platform:</span>
              <Badge variant="outline">
                {debugInfo.nativePlatform || 'web'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Native:</span>
              <Badge variant={debugInfo.isNative ? 'default' : 'outline'}>
                {debugInfo.isNative ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Expected Token Type:</span>
              <Badge variant="default">
                {debugInfo.nativePlatform === 'ios' ? 'APNs' : debugInfo.nativePlatform === 'android' ? 'FCM' : 'Web Push'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Permission Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Permission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Status:</span>
              <Badge 
                variant={
                  debugInfo.permissionStatus === 'granted' ? 'default' :
                  debugInfo.permissionStatus === 'denied' ? 'destructive' : 'secondary'
                }
              >
                {debugInfo.permissionStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>User ID:</span>
              <span className="text-xs font-mono truncate max-w-[180px]">
                {debugInfo.userId || '❌ Not found'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Source:</span>
              <Badge variant="outline">{debugInfo.userIdSource}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Subscriptions ({debugInfo.subscriptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* Token summary */}
            <div className="flex gap-2 flex-wrap mb-2">
              <Badge variant={debugInfo.hasFCMToken ? 'default' : 'outline'}>
                FCM: {debugInfo.hasFCMToken ? '✓' : '✗'}
              </Badge>
              <Badge variant={debugInfo.hasAPNsToken ? 'default' : 'outline'}>
                APNs: {debugInfo.hasAPNsToken ? '✓' : '✗'}
              </Badge>
              <Badge variant={debugInfo.hasWebToken ? 'default' : 'outline'}>
                Web: {debugInfo.hasWebToken ? '✓' : '✗'}
              </Badge>
            </div>

            {debugInfo.subscriptions.length === 0 ? (
              <p className="text-muted-foreground">No subscriptions found</p>
            ) : (
              debugInfo.subscriptions.map((sub) => {
                const tokenType = getTokenType(sub.endpoint);
                const isCorrectForPlatform = 
                  (debugInfo.nativePlatform === 'android' && tokenType === 'fcm') ||
                  (debugInfo.nativePlatform === 'ios' && tokenType === 'apns') ||
                  (debugInfo.nativePlatform === 'web' && tokenType === 'web');
                
                return (
                  <div key={sub.id} className={`p-2 rounded text-xs ${isCorrectForPlatform ? 'bg-muted' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                    <div className="flex justify-between mb-1">
                      <Badge variant={tokenType === 'fcm' ? 'default' : tokenType === 'apns' ? 'secondary' : 'outline'}>
                        {getTokenLabel(tokenType)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-mono truncate">{sub.endpoint.substring(0, 50)}...</p>
                    {!isCorrectForPlatform && (
                      <p className="text-yellow-600 mt-1">⚠️ Wrong token type for {debugInfo.nativePlatform}</p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            className="flex-1" 
            onClick={handleRegisterPush}
            disabled={loading}
          >
            Register Push
          </Button>
          <Button 
            variant="outline"
            className="flex-1" 
            onClick={handleTestNotification}
            disabled={loading || !debugInfo.userId}
          >
            Test Notification
          </Button>
        </div>

        {/* Logs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-y-auto bg-black text-green-400 p-2 rounded text-xs font-mono">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Android Setup Guide */}
        {debugInfo.nativePlatform === 'android' && !debugInfo.hasFCMToken && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🔧 Android FCM Setup Required</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <p><strong>1.</strong> Copy <code>google-services.json</code> to <code>android/app/</code></p>
              <p><strong>2.</strong> In <code>android/build.gradle</code> add:</p>
              <pre className="bg-muted p-2 rounded overflow-x-auto">
{`buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}`}
              </pre>
              <p><strong>3.</strong> In <code>android/app/build.gradle</code> add:</p>
              <pre className="bg-muted p-2 rounded overflow-x-auto">
{`apply plugin: 'com.google.gms.google-services'

dependencies {
  implementation platform('com.google.firebase:firebase-bom:32.7.0')
  implementation 'com.google.firebase:firebase-messaging'
}`}
              </pre>
              <p><strong>4.</strong> Run: <code>npx cap sync android</code></p>
              <p><strong>5.</strong> Rebuild the app</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PushDebugPage;
