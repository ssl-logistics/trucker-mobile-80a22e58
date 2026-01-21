import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'freelance' | 'company' | 'factory' | 'internal_driver' | 'external_driver' | null;
export type UserType = 'freelance_driver' | 'internal_driver' | 'external_driver' | 'company' | 'factory' | null;

export const useUserRole = () => {
  const { role, userType, loading } = useAuth();
  
  const userRole = role as UserRole;
  const currentUserType = userType as UserType;

  return { 
    role: userRole, 
    userType: currentUserType,
    loading, 
    isFreelance: userRole === 'freelance', 
    isCompany: userRole === 'company', 
    isFactory: userRole === 'factory',
    isInternalDriver: currentUserType === 'internal_driver',
    isExternalDriver: currentUserType === 'external_driver',
    isFreelanceDriver: currentUserType === 'freelance_driver',
    // Feature access based on userType (not role)
    // Only freelance_driver can access Dashboard and Bidding
    canAccessDashboard: currentUserType === 'freelance_driver',
    canAccessBidding: currentUserType === 'freelance_driver',
  };
};
