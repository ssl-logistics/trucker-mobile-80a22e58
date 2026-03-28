import { createContext, useContext, useEffect, useState } from 'react';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { autoRegisterOAuthUser } from '@/utils/oauthAutoRegister';
import {
  AUTH_KEYS,
  getAuthItem,
  removeAuthItem,
  setAuthItem,
  syncAuthFromLocalStorageToNative,
  handleFirstRunAfterInstall,
} from '@/utils/authStorage';
import { supabase } from '@/integrations/supabase/client';

interface LineUser {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface DriverData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone_number?: string;
  username?: string;
  email?: string;
  // Login source fields
  loginType?: 'normal' | 'line' | 'apple' | 'google';
  lineUser?: LineUser;
  [key: string]: any;
}

interface AuthContextType {
  user: DriverData | null;
  loading: boolean;
  role: string;
  userType: string;
  employerType: string | null;
  isAuthenticated: boolean;
  isAuthTransitioning: boolean;
  authTransitionMessage: string;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setAuthTransitioning: (value: boolean, message?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: 'freelance',
  userType: 'freelance_driver',
  employerType: null,
  isAuthenticated: false,
  isAuthTransitioning: false,
  authTransitionMessage: '',
  logout: () => {},
  refreshUser: async () => {},
  setAuthTransitioning: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('freelance');
  const [userType, setUserType] = useState<string>('freelance_driver');
  const [employerType, setEmployerType] = useState<string | null>(null);
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [authTransitionMessage, setAuthTransitionMessage] = useState('');

  const loadUserFromStorage = async () => {
    setLoading(true);

    const safeJsonParse = <T,>(value: string): T | null => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    };

    try {
      // Handle first run after install - clear stale auth if no marker exists
      await handleFirstRunAfterInstall();

      // Keep both stores in sync (useful after upgrades)
      await syncAuthFromLocalStorageToNative();

      const [driverData, userRole, storedUserType, lineUserData, loginType, storedEmployerType] = await Promise.all([
        getAuthItem('auth_driver'),
        getAuthItem('user_role'),
        getAuthItem('auth_user_type'),
        getAuthItem('line_user'),
        getAuthItem('auth_login_type'),
        getAuthItem('auth_employer_type'),
      ]);

      const parsedDriver = driverData && driverData !== 'null' ? safeJsonParse<any>(driverData) : null;
      const hasValidDriver =
        parsedDriver &&
        typeof parsedDriver === 'object' &&
        typeof parsedDriver.id === 'string' &&
        parsedDriver.id.length > 0;

      // If we detect corrupted/invalid data, clear it once to avoid a permanent boot loop
      if (driverData && !hasValidDriver) {
        await Promise.all([removeAuthItem('auth_driver'), removeAuthItem('auth_driver_id')]);
      }

      if (hasValidDriver) {
        const driver: DriverData = parsedDriver;

        // Add LINE user data if available
        if (lineUserData && loginType === 'line') {
          const lineUser = safeJsonParse<LineUser>(lineUserData);
          if (lineUser) {
            driver.loginType = 'line';
            driver.lineUser = lineUser;

            // Use LINE profile data if not set
            if (!driver.avatar_url && lineUser.pictureUrl) {
              driver.avatar_url = lineUser.pictureUrl;
            }
            if (!driver.full_name && lineUser.displayName) {
              driver.full_name = lineUser.displayName;
            }
          } else {
            driver.loginType = 'normal';
          }
        } else if (loginType === 'apple' || loginType === 'google') {
          driver.loginType = loginType;
        } else {
          driver.loginType = 'normal';
        }

        setUser(driver);

        // Store userType directly for feature access control
        setUserType(storedUserType || 'freelance_driver');

        // Store employer type for internal/external drivers
        setEmployerType(storedEmployerType || null);

        // Map user_type to role for backward compatibility
        let mappedRole = 'freelance';
        if (storedUserType === 'freelance_driver' || storedUserType === 'internal_driver' || storedUserType === 'external_driver') {
          mappedRole = 'freelance';
        } else if (storedUserType === 'company') {
          mappedRole = 'company';
        } else if (storedUserType === 'factory') {
          mappedRole = 'factory';
        } else if (userRole) {
          mappedRole = userRole;
        }

        setRole(mappedRole);
      } else {
        // Fallback: if OAuth session exists (Apple/Google), hydrate app auth storage
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('Auth session check failed:', sessionError.message);
        }

        const sessionUser = session?.user;
        const providerFromMetadata = sessionUser?.app_metadata?.provider;
        const providerFromIdentity = sessionUser?.identities?.find(
          (identity) => identity?.provider === 'apple' || identity?.provider === 'google'
        )?.provider;

        const oauthProvider =
          providerFromMetadata === 'apple' || providerFromMetadata === 'google'
            ? providerFromMetadata
            : providerFromIdentity === 'apple' || providerFromIdentity === 'google'
              ? providerFromIdentity
              : null;

        if (sessionUser && oauthProvider) {
          // Try to get real driver data from TMS via register-driver
          let tmsDriverData: any = null;
          try {
            const { data: regData } = await supabase.functions.invoke('register-driver', {
              body: {
                authProvider: oauthProvider,
                authUserId: sessionUser.id,
                firstName: sessionUser.user_metadata?.full_name?.split(' ')[0],
                lastName: sessionUser.user_metadata?.full_name?.split(' ').slice(1).join(' '),
              },
            });
            tmsDriverData = regData?.data || regData;
            console.log('[AuthContext] TMS driver data:', tmsDriverData);
          } catch (e) {
            console.warn('[AuthContext] register-driver failed (non-blocking):', e);
          }

          const tmsFullName = tmsDriverData
            ? `${tmsDriverData.firstName || ''} ${tmsDriverData.lastName || ''}`.trim()
            : '';

          const oauthDriver: DriverData = {
            id: tmsDriverData?.id || sessionUser.id,
            full_name:
              tmsFullName ||
              sessionUser.user_metadata?.full_name ||
              sessionUser.user_metadata?.name ||
              sessionUser.email ||
              'OAuth User',
            avatar_url:
              sessionUser.user_metadata?.avatar_url ||
              sessionUser.user_metadata?.picture ||
              null,
            phone_number: tmsDriverData?.phone || '',
            email: tmsDriverData?.email || sessionUser.email,
            username: tmsDriverData?.driverCode || '',
            loginType: oauthProvider,
            // Spread all TMS data to include vehicle info, bank details, etc.
            ...(tmsDriverData && typeof tmsDriverData === 'object' ? tmsDriverData : {}),
          };

          // Auto-register in DB (non-blocking, register-driver already called above)
          autoRegisterOAuthUser({
            authProvider: oauthProvider as 'apple' | 'google',
            authUserId: sessionUser.id,
            firstName: sessionUser.user_metadata?.full_name?.split(' ')[0],
            lastName: sessionUser.user_metadata?.full_name?.split(' ').slice(1).join(' '),
          });

          await Promise.all([
            setAuthItem('auth_driver', JSON.stringify(oauthDriver)),
            setAuthItem('auth_driver_id', oauthDriver.id),
            setAuthItem('auth_login_type', oauthProvider),
            setAuthItem('auth_user_type', 'freelance_driver'),
            setAuthItem('user_role', 'freelance'),
          ]);

          setUser(oauthDriver);
          setRole('freelance');
          setUserType('freelance_driver');
          setEmployerType(null);
          return;
        }

        // Not authenticated (we require a valid stored auth_driver)
        setUser(null);
        setRole('freelance');
        setUserType('freelance_driver');
        setEmployerType(null);
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
      setUser(null);
      setRole('freelance');
      setUserType('freelance_driver');
      setEmployerType(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Best-effort clear in both localStorage + native Preferences
    AUTH_KEYS.forEach((k) => {
      void removeAuthItem(k);
    });

    // Also clear OAuth session if exists
    void supabase.auth.signOut();

    sessionStorage.removeItem('line_oauth_state');
    setUser(null);
    setRole('freelance');
    setUserType('freelance_driver');
    setEmployerType(null);
  };

  const refreshUser = async () => {
    const storedDriverId = await getAuthItem('auth_driver_id');
    const loginType = await getAuthItem('auth_login_type');
    const driverId = storedDriverId || user?.id;

    if (!driverId) {
      console.log('No driver ID found, loading from storage');
      await loadUserFromStorage();
      return;
    }

    try {
      // For OAuth users (LINE/Apple/Google), use register-driver to get fresh TMS data
      const isOAuth = loginType === 'line' || loginType === 'apple' || loginType === 'google';
      
      if (isOAuth) {
        console.log('Fetching fresh OAuth user data from register-driver...');
        const { data: regData, error: regError } = await supabase.functions.invoke('register-driver', {
          body: {
            authProvider: loginType,
            authUserId: driverId,
          },
        });

        if (!regError && regData) {
          const tmsData = regData?.data || regData;
          if (tmsData && tmsData.id) {
            console.log('Updated OAuth driver data from TMS:', tmsData);
            
            // Merge TMS data with existing user data (preserve loginType, lineUser etc)
            const currentDriver: any = user || {};
            const tmsFullName = `${tmsData.firstName || ''} ${tmsData.lastName || ''}`.trim();
            
            const updatedDriver: any = {
              ...currentDriver,
              id: tmsData.id,
              full_name: tmsFullName || currentDriver.full_name,
              phone_number: tmsData.phone || (currentDriver as any).phone_number || '',
              email: tmsData.email || (currentDriver as any).email || '',
              username: tmsData.driverCode || (currentDriver as any).username || '',
              first_name: tmsData.firstName || '',
              last_name: tmsData.lastName || '',
              loginType: loginType,
              ...(tmsData.bank_name && { bank_name: tmsData.bank_name }),
              ...(tmsData.bank_account_number && { bank_account_number: tmsData.bank_account_number }),
              ...(tmsData.bank_account_name && { bank_account_name: tmsData.bank_account_name }),
            };

            await setAuthItem('auth_driver', JSON.stringify(updatedDriver));
            await setAuthItem('auth_driver_id', tmsData.id);
            setUser(updatedDriver);
            window.dispatchEvent(new Event('auth_driver_updated'));
            return;
          }
        }
        console.warn('OAuth refresh failed, falling back to storage');
        await loadUserFromStorage();
        return;
      }

      // For normal users, use get-freelance-drivers
      console.log('Fetching fresh user data from API...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-drivers`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('API response:', data);

        // Find the current user in the response
        let updatedDriver = null;
        if (Array.isArray(data)) {
          updatedDriver = data.find((d: any) => d.id === driverId);
        } else if (data.drivers && Array.isArray(data.drivers)) {
          updatedDriver = data.drivers.find((d: any) => d.id === driverId);
        } else if (data.data && Array.isArray(data.data)) {
          updatedDriver = data.data.find((d: any) => d.id === driverId);
        }

        if (updatedDriver) {
          console.log('Updated driver data:', updatedDriver);
          await setAuthItem('auth_driver', JSON.stringify(updatedDriver));
          setUser(updatedDriver);
          window.dispatchEvent(new Event('auth_driver_updated'));
        } else {
          console.log('Driver not found in API response, using storage');
          await loadUserFromStorage();
        }
      } else {
        console.error('Failed to fetch user data:', response.status);
        await loadUserFromStorage();
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      await loadUserFromStorage();
    }
  };

  useEffect(() => {
    void loadUserFromStorage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole('freelance');
        setUserType('freelance_driver');
        setEmployerType(null);
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        void loadUserFromStorage();
      }
    });

    // Listen for storage changes (multi-tab support)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_driver' || e.key === 'user_role' || e.key === 'auth_user_type') {
        void loadUserFromStorage();
      }
    };

    // Same-tab support: manually dispatched event after login
    const handleAuthUpdated = () => {
      void loadUserFromStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth_driver_updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth_driver_updated', handleAuthUpdated);
      subscription.unsubscribe();
    };
  }, []);

  const setAuthTransitioning = (value: boolean, message?: string) => {
    setIsAuthTransitioning(value);
    if (message) {
      setAuthTransitionMessage(message);
    }
  };

  const value = {
    user,
    loading,
    role,
    userType,
    employerType,
    isAuthenticated: !!user,
    isAuthTransitioning,
    authTransitionMessage,
    logout,
    refreshUser,
    setAuthTransitioning,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthLoadingOverlay
        isVisible={isAuthTransitioning}
        message={authTransitionMessage || 'กำลังโหลด...'}
      />
    </AuthContext.Provider>
  );
};
