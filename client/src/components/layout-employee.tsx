import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Ticket } from "lucide-react";
import { Link } from "wouter";

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl text-primary cursor-pointer hover:opacity-80 transition-opacity">
            <Ticket className="h-6 w-6" />
            <span>My Incentives</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium hidden sm:block text-muted-foreground">
              {user?.fullName}
            </span>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground hover:text-destructive">
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
