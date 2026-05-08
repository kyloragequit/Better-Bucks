import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Apple, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = { configured: boolean; pushConfigured: boolean };

const DISMISS_KEY = "bb_wallet_prompt_dismissed_at";
const DISMISS_HOURS = 24 * 7;

function isMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

export function MobileWalletPrompt() {
  const [show, setShow] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useQuery<Status>({ queryKey: ["/api/wallet/status"] });

  useEffect(() => {
    if (!isMobile()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_HOURS * 3600 * 1000) return;
    setShow(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  async function addToWallet() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/pass.pkpass", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ message: "Failed to build pass" }));
        throw new Error(j.message || "Failed to build pass");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "better-bucks.pkpass";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setShow(false);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setDownloading(false);
    }
  }

  const configured = status?.configured ?? false;
  if (!show || !configured) return null;

  const ios = isIOS();

  return (
    <div
      style={{ bottom: "calc(var(--bb-bottom-nav-h) + env(safe-area-inset-bottom) + 0.5rem)" }}
      className="md:hidden fixed inset-x-0 z-50 px-3 pb-3 pt-2 pl-safe pr-safe pointer-events-none"
      data-testid="mobile-wallet-prompt"
    >
      <div className="pointer-events-auto rounded-2xl border border-border/60 bg-card shadow-2xl p-4 flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Apple className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" data-testid="text-mobile-wallet-prompt-title">
            {ios ? "Add Better Bucks to Apple Wallet" : "Get your wallet pass"}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ios
              ? "Tap to add your balance to Apple Wallet so you can pay with one tap at participating merchants."
              : "Open this page on your iPhone to add your balance to Apple Wallet for one-tap payments."}
          </p>
          {error && (
            <p className="text-xs text-destructive mt-1" data-testid="text-mobile-wallet-prompt-error">
              {error}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {ios ? (
              <Button
                size="sm"
                onClick={addToWallet}
                disabled={downloading}
                data-testid="button-mobile-add-to-wallet"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Apple className="h-4 w-4 mr-2" />
                )}
                Add to Apple Wallet
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={dismiss} data-testid="button-mobile-wallet-got-it">
                Got it
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              data-testid="button-mobile-wallet-later"
            >
              Later
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="shrink-0 -mt-1 -mr-1 inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 rounded-md text-muted-foreground hover:text-foreground"
          data-testid="button-mobile-wallet-close"
        >
          <X className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
      </div>
    </div>
  );
}
