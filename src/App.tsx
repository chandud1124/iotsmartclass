
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Layout } from "@/components/Layout";
import { PrivateRoute } from "./components/PrivateRoute";
import { GlobalLoadingProvider } from '@/hooks/useGlobalLoading';
import { GlobalLoadingOverlay } from '@/components/GlobalLoadingOverlay';
import { DevicesProvider } from '@/hooks/useDevices';

// Lazy load components for better performance
const Index = lazy(() => import("./pages/Index"));
const Devices = lazy(() => import("./pages/Devices"));
const Switches = lazy(() => import("./pages/Switches"));
const Master = lazy(() => import("./pages/Master"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Register = lazy(() => import("./pages/Register"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile").then(module => ({ default: module.Profile })));
const PermissionManagement = lazy(() => import("./pages/PermissionManagement"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const ClassroomAccessPage = lazy(() => import("./pages/ClassroomAccessPage"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoadingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:resetToken" element={<ResetPassword />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <DevicesProvider>
                        <Layout />
                      </DevicesProvider>
                    </PrivateRoute>
                  }
                >
                  <Route index element={<Index />} />
                  <Route path="devices" element={<Devices />} />
                  <Route path="switches" element={<Switches />} />
                  <Route path="master" element={<Master />} />
                  <Route path="schedule" element={<Schedule />} />
                  <Route path="users" element={<Users />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="permissions" element={<PermissionManagement />} />
                  <Route path="roles" element={<RoleManagement />} />
                  <Route path="classroom-access" element={<ClassroomAccessPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <GlobalLoadingOverlay />
        </TooltipProvider>
      </GlobalLoadingProvider>
    </QueryClientProvider>
  );
};

export default App;
