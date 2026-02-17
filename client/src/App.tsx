import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { FullPageLoader } from "@/components/ui/loader";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import SignupPage from "@/pages/signup";
import SignupSuccessPage from "@/pages/signup-success";
import SetupPrimePage from "@/pages/setup-prime";
import LoginPage from "@/pages/login";
import EmployeeDashboard from "@/pages/employee-dashboard";
import EmployeeOrdersPage from "@/pages/employee-orders";
import AdminEmployeesPage from "@/pages/admin-employees";
import AdminEmployeeDetailPage from "@/pages/admin-employee-detail";
import AdminOrdersPage from "@/pages/admin-orders";
import AdminPendingPage from "@/pages/admin-pending";
import PendingVerification from "@/pages/pending-verification";
import ChangePasswordPage from "@/pages/change-password";

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

  if (user.role === 'admin' && user.status === 'pending' && window.location.pathname !== '/pending-verification') {
    return <Redirect to="/pending-verification" />;
  }

  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Redirect to="/change-password" />;
  }

  if (adminOnly && user.role !== 'admin' && user.role !== 'prime_admin') {
    return <Redirect to="/dashboard" />;
  }

  if (!adminOnly && (user.role === 'admin' || user.role === 'prime_admin') && window.location.pathname === '/dashboard') {
     return <Redirect to="/admin/employees" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/signup/success" component={SignupSuccessPage} />
      <Route path="/setup" component={SetupPrimePage} />
      <Route path="/login" component={LoginPage} />
      
      <Route path="/dashboard">
        <ProtectedRoute component={EmployeeDashboard} />
      </Route>
      <Route path="/orders">
        <ProtectedRoute component={EmployeeOrdersPage} />
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
      <Route path="/pending-verification" component={PendingVerification} />
      <Route path="/change-password" component={ChangePasswordPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
