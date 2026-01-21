import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'freelance' | 'company' | 'factory' | 'internal_driver' | 'external_driver' | null;

export const useUserRole = () => {
  const { role, loading } = useAuth();
  
  const userRole = role as UserRole;

  return { 
    role: userRole, 
    loading, 
    isFreelance: userRole === 'freelance', 
    isCompany: userRole === 'company', 
    isFactory: userRole === 'factory',
    isInternalDriver: userRole === 'internal_driver',
    isExternalDriver: userRole === 'external_driver',
    // Freelance only features: Dashboard, Bidding
    canAccessDashboard: userRole === 'freelance',
    canAccessBidding: userRole === 'freelance',
  };
};
