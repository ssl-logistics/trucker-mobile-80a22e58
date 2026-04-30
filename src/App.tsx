import { lazy, Suspense } from "react";
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
import { ProtectedRoute } from "./components/ProtectedRoute";
import { FloatingChatbot } from "@/components/chatbot/FloatingChatbot";
import { GlobalProximityAlert } from "@/components/GlobalProximityAlert";
import { CallProvider } from "@/components/call/CallProvider";
import { Loader2 } from "lucide-react";

// Preloadable lazy import helper with auto-reload on stale chunk errors.
// After a deploy, old chunk hashes (e.g. ContainerSummaryPage-XXXX.js) stop existing.
// When a dynamic import fails, force a one-time hard reload to fetch the new index.
function lazyWithPreload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const wrapped = () =>
    factory().catch((err) => {
      const msg = String(err?.message || err);
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module');
      if (isChunkError && typeof window !== 'undefined') {
        const KEY = '__lovable_chunk_reload__';
        const last = Number(sessionStorage.getItem(KEY) || '0');
        // Avoid infinite reload loop — only reload once per 10s window
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      }
      throw err;
    });
  const Component = lazy(wrapped) as React.LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> };
  Component.preload = wrapped;
  return Component;
}

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Lazy load all pages with preload capability
const StartPage = lazyWithPreload(() => import("./pages/StartPage"));
const Register = lazyWithPreload(() => import("./pages/Register"));
const ForgotPassword = lazyWithPreload(() => import("./pages/ForgotPassword"));
const CreateNewPassword = lazyWithPreload(() => import("./pages/CreateNewPassword"));
const Home = lazyWithPreload(() => import("./pages/Home"));
const ChatListPage = lazyWithPreload(() => import("./pages/ChatListPage"));
const ChatRoomPage = lazyWithPreload(() => import("./pages/ChatRoomPage"));
const LanguagePage = lazyWithPreload(() => import("./pages/LanguagePage"));
const CurrentJobsPage = lazyWithPreload(() => import("./pages/CurrentJobsPage"));
const JobDetailPage = lazyWithPreload(() => import("./pages/JobDetailPage"));
const PickupDetailPage = lazyWithPreload(() => import("./pages/PickupDetailPage"));
const SOPCheckInPage = lazyWithPreload(() => import("./pages/SOPCheckInPage"));
const PickupSummaryPage = lazyWithPreload(() => import("./pages/PickupSummaryPage"));
const DeliveryDetailPage = lazyWithPreload(() => import("./pages/DeliveryDetailPage"));
const DeliverySOPCheckInPage = lazyWithPreload(() => import("./pages/DeliverySOPCheckInPage"));
const ContainerCheckInPage = lazyWithPreload(() => import("./pages/ContainerCheckInPage"));
const ContainerSOPPage = lazyWithPreload(() => import("./pages/ContainerSOPPage"));
const ContainerSummaryPage = lazyWithPreload(() => import("./pages/ContainerSummaryPage"));
const AddExpensePage = lazyWithPreload(() => import("./pages/AddExpensePage"));
const DashboardPage = lazyWithPreload(() => import("./pages/DashboardPage"));
const FinancePage = lazyWithPreload(() => import("./pages/dashboard/FinancePage"));
const ShippingPage = lazyWithPreload(() => import("./pages/dashboard/ShippingPage"));
const CustomerPage = lazyWithPreload(() => import("./pages/dashboard/CustomerPage"));
const ProductPage = lazyWithPreload(() => import("./pages/dashboard/ProductPage"));
const BiddingPage = lazyWithPreload(() => import("./pages/BiddingPage"));
const PlaceBidPage = lazyWithPreload(() => import("./pages/PlaceBidPage"));
const IncomePage = lazyWithPreload(() => import("./pages/IncomePage"));
const JobRouteExpensesPage = lazyWithPreload(() => import("./pages/JobRouteExpensesPage"));
const JobExpensesPage = lazyWithPreload(() => import("./pages/JobExpensesPage"));
const JobHistoryPage = lazyWithPreload(() => import("./pages/JobHistoryPage"));
const NotificationsPage = lazyWithPreload(() => import("./pages/NotificationsPage"));
const NotificationDetailPage = lazyWithPreload(() => import("./pages/NotificationDetailPage"));
const SettingsPage = lazyWithPreload(() => import("./pages/SettingsPage"));
const ProfilePage = lazyWithPreload(() => import("./pages/ProfilePage"));
const VehicleInfoPage = lazyWithPreload(() => import("./pages/VehicleInfoPage"));
const AccountPage = lazyWithPreload(() => import("./pages/AccountPage"));
const ChangePasswordPage = lazyWithPreload(() => import("./pages/ChangePasswordPage"));
const EditFieldPage = lazyWithPreload(() => import("./pages/EditFieldPage"));
const EditVehicleFieldPage = lazyWithPreload(() => import("./pages/EditVehicleFieldPage"));
const TermsPage = lazyWithPreload(() => import("./pages/TermsPage"));
const ContactPage = lazyWithPreload(() => import("./pages/ContactPage"));
const NotFound = lazyWithPreload(() => import("./pages/NotFound"));
const SearchPage = lazyWithPreload(() => import("./pages/SearchPage"));
const ApiTestPage = lazyWithPreload(() => import("./pages/ApiTestPage"));
const LineCallbackPage = lazyWithPreload(() => import("./pages/LineCallbackPage"));
const PushDebugPage = lazyWithPreload(() => import("./pages/PushDebugPage"));
const BidJobDetailPage = lazyWithPreload(() => import("./pages/BidJobDetailPage"));
const DownloadAppPage = lazyWithPreload(() => import("./pages/DownloadAppPage"));
const ReportAppProblemPage = lazyWithPreload(() => import("./pages/ReportAppProblemPage"));
const CallPage = lazyWithPreload(() => import("./pages/CallPage"));

