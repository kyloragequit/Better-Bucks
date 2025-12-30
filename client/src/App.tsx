import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { FullPageLoader } from "@/components/ui/loader";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import EmployeeDashboard from "@/pages/employee-dashboard";
import AdminEmployeesPage from "@/pages/admin-employees";
import AdminEmployeeDetailPage from "@/pages/admin-employee-detail";
import AdminPendingPage from "@/pages/admin-pending";

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

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/dashboard" />;
  }

  // If user is admin but tries to access employee dashboard, send them to admin home
  if (!adminOnly && user.role === 'admin' && window.location.pathname === '/dashboard') {
     return <Redirect to="/admin/employees" />;
  }

  return <Component />;
}

function RootRedirect() {
  const { data: user, isLoading } = useUser();
  if (isLoading) return <FullPageLoader />;
  if (!user) return <Redirect to="/login" />;
  return user.role === 'admin' 
    ? <Redirect to="/admin/employees" /> 
    : <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      {/* Employee Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={EmployeeDashboard} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/employees">
        <ProtectedRoute component={AdminEmployeesPage} adminOnly />
      </Route>
      <Route path="/admin/employees/:id">
        <ProtectedRoute component={AdminEmployeeDetailPage} adminOnly />
      </Route>
      <Route path="/admin/pending">
        <ProtectedRoute component={AdminPendingPage} adminOnly />
      </Route>

      {/* Root Redirect */}
      <Route path="/" component={RootRedirect} />

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
