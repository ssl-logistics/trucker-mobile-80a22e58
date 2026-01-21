import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SignIn from "@/pages/SignIn";

const StartPage = () => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    const to = role === "company" || role === "factory" || role === "internal_driver" || role === "external_driver" ? "/dashboard" : "/home";
    return <Navigate to={to} replace />;
  }

  return <SignIn />;
};

export default StartPage;
