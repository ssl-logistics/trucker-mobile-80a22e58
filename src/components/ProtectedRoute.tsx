import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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
