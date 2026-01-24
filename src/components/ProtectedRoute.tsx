import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Don't show loading spinner here - let page components handle their own loading
  // This prevents duplicate loading spinners from Suspense + ProtectedRoute + Page
  if (loading) {
    return null; // Let Suspense fallback handle initial loading
  }

  if (!user) {
    // Store the intended destination so we can redirect back after login
    const intendedPath = location.pathname + location.search + location.hash;
    if (intendedPath && intendedPath !== '/' && intendedPath !== '/home') {
      sessionStorage.setItem('auth_redirect_after_login', intendedPath);
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
