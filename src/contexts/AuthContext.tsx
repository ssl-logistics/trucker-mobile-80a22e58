import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  full_name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
}

// Global cache for profile to prevent flickering during navigation
let cachedProfile: UserProfile | null = null;

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export function to clear all caches on logout
export const clearAuthCache = () => {
  cachedProfile = null;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        cachedProfile = data;
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      cachedProfile = null; // Clear cache to force refresh
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log('Auth event:', event, 'Session:', currentSession ? 'exists' : 'null');
        
        if (!mounted) return;

        // Handle the session
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Clear cache and fetch profile on login
        if (event === 'SIGNED_IN' && currentSession?.user) {
          cachedProfile = null; // Clear cache on new login
          setTimeout(() => {
            fetchProfile(currentSession.user.id);
          }, 0);
        }

        // Clear cache on logout
        if (event === 'SIGNED_OUT') {
          cachedProfile = null;
          setProfile(null);
        }
        
        // Only set loading to false after we've handled the initial session
        if (loading) {
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Fetch profile if we have a session and no cached profile
        if (currentSession?.user && !cachedProfile) {
          fetchProfile(currentSession.user.id);
        }
        
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    profile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
