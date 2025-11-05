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
import JobDetailPage from "./pages/JobDetailPage";
import PickupDetailPage from "./pages/PickupDetailPage";
import SOPCheckInPage from "./pages/SOPCheckInPage";
import PickupSummaryPage from "./pages/PickupSummaryPage";
import DeliveryDetailPage from "./pages/DeliveryDetailPage";
import DeliverySOPCheckInPage from "./pages/DeliverySOPCheckInPage";
import ContainerCheckInPage from "./pages/ContainerCheckInPage";
import ContainerSOPPage from "./pages/ContainerSOPPage";
import ContainerSummaryPage from "./pages/ContainerSummaryPage";
import AddExpensePage from "./pages/AddExpensePage";
import DashboardPage from "./pages/DashboardPage";
import FinancePage from "./pages/dashboard/FinancePage";
import ShippingPage from "./pages/dashboard/ShippingPage";
import CustomerPage from "./pages/dashboard/CustomerPage";
import ProductPage from "./pages/dashboard/ProductPage";
import BiddingPage from "./pages/BiddingPage";
import PlaceBidPage from "./pages/PlaceBidPage";
import IncomePage from "./pages/IncomePage";
import JobRouteExpensesPage from "./pages/JobRouteExpensesPage";
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
            <Route path="/job/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
          <Route path="/job/:jobId/container-checkin" element={<ProtectedRoute><ContainerCheckInPage /></ProtectedRoute>} />
          <Route path="/job/:jobId/container-sop" element={<ProtectedRoute><ContainerSOPPage /></ProtectedRoute>} />
          <Route path="/job/:jobId/container-summary" element={<ProtectedRoute><ContainerSummaryPage /></ProtectedRoute>} />
          <Route path="/job/:jobId/add-expense" element={<ProtectedRoute><AddExpensePage /></ProtectedRoute>} />
            <Route path="/job/:jobId/pickup" element={<ProtectedRoute><PickupDetailPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/sop" element={<ProtectedRoute><SOPCheckInPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/pickup-summary" element={<ProtectedRoute><PickupSummaryPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/delivery" element={<ProtectedRoute><DeliveryDetailPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/delivery-sop" element={<ProtectedRoute><DeliverySOPCheckInPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
          <Route path="/dashboard/shipping" element={<ProtectedRoute><ShippingPage /></ProtectedRoute>} />
          <Route path="/dashboard/customer" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
          <Route path="/dashboard/product" element={<ProtectedRoute><ProductPage /></ProtectedRoute>} />
          <Route path="/bidding" element={<ProtectedRoute><BiddingPage /></ProtectedRoute>} />
          <Route path="/bidding/:jobId" element={<ProtectedRoute><PlaceBidPage /></ProtectedRoute>} />
          <Route path="/income" element={<ProtectedRoute><IncomePage /></ProtectedRoute>} />
          <Route path="/job/:jobId/route-expenses" element={<ProtectedRoute><JobRouteExpensesPage /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
