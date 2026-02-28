import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { FullPageLoader } from "@/components/ui/loader";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";

const LandingPage = lazy(() => import("@/pages/landing"));
const SignupPage = lazy(() => import("@/pages/signup"));
const SignupSuccessPage = lazy(() => import("@/pages/signup-success"));
const ReactivatePage = lazy(() => import("@/pages/reactivate"));
const SetupPrimePage = lazy(() => import("@/pages/setup-prime"));
const LoginPage = lazy(() => import("@/pages/login"));
const EmployeeDashboard = lazy(() => import("@/pages/employee-dashboard"));
const EmployeeOrdersPage = lazy(() => import("@/pages/employee-orders"));
const EmployeeStorePage = lazy(() => import("@/pages/employee-store"));
const AdminDashboardPage = lazy(() => import("@/pages/admin-dashboard"));
const AdminEmployeesPage = lazy(() => import("@/pages/admin-employees"));
const AdminEmployeeDetailPage = lazy(() => import("@/pages/admin-employee-detail"));
const AdminOrdersPage = lazy(() => import("@/pages/admin-orders"));
const AdminPendingPage = lazy(() => import("@/pages/admin-pending"));
const AdminSettingsPage = lazy(() => import("@/pages/admin-settings"));
const AdminStorePage = lazy(() => import("@/pages/admin-store"));
const PendingVerification = lazy(() => import("@/pages/pending-verification"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const DeveloperLoginPage = lazy(() => import("@/pages/developer-login"));
const DeveloperDashboardPage = lazy(() => import("@/pages/developer-dashboard"));
const AdminInstantTransactionPage = lazy(() => import("@/pages/admin-instant-transaction"));
const EmployeeSettingsPage = lazy(() => import("@/pages/employee-settings"));
const AboutPage = lazy(() => import("@/pages/about"));
const HowItWorksPage = lazy(() => import("@/pages/how-it-works"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const NotFound = lazy(() => import("@/pages/not-found"));

function ProtectedRoute({ 
  component: Component, 
  adminOnly = false 
}: { 
  component: React.ComponentType, 
  adminOnly?: boolean 
}) {
  const { data: user, isLoading } = useUser();

  if (isLoading) return <FullPageLoader />;

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role === 'developer') {
    return <Redirect to="/developer/dashboard" />;
  }

  if (user.role === 'admin' && user.status === 'pending' && window.location.pathname !== '/pending-verification') {
    return <Redirect to="/pending-verification" />;
  }

  if (!user.emailVerified && (user.email || user.phone) && window.location.pathname !== '/verify-email') {
    return <Redirect to="/verify-email" />;
  }

  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Redirect to="/change-password" />;
  }

  if (adminOnly && user.role !== 'admin' && user.role !== 'prime_admin') {
    return <Redirect to="/dashboard" />;
  }

  if (!adminOnly && (user.role === 'admin' || user.role === 'prime_admin') && window.location.pathname === '/dashboard') {
     return <Redirect to="/admin/dashboard" />;
  }

  return <Component />;
}

function VerifyEmailRoute() {
  const { data: user, isLoading } = useUser();
  if (isLoading) return <FullPageLoader />;
  if (!user) return <Redirect to="/login" />;
  if (user.emailVerified) {
    if (user.role === "employee") return <Redirect to="/dashboard" />;
    return <Redirect to="/admin/dashboard" />;
  }
  return <VerifyEmailPage user={user} />;
}

function Router() {
  useAnalytics();

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/how-it-works" component={HowItWorksPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/signup/success" component={SignupSuccessPage} />
        <Route path="/reactivate" component={ReactivatePage} />
        <Route path="/setup" component={SetupPrimePage} />
        <Route path="/login" component={LoginPage} />
        
        <Route path="/dashboard">
          <ProtectedRoute component={EmployeeDashboard} />
        </Route>
        <Route path="/orders">
          <ProtectedRoute component={EmployeeOrdersPage} />
        </Route>
        <Route path="/store">
          <ProtectedRoute component={EmployeeStorePage} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={EmployeeSettingsPage} />
        </Route>

        <Route path="/admin/dashboard">
          <ProtectedRoute component={AdminDashboardPage} adminOnly />
        </Route>
        <Route path="/admin/employees">
          <ProtectedRoute component={AdminEmployeesPage} adminOnly />
        </Route>
        <Route path="/admin/employees/:id">
          <ProtectedRoute component={AdminEmployeeDetailPage} adminOnly />
        </Route>
        <Route path="/admin/orders">
          <ProtectedRoute component={AdminOrdersPage} adminOnly />
        </Route>
        <Route path="/admin/pending">
          <ProtectedRoute component={AdminPendingPage} adminOnly />
        </Route>
        <Route path="/admin/instant-transaction">
          <ProtectedRoute component={AdminInstantTransactionPage} adminOnly />
        </Route>
        <Route path="/admin/store">
          <ProtectedRoute component={AdminStorePage} adminOnly />
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute component={AdminSettingsPage} adminOnly />
        </Route>
        <Route path="/verify-email">
          <VerifyEmailRoute />
        </Route>
        <Route path="/pending-verification" component={PendingVerification} />
        <Route path="/change-password" component={ChangePasswordPage} />
        
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />

        <Route path="/developer" component={DeveloperLoginPage} />
        <Route path="/developer/dashboard" component={DeveloperDashboardPage} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn("Google Analytics: VITE_GA_MEASUREMENT_ID is not configured.");
    } else {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
