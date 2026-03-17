import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { FullPageLoader } from "@/components/ui/loader";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { TutorialModal } from "@/components/tutorial-modal";
import { FullTutorialOverlay } from "@/components/full-tutorial";
import { TermsAgreementModal } from "@/components/terms-agreement-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, XCircle, Coins } from "lucide-react";
import type { GoalNotification } from "@shared/schema";

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
const AdminAccountSettingsPage = lazy(() => import("@/pages/admin-account-settings"));
const AdminStorePage = lazy(() => import("@/pages/admin-store"));
const AdminGoalsPage = lazy(() => import("@/pages/admin-goals"));
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
const TermsPage = lazy(() => import("@/pages/terms"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const DemoEntryPage = lazy(() => import("@/pages/demo-entry"));
const NotFound = lazy(() => import("@/pages/not-found"));

function GoalNotificationModal() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  const { data: notifications = [] } = useQuery<GoalNotification[]>({
    queryKey: ["/api/goals/notifications"],
    enabled: !!user && (user.role === "employee" || user.role === "admin" || user.role === "prime_admin"),
    gcTime: 0,
  });

  useEffect(() => {
    if (!shown && notifications.length > 0) {
      setOpen(true);
      setShown(true);
    }
  }, [notifications, shown]);

  const seenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/goals/notifications/seen", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/goals/notifications"] });
    },
  });

  function handleDismiss() {
    seenMutation.mutate();
    setOpen(false);
  }

  const distributed = notifications.filter(n => n.type === "distributed");
  const failed = notifications.filter(n => n.type === "failed");

  if (!open || notifications.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md" data-testid="goal-notification-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {failed.length > 0 && distributed.length === 0
              ? <><XCircle className="h-5 w-5 text-destructive" /> Goal Update</>
              : <><Trophy className="h-5 w-5 text-yellow-500" /> Goal Update</>
            }
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {distributed.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3" data-testid={`notification-distributed-${n.goalId}`}>
              <Coins className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Goal achieved — Bucks awarded!</p>
                <p className="text-xs text-green-700 mt-0.5">Your team met a goal and your Bucks have been added to your balance.</p>
              </div>
            </div>
          ))}
          {failed.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3" data-testid={`notification-failed-${n.goalId}`}>
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">A goal was not met</p>
                <p className="text-xs text-red-700 mt-0.5">Your team did not reach a goal in time. Keep it up — new goals may be on the way!</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleDismiss} data-testid="button-dismiss-goal-notifications">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
    // If a demo visitor's session expired, send them back to /demo to restart
    try {
      if (sessionStorage.getItem("bb_demo_visitor") === "1") return <Redirect to="/demo" />;
    } catch {}
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
        <Route path="/" component={HowItWorksPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/how-it-works" component={HowItWorksPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/demo" component={DemoEntryPage} />
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
        <Route path="/admin/goals">
          <ProtectedRoute component={AdminGoalsPage} adminOnly />
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute component={AdminSettingsPage} adminOnly />
        </Route>
        <Route path="/admin/account-settings">
          <ProtectedRoute component={AdminAccountSettingsPage} adminOnly />
        </Route>
        <Route path="/verify-email">
          <VerifyEmailRoute />
        </Route>
        <Route path="/pending-verification" component={PendingVerification} />
        <Route path="/change-password" component={ChangePasswordPage} />
        
        <Route path="/blog" component={BlogPage} />
        <Route path="/blog/:slug" component={BlogPostPage} />

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
        <TutorialModal />
        <FullTutorialOverlay />
        <TermsAgreementModal />
        <GoalNotificationModal />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
