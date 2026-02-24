import { Link, useLocation } from "wouter";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, ArrowLeft, Code2, FileText, Zap } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function ImpersonationBanner() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: impersonating } = useQuery<{ impersonating: boolean }>({
    queryKey: ["/api/developer/status"],
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/developer/return", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to return");
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/developer/dashboard";
    },
  });

  if (!impersonating?.impersonating) return null;

  return (
    <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <Code2 className="h-4 w-4 text-secondary" />
      <span>Developer Mode: Viewing as prime admin</span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800 text-xs"
        onClick={() => returnMutation.mutate()}
        disabled={returnMutation.isPending}
        data-testid="button-return-developer"
      >
        <ArrowLeft className="mr-1 h-3 w-3" />
        Return to Developer
      </Button>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();
  const { data: devStatus } = useQuery<{ impersonating: boolean }>({
    queryKey: ["/api/developer/status"],
  });
  const isImpersonating = devStatus?.impersonating === true;

  const isActive = (path: string) => location === path || location.startsWith(`${path}/`);

  return (
    <div className="min-h-screen bg-muted/20">
      <ImpersonationBanner />
      <header className="sticky top-0 z-[999] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground">
            <AppLogo size="sm" />
            <span className="hidden sm:inline">Better Bucks</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/admin/dashboard"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/admin/dashboard') ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/employees"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/admin/employees') ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              Employees
            </Link>
            <Link
              href="/admin/orders"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/admin/orders') ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              Orders
            </Link>
            <Link
              href="/admin/instant-transaction"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/admin/instant-transaction') ? "text-primary font-bold" : "text-muted-foreground"
              }`}
              data-testid="link-instant-transaction"
            >
              <span className="hidden lg:inline">Instant Transaction</span>
              <span className="lg:hidden">Quick TX</span>
            </Link>
            {!isImpersonating && (
              <Link
                href="/admin/documents"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/admin/documents') ? "text-primary font-bold" : "text-muted-foreground"
                }`}
                data-testid="link-admin-documents"
              >
                Documents
              </Link>
            )}
            {user?.role === "prime_admin" && (
              <Link
                href="/admin/pending"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/admin/pending') ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                Pending Approvals
              </Link>
            )}
            {user?.role === "prime_admin" && (
              <Link
                href="/admin/settings"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/admin/settings') ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                Settings
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-block text-sm text-muted-foreground">
              Hello, {user?.fullName}
            </span>
            <Button variant="ghost" size="icon" onClick={() => logout()}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 animate-in">
        {children}
      </main>
    </div>
  );
}
