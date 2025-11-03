import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SignIn from "./pages/SignIn";
import Register from "./pages/Register";
import VerifyOTP from "./pages/VerifyOTP";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOTPReset from "./pages/VerifyOTPReset";
import CreateNewPassword from "./pages/CreateNewPassword";
import Home from "./pages/Home";
import SearchPage from "./pages/SearchPage";
import CurrentJobsPage from "./pages/CurrentJobsPage";
import DashboardPage from "./pages/DashboardPage";
import FinancePage from "./pages/dashboard/FinancePage";
import ShippingPage from "./pages/dashboard/ShippingPage";
import CustomerPage from "./pages/dashboard/CustomerPage";
import ProductPage from "./pages/dashboard/ProductPage";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp-reset" element={<VerifyOTPReset />} />
          <Route path="/create-new-password" element={<CreateNewPassword />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/current-jobs" element={<ProtectedRoute><CurrentJobsPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
          <Route path="/dashboard/shipping" element={<ProtectedRoute><ShippingPage /></ProtectedRoute>} />
          <Route path="/dashboard/customer" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
          <Route path="/dashboard/product" element={<ProtectedRoute><ProductPage /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
