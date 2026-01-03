import { Link, useLocation } from "wouter";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Users, LogOut, LayoutDashboard } from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();

  const isActive = (path: string) => location === path || location.startsWith(`${path}/`);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Sidebar / Top Nav Hybrid for Responsiveness */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-display font-bold text-xl text-primary">
            <LayoutDashboard className="h-6 w-6" />
            <span>Admin Portal</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/admin/employees" 
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive('/admin/employees') ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              Employees
            </Link>
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
