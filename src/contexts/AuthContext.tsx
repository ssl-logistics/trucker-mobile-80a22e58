import { createContext, useContext, useEffect, useState } from 'react';
import { AuthLoadingOverlay } from '@/components/auth/AuthLoadingOverlay';
import { AUTH_KEYS, getAuthItem, removeAuthItem, setAuthItem, syncAuthFromLocalStorageToNative } from '@/utils/authStorage';

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
  // LINE login fields
  loginType?: 'normal' | 'line';
  lineUser?: LineUser;
  [key: string]: any;
}

interface AuthContextType {
  user: DriverData | null;
  loading: boolean;
  role: string;
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
      // Keep both stores in sync (useful after upgrades)
      await syncAuthFromLocalStorageToNative();

      const [driverData, userRole, userType, lineUserData, loginType] = await Promise.all([
        getAuthItem('auth_driver'),
        getAuthItem('user_role'),
        getAuthItem('auth_user_type'),
        getAuthItem('line_user'),
        getAuthItem('auth_login_type'),
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
        } else {
          driver.loginType = 'normal';
        }

        setUser(driver);

        // Map user_type to role - freelance_driver becomes freelance
        let mappedRole = 'freelance';
        if (userType === 'freelance_driver') {
          mappedRole = 'freelance';
        } else if (userType === 'company') {
          mappedRole = 'company';
        } else if (userType === 'factory') {
          mappedRole = 'factory';
        } else if (userRole) {
          mappedRole = userRole;
        }

        setRole(mappedRole);
      } else if (lineUserData) {
        // LINE login only (no existing driver account)
        const lineUser = safeJsonParse<LineUser>(lineUserData);
        if (lineUser) {
          const lineDriver: DriverData = {
            id: lineUser.lineUserId,
            full_name: lineUser.displayName,
            avatar_url: lineUser.pictureUrl || null,
            loginType: 'line',
            lineUser: lineUser,
          };
          setUser(lineDriver);
          setRole('freelance');
        } else {
          setUser(null);
          setRole('freelance');
        }
      } else {
        setUser(null);
        setRole('freelance');
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
      setUser(null);
      setRole('freelance');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Best-effort clear in both localStorage + native Preferences
    AUTH_KEYS.forEach((k) => {
      void removeAuthItem(k);
    });

    sessionStorage.removeItem('line_oauth_state');
    setUser(null);
    setRole('freelance');
  };

  const refreshUser = async () => {
    const storedDriverId = await getAuthItem('auth_driver_id');
    const driverId = storedDriverId || user?.id;

    if (!driverId) {
      console.log('No driver ID found, loading from storage');
      await loadUserFromStorage();
      return;
    }

    try {
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

          // Dispatch event to notify other components
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
