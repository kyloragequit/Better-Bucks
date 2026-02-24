import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppLogo } from "@/components/app-logo";
import { useStoreUrl } from "@/hooks/use-store-url";

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();
  const [location] = useLocation();
  const { storeUrl } = useStoreUrl();

  const isActive = (path: string) => location === path;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-[999]">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl text-foreground cursor-pointer hover:opacity-80 transition-opacity">
            <AppLogo size="sm" />
            <span className="hidden sm:inline">Better Bucks</span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/dashboard') ? "text-primary font-bold" : "text-muted-foreground"}`}
            >
              Dashboard
            </Link>
            <Link
              href="/orders"
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/orders') ? "text-primary font-bold" : "text-muted-foreground"}`}
            >
              Orders
            </Link>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary flex items-center gap-1"
              data-testid="link-promo-store-nav"
            >
              Store <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium hidden md:block text-muted-foreground">
              {user?.fullName}
            </span>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8 animate-in">
        {children}
      </main>
    </div>
  );
}
