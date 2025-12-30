import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'freelance' | 'company' | 'factory' | null;

// Cache role globally to prevent flickering during navigation
let cachedRole: UserRole = null;

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(cachedRole);
  const [loading, setLoading] = useState(cachedRole === null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        cachedRole = null;
        setRole(null);
        setLoading(false);
        return;
      }

      // Skip fetch if we already have the cached role
      if (cachedRole !== null) {
        setRole(cachedRole);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          cachedRole = null;
          setRole(null);
        } else {
          cachedRole = data?.role as UserRole;
          setRole(cachedRole);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        cachedRole = null;
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  return { role, loading, isFreelance: role === 'freelance', isCompany: role === 'company', isFactory: role === 'factory' };
};
