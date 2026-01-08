import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'freelance' | 'company' | 'factory' | null;

export const useUserRole = () => {
  const { role, loading } = useAuth();
  
  const userRole = role as UserRole;

  return { 
    role: userRole, 
    loading, 
    isFreelance: userRole === 'freelance', 
    isCompany: userRole === 'company', 
    isFactory: userRole === 'factory' 
  };
};
