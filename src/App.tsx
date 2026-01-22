import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";
import { SwipeBackProvider } from "@/components/layout/SwipeBackProvider";
import { DeepLinkListener } from "@/components/DeepLinkListener";

import StartPage from "./pages/StartPage";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import CreateNewPassword from "./pages/CreateNewPassword";
import Home from "./pages/Home";
import ChatListPage from "./pages/ChatListPage";
import ChatRoomPage from "./pages/ChatRoomPage";
import LanguagePage from "./pages/LanguagePage";
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
import JobExpensesPage from "./pages/JobExpensesPage";
import JobHistoryPage from "./pages/JobHistoryPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotificationDetailPage from "./pages/NotificationDetailPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import VehicleInfoPage from "./pages/VehicleInfoPage";
import AccountPage from "./pages/AccountPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import EditFieldPage from "./pages/EditFieldPage";
import EditVehicleFieldPage from "./pages/EditVehicleFieldPage";
import TermsPage from "./pages/TermsPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";
import SearchPage from "./pages/SearchPage";
import ApiTestPage from "./pages/ApiTestPage";
import LineCallbackPage from "./pages/LineCallbackPage";
import PushDebugPage from "./pages/PushDebugPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              <SwipeBackProvider>
              <DeepLinkListener />
              <div className="min-h-screen">
              
              <PushNotificationPrompt />
              <Routes>
            <Route path="/" element={<StartPage />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/create-new-password" element={<CreateNewPassword />} />
            <Route path="/auth/line/callback" element={<LineCallbackPage />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatListPage /></ProtectedRoute>} />
              <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />
              <Route path="/language" element={<ProtectedRoute><LanguagePage /></ProtectedRoute>} />
            <Route path="/current-jobs" element={<ProtectedRoute><CurrentJobsPage /></ProtectedRoute>} />
              <Route path="/job/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/container-checkin" element={<ProtectedRoute><ContainerCheckInPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/container-sop" element={<ProtectedRoute><ContainerSOPPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/container-summary" element={<ProtectedRoute><ContainerSummaryPage /></ProtectedRoute>} />
            <Route path="/job/:jobId/add-expense" element={<ProtectedRoute><AddExpensePage /></ProtectedRoute>} />
            <Route path="/job/:jobId/expenses" element={<ProtectedRoute><JobExpensesPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/pickup" element={<ProtectedRoute><PickupDetailPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/sop" element={<ProtectedRoute><SOPCheckInPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/pickup-summary" element={<ProtectedRoute><PickupSummaryPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/delivery" element={<ProtectedRoute><DeliveryDetailPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/delivery/:destinationId" element={<ProtectedRoute><DeliveryDetailPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/delivery-sop" element={<ProtectedRoute><DeliverySOPCheckInPage /></ProtectedRoute>} />
              <Route path="/job/:jobId/delivery-sop/:destinationId" element={<ProtectedRoute><DeliverySOPCheckInPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
            <Route path="/dashboard/shipping" element={<ProtectedRoute><ShippingPage /></ProtectedRoute>} />
            <Route path="/dashboard/customer" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
            <Route path="/dashboard/product" element={<ProtectedRoute><ProductPage /></ProtectedRoute>} />
            <Route path="/bidding" element={<ProtectedRoute><BiddingPage /></ProtectedRoute>} />
            <Route path="/bidding/:jobId" element={<ProtectedRoute><PlaceBidPage /></ProtectedRoute>} />
            <Route path="/income" element={<ProtectedRoute><IncomePage /></ProtectedRoute>} />
            <Route path="/job/:jobId/route-expenses" element={<ProtectedRoute><JobRouteExpensesPage /></ProtectedRoute>} />
            <Route path="/job-history" element={<ProtectedRoute><JobHistoryPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/notifications/:id" element={<ProtectedRoute><NotificationDetailPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/vehicle-info" element={<ProtectedRoute><VehicleInfoPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><EditFieldPage /></ProtectedRoute>} />
          <Route path="/edit-vehicle-field" element={<ProtectedRoute><EditVehicleFieldPage /></ProtectedRoute>} />
          <Route path="/terms" element={<ProtectedRoute><TermsPage /></ProtectedRoute>} />
          <Route path="/contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
          <Route path="/api-test" element={<ProtectedRoute><ApiTestPage /></ProtectedRoute>} />
          <Route path="/push-debug" element={<PushDebugPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
              </div>
              </SwipeBackProvider>
        </HashRouter>
      </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
