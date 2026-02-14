import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'freelance' | 'company' | 'factory' | 'internal_driver' | 'external_driver' | null;
export type UserType = 'freelance_driver' | 'internal_driver' | 'external_driver' | 'company' | 'factory' | null;
export type EmployerType = 'factory' | 'company' | null;

export const useUserRole = () => {
  const { role, userType, employerType, loading } = useAuth();
  
  const userRole = role as UserRole;
  const currentUserType = userType as UserType;
  const currentEmployerType = employerType as EmployerType;

  return { 
    role: userRole, 
    userType: currentUserType,
    employerType: currentEmployerType,
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
    // Only freelance drivers can view job prices
    canViewPrice: currentUserType === 'freelance_driver',
  };
};
