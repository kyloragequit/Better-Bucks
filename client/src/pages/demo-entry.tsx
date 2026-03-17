import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLogo } from "@/components/app-logo";

const DEMO_VISITOR_KEY = "bb_demo_visitor";

export function markDemoVisitor() {
  try { sessionStorage.setItem(DEMO_VISITOR_KEY, "1"); } catch {}
}
export function isDemoVisitor() {
  try { return sessionStorage.getItem(DEMO_VISITOR_KEY) === "1"; } catch { return false; }
}
export function clearDemoVisitor() {
  try { sessionStorage.removeItem(DEMO_VISITOR_KEY); } catch {}
}

export default function DemoEntryPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function startDemo() {
      try {
        const res = await fetch("/api/demo/public-login", {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Could not start demo");
        if (data.userId) {
          localStorage.removeItem(`bb_tutorial_type_${data.userId}`);
          localStorage.setItem(`bb_tutorial_type_${data.userId}`, "full");
        }
        markDemoVisitor();
        // Invalidate the user cache so ProtectedRoute re-fetches the now-authenticated user
        // instead of reading the stale unauthenticated cache (which would cause a redirect loop)
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        setLocation("/admin/dashboard");
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
      }
    }

    startDemo();
  }, [setLocation, queryClient]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#0a1a2e] px-4">
        <AppLogo size="md" />
        <p className="text-white/70 text-base text-center max-w-sm">{error}</p>
        <button
          onClick={() => { setError(null); started.current = false; }}
          className="px-6 py-2 rounded-lg font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#0a1a2e]">
      <AppLogo size="md" />
      <div className="flex items-center gap-3 text-white/70">
        <svg className="animate-spin h-5 w-5 text-white/50" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-base">Setting up your demo&hellip;</span>
      </div>
    </div>
  );
}
