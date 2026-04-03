import { useState, useEffect, useRef } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";

export function TurnstileWidget({ onToken, onExpire }: { onToken: (t: string) => void; onExpire: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

    function renderWidget() {
      if (!containerRef.current || !(window as any).turnstile) return;
      try {
        (window as any).turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onToken,
          "expired-callback": onExpire,
          "error-callback": onExpire,
          theme: "light",
        });
      } catch (e) {
        console.error("Turnstile render error:", e);
      }
    }

    if ((window as any).turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById("cf-turnstile-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", renderWidget);
      }
    }

    return () => {
      if (containerRef.current && (window as any).turnstile) {
        try { (window as any).turnstile.remove(containerRef.current); } catch {}
      }
    };
  }, []);

  return <div ref={containerRef} className="flex justify-center" data-testid="widget-turnstile" />;
}

export function TurnstileStep({
  error,
  onSubmit,
  onBack,
  isPending,
  dark = false,
}: {
  error?: string;
  onSubmit: (token: string) => void;
  onBack: () => void;
  isPending: boolean;
  dark?: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${dark ? "bg-primary/20" : "bg-primary/10"}`}>
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className={`font-semibold text-sm ${dark ? "text-white" : ""}`}>Security Verification</p>
          <p className={`text-xs ${dark ? "text-gray-400" : "text-muted-foreground"}`}>
            Please complete the verification below to continue
          </p>
        </div>
      </div>

      <TurnstileWidget onToken={setToken} onExpire={() => setToken(null)} />

      {error && (
        <p className="text-sm text-destructive text-center" data-testid="text-captcha-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className={`flex-1 ${dark ? "border-gray-700 text-gray-300 hover:bg-gray-800" : ""}`}
          onClick={onBack}
          disabled={isPending}
          data-testid="button-captcha-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          className="flex-1 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
          disabled={isPending || !token}
          onClick={() => token && onSubmit(token)}
          data-testid="button-captcha-submit"
        >
          {isPending ? (
            <>
              <SpinningLogo className="mr-2 h-4 w-4" />
              Verifying...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Continue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