// Export pages for preloading from other components
export const preloadablePages = {
  StartPage,
  Register,
  ForgotPassword,
  CreateNewPassword,
  Home,
  ChatListPage,
  ChatRoomPage,
  LanguagePage,
  CurrentJobsPage,
  JobDetailPage,
  PickupDetailPage,
  SOPCheckInPage,
  PickupSummaryPage,
  DeliveryDetailPage,
  DeliverySOPCheckInPage,
  ContainerCheckInPage,
  ContainerSOPPage,
  ContainerSummaryPage,
  AddExpensePage,
  DashboardPage,
  FinancePage,
  ShippingPage,
  CustomerPage,
  ProductPage,
  BiddingPage,
  PlaceBidPage,
  IncomePage,
  JobRouteExpensesPage,
  JobExpensesPage,
  JobHistoryPage,
  NotificationsPage,
  NotificationDetailPage,
  SettingsPage,
  ProfilePage,
  VehicleInfoPage,
  AccountPage,
  ChangePasswordPage,
  EditFieldPage,
  EditVehicleFieldPage,
  TermsPage,
  ContactPage,
  NotFound,
  SearchPage,
  ApiTestPage,
  LineCallbackPage,
  PushDebugPage,
};

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
              <CallProvider>
              <DeepLinkListener />
              <div className="min-h-screen">
                <PushNotificationPrompt />
                <GlobalProximityAlert />
                <FloatingChatbot />
                <Suspense fallback={<PageLoader />}>
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
                    <Route path="/bid-job/:ticketId" element={<ProtectedRoute><BidJobDetailPage /></ProtectedRoute>} />
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
                    <Route path="/report-app-problem" element={<ProtectedRoute><ReportAppProblemPage /></ProtectedRoute>} />
                    <Route path="/api-test" element={<ProtectedRoute><ApiTestPage /></ProtectedRoute>} />
                    <Route path="/push-debug" element={<PushDebugPage />} />
                    <Route path="/download" element={<DownloadAppPage />} />
                    <Route path="/call" element={<ProtectedRoute><CallPage /></ProtectedRoute>} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </div>
              </CallProvider>
            </SwipeBackProvider>
          </HashRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
