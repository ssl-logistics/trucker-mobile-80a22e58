import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Bell, Smartphone, Database, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getAuthItem } from '@/utils/authStorage';
import {
  isPushSupported,
  getPushPermissionStatus,
  enablePushNotifications,
  getPlatformName,
} from '@/utils/unifiedPushNotifications';
import { isNativePlatform } from '@/utils/capacitorPushNotifications';

interface DebugInfo {
  platform: string;
  isNative: boolean;
  isPushSupported: boolean;
  permissionStatus: string;
  userId: string | null;
  userIdSource: string;
  subscriptions: any[];
  lastError: string | null;
}

const PushDebugPage = () => {
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    platform: '',
    isNative: false,
    isPushSupported: false,
    permissionStatus: 'loading...',
    userId: null,
    userIdSource: 'none',
    subscriptions: [],
    lastError: null,
  });
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
    console.log(`[PushDebug] ${message}`);
  };

  const loadDebugInfo = async () => {
    setLoading(true);
    addLog('Loading debug info...');

    try {
      // Platform info
      const platform = getPlatformName();
      const isNative = isNativePlatform();
      const supported = isPushSupported();
      
      addLog(`Platform: ${platform}, Native: ${isNative}, Supported: ${supported}`);

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
            const isFCM = sub.endpoint.startsWith('fcm://');
            addLog(`  [${i}] ${isFCM ? 'FCM' : 'Web'}: ${sub.endpoint.substring(0, 40)}...`);
          });
        }
      }

      setDebugInfo({
        platform,
        isNative,
        isPushSupported: supported,
        permissionStatus: permStatus,
        userId,
        userIdSource,
        subscriptions,
        lastError: null,
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
    addLog(`Platform: ${debugInfo.platform}, Native: ${debugInfo.isNative}`);

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
      addLog('⏳ Waiting for FCM token (up to 20s)...');
      const startTime = Date.now();
      
      const token = await registerNativePushNotifications();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (token) {
        addLog(`✅ Got token in ${duration}s!`);
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
        addLog(`❌ No token after ${duration}s`);
        addLog('⚠️ Possible causes:');
        addLog('  - APNs key not uploaded to Firebase');
        addLog('  - Push capability not enabled in Xcode');
        addLog('  - Invalid provisioning profile');
        addLog('  - Check Xcode console for [NativePush] logs');
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
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

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
              <span>Native:</span>
              <Badge variant={debugInfo.isNative ? 'default' : 'outline'}>
                {debugInfo.isNative ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Push Supported:</span>
              <Badge variant={debugInfo.isPushSupported ? 'default' : 'destructive'}>
                {debugInfo.isPushSupported ? 'Yes' : 'No'}
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
            {debugInfo.subscriptions.length === 0 ? (
              <p className="text-muted-foreground">No subscriptions found</p>
            ) : (
              debugInfo.subscriptions.map((sub, i) => {
                const isFCM = sub.endpoint.startsWith('fcm://');
                return (
                  <div key={sub.id} className="p-2 bg-muted rounded text-xs">
                    <div className="flex justify-between mb-1">
                      <Badge variant={isFCM ? 'default' : 'secondary'}>
                        {isFCM ? 'FCM (Native)' : 'Web Push'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-mono truncate">{sub.endpoint.substring(0, 50)}...</p>
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
      </div>
    </div>
  );
};

export default PushDebugPage;
