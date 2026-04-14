import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLogo } from "@/components/app-logo";
import { FullPageLoader } from "@/components/ui/loader";

export default function DemoPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function startDemo() {
      try {
        const res = await fetch("/api/demo/public-login", { method: "POST", credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.message || "Failed to start demo");
        try { sessionStorage.setItem("bb_demo_visitor", "1"); } catch {}
        const [userRes, demoRes] = await Promise.all([
          fetch("/api/user", { credentials: "include" }),
          fetch("/api/demo/status", { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (userRes.ok) {
          queryClient.setQueryData(["/api/user"], await userRes.json());
        }
        if (demoRes.ok) {
          queryClient.setQueryData(["/api/demo/status"], await demoRes.json());
        }
        const role = data.role;
        if (role === "employee") {
          setLocation("/dashboard");
        } else {
          setLocation("/admin/dashboard");
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Something went wrong. Please try again.");
      }
    }

    startDemo();
    return () => { cancelled = true; };
  }, [setLocation, queryClient]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white px-4">
        <AppLogo size="lg" />
        <p className="text-red-600 text-sm font-medium">{error}</p>
        <button
          className="text-sm underline text-gray-500 hover:text-gray-700"
          onClick={() => setLocation("/")}
        >
          Return to home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
      <AppLogo size="lg" />
      <p className="text-sm text-gray-500 mt-4">Loading demo…</p>
      <FullPageLoader />
    </div>
  );
}
