import { createContext, useContext, useEffect, useState } from 'react';

interface DriverData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone_number?: string;
  username?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: DriverData | null;
  loading: boolean;
  role: string;
  isAuthenticated: boolean;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: 'freelance',
  isAuthenticated: false,
  logout: () => {},
  refreshUser: () => {},
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

  const loadUserFromStorage = () => {
    try {
      const driverData = localStorage.getItem('auth_driver');
      const userRole = localStorage.getItem('user_role');
      const userType = localStorage.getItem('auth_user_type');
      
      if (driverData) {
        const driver = JSON.parse(driverData);
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
    localStorage.removeItem('auth_driver');
    localStorage.removeItem('auth_user_type');
    localStorage.removeItem('user_role');
    localStorage.removeItem('auth_driver_id');
    setUser(null);
    setRole('freelance');
  };

  const refreshUser = () => {
    loadUserFromStorage();
  };

  useEffect(() => {
    loadUserFromStorage();

    // Listen for storage changes (multi-tab support)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_driver' || e.key === 'user_role' || e.key === 'auth_user_type') {
        loadUserFromStorage();
      }
    };

    // Same-tab support: manually dispatched event after login
    const handleAuthUpdated = () => {
      loadUserFromStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth_driver_updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth_driver_updated', handleAuthUpdated);
    };
  }, []);

  const value = {
    user,
    loading,
    role,
    isAuthenticated: !!user,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
