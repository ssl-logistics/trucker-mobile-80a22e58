import { lazy, Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Preloadable lazy import helper with auto-reload on stale chunk errors.
// After a deploy, old chunk hashes (e.g. ContainerSummaryPage-XXXX.js) stop existing.
// When a dynamic import fails, force a one-time hard reload to fetch the new index.
function lazyWithPreload<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  const wrapped = () =>
    factory().catch(async (err) => {
      const msg = String(err?.message || err);
      const isChunkError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("Loading chunk");
      if (isChunkError && typeof window !== "undefined") {
        const KEY = "__lovable_chunk_reload__";
        const last = Number(sessionStorage.getItem(KEY) || "0");
        // Avoid infinite reload loop — only reload once per 10s window
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          try {
            if ("caches" in window) {
              const names = await caches.keys();
              await Promise.allSettled(names.map((n) => caches.delete(n)));
            }
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.allSettled(regs.map((r) => r.unregister()));
            }
          } catch {}
          window.location.reload();
          // Return a never-resolving promise so React.lazy doesn't surface the error
          return new Promise(() => {}) as any;
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

// App version badge - position depends on route
function VersionBadge() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  const badge = (
    <div
      className="fixed text-[10px] font-medium text-foreground pointer-events-none select-none"
      style={{
        opacity: 0.55,
        bottom: isLoginPage ? "calc(env(safe-area-inset-bottom, 0px) + 4px)" : undefined,
        top: isLoginPage ? undefined : "calc(env(safe-area-inset-top, 0px) + 4px)",
        right: "8px",
        zIndex: 2147483647,
      }}
    >
      v2.7
    </div>
  );

  return createPortal(badge, document.body);
}

/**
 * iOS/WKWebView can still rubber-band an overflow container despite
 * overscroll-behavior: none. Cancel only a downward pull at the very top;
 * regular vertical scrolling and horizontal swipe-back gestures stay intact.
 */
function PullDownGuard() {
  useEffect(() => {
    const scrollRoot = document.getElementById("root");
    if (!scrollRoot) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || scrollRoot.scrollTop > 0) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const isDownwardPull = deltaY > 4 && deltaY > Math.abs(deltaX);

      if (isDownwardPull && event.cancelable) {
        event.preventDefault();
      }
    };

    scrollRoot.addEventListener("touchstart", handleTouchStart, { passive: true });
    scrollRoot.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      scrollRoot.removeEventListener("touchstart", handleTouchStart);
      scrollRoot.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return null;
}

const jobChildSegments = new Set([
  "container-checkin",
  "container-sop",
  "container-summary",
  "add-expense",
  "expenses",
  "pickup",
  "sop",
  "pickup-summary",
  "delivery",
  "delivery-sop",
  "route-expenses",
]);

function RepairUnencodedJobRoute() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean);

  if (parts[0] === "job" && parts.length > 2) {
    const rest = parts.slice(1);
    const childIndex = rest.findIndex((part, index) => index > 0 && jobChildSegments.has(part));
    const orderParts = childIndex === -1 ? rest : rest.slice(0, childIndex);
    const suffixParts = childIndex === -1 ? [] : rest.slice(childIndex);
    const orderNumber = orderParts.map((part) => decodeURIComponent(part)).join("/");
    const suffix = suffixParts.length > 0 ? `/${suffixParts.join("/")}` : "";
    return (
      <Navigate
        to={`/job/${encodeURIComponent(orderNumber)}${suffix}${location.search}`}
        replace
        state={location.state}
      />
    );
  }

  if (parts[0] === "bid-job" && parts.length > 2) {
    const ticketNumber = parts
      .slice(1)
      .map((part) => decodeURIComponent(part))
      .join("/");
    return (
      <Navigate to={`/bid-job/${encodeURIComponent(ticketNumber)}${location.search}`} replace state={location.state} />
    );
  }

  return <NotFound />;
}
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
const MarketPage = lazyWithPreload(() => import("./pages/MarketPage"));
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
            <PullDownGuard />
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
                      <Route
                        path="/home"
                        element={
                          <ProtectedRoute>
                            <Home />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/search"
                        element={
                          <ProtectedRoute>
                            <SearchPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/chat"
                        element={
                          <ProtectedRoute>
                            <ChatListPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/chat/:conversationId"
                        element={
                          <ProtectedRoute>
                            <ChatRoomPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/language"
                        element={
                          <ProtectedRoute>
                            <LanguagePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/current-jobs"
                        element={
                          <ProtectedRoute>
                            <CurrentJobsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId"
                        element={
                          <ProtectedRoute>
                            <JobDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/container-checkin"
                        element={
                          <ProtectedRoute>
                            <ContainerCheckInPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/container-sop"
                        element={
                          <ProtectedRoute>
                            <ContainerSOPPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/container-summary"
                        element={
                          <ProtectedRoute>
                            <ContainerSummaryPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/add-expense"
                        element={
                          <ProtectedRoute>
                            <AddExpensePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/expenses"
                        element={
                          <ProtectedRoute>
                            <JobExpensesPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/pickup"
                        element={
                          <ProtectedRoute>
                            <PickupDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/sop"
                        element={
                          <ProtectedRoute>
                            <SOPCheckInPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/pickup-summary"
                        element={
                          <ProtectedRoute>
                            <PickupSummaryPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/delivery"
                        element={
                          <ProtectedRoute>
                            <DeliveryDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/delivery/:destinationId"
                        element={
                          <ProtectedRoute>
                            <DeliveryDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/delivery-sop"
                        element={
                          <ProtectedRoute>
                            <DeliverySOPCheckInPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/delivery-sop/:destinationId"
                        element={
                          <ProtectedRoute>
                            <DeliverySOPCheckInPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <DashboardPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/finance"
                        element={
                          <ProtectedRoute>
                            <FinancePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/shipping"
                        element={
                          <ProtectedRoute>
                            <ShippingPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/customer"
                        element={
                          <ProtectedRoute>
                            <CustomerPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/product"
                        element={
                          <ProtectedRoute>
                            <ProductPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/bidding"
                        element={
                          <ProtectedRoute>
                            <BiddingPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/bidding/:jobId"
                        element={
                          <ProtectedRoute>
                            <PlaceBidPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/income"
                        element={
                          <ProtectedRoute>
                            <IncomePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/market"
                        element={
                          <ProtectedRoute>
                            <MarketPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job/:jobId/route-expenses"
                        element={
                          <ProtectedRoute>
                            <JobRouteExpensesPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/job-history"
                        element={
                          <ProtectedRoute>
                            <JobHistoryPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/bid-job/:ticketId"
                        element={
                          <ProtectedRoute>
                            <BidJobDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/notifications"
                        element={
                          <ProtectedRoute>
                            <NotificationsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/notifications/:id"
                        element={
                          <ProtectedRoute>
                            <NotificationDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <SettingsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <ProfilePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/vehicle-info"
                        element={
                          <ProtectedRoute>
                            <ErrorBoundary>
                              <VehicleInfoPage />
                            </ErrorBoundary>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/account"
                        element={
                          <ProtectedRoute>
                            <AccountPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/change-password"
                        element={
                          <ProtectedRoute>
                            <ChangePasswordPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile/edit"
                        element={
                          <ProtectedRoute>
                            <EditFieldPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/edit-vehicle-field"
                        element={
                          <ProtectedRoute>
                            <EditVehicleFieldPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/terms"
                        element={
                          <ProtectedRoute>
                            <TermsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/contact"
                        element={
                          <ProtectedRoute>
                            <ContactPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/report-app-problem"
                        element={
                          <ProtectedRoute>
                            <ReportAppProblemPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/api-test"
                        element={
                          <ProtectedRoute>
                            <ApiTestPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/push-debug" element={<PushDebugPage />} />
                      {/* Download app page temporarily disabled */}
                      {/* <Route path="/download" element={<DownloadAppPage />} /> */}
                      <Route
                        path="/call"
                        element={
                          <ProtectedRoute>
                            <CallPage />
                          </ProtectedRoute>
                        }
                      />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<RepairUnencodedJobRoute />} />
                    </Routes>
                  </Suspense>
                  <VersionBadge />
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
