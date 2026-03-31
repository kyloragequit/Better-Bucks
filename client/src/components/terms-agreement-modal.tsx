import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/app-logo";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const APP_PAGE_PREFIXES = ["/dashboard", "/store", "/orders", "/settings", "/admin/"];

export function TermsAgreementModal() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  const { mutate: acceptTerms, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/user/accept-terms", { marketingOptIn: marketingAgreed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  const isOnAppPage = APP_PAGE_PREFIXES.some(p => location.startsWith(p));

  if (!user || user.termsAcceptedAt || !isOnAppPage) return null;

  return (
    /* z-[10000] puts this above the tutorial modal at z-[9999] */
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 10000, background: "rgba(22,42,74,0.88)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-background border rounded-xl shadow-2xl w-full max-w-[560px] flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo size="xs" />
            <h2 className="text-base font-bold leading-none">Terms of Service &amp; Software License Agreement</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Please read and agree to our terms before using Better Bucks.
          </p>
        </div>

        {/* Scrollable terms body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-muted-foreground leading-relaxed min-h-0">

          <p className="font-bold text-foreground text-sm">BETTER BUCKS LLC – TERMS OF SERVICE &amp; SOFTWARE LICENSE AGREEMENT</p>

          <div>
            <p className="font-semibold text-foreground mb-1">1. LICENSE GRANT</p>
            <p>Better Bucks LLC ("Company," "we," "us") grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Software for internal business purposes. This is a license—not a sale.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">2. OWNERSHIP</p>
            <p>All rights, title, and interest in and to the Software—including all intellectual property—are and will remain the exclusive property of Better Bucks LLC. You do not acquire any ownership rights through use of the Software.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">3. PERMITTED USE</p>
            <p>You agree to use the Software solely for: managing employee incentives, tracking performance, conducting internal surveys, and internal business operations.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">4. RESTRICTIONS</p>
            <p>You may NOT: copy, reproduce, or distribute the Software; modify, adapt, or create derivative works; reverse engineer or attempt to extract source code; resell, sublicense, or commercially exploit the Software; or allow unauthorized third-party access.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">5. ACCOUNT RESPONSIBILITY</p>
            <p>You are responsible for maintaining account security, all activity under your account, and ensuring your users comply with this Agreement.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">6. HOSTING &amp; ACCESS</p>
            <p>The Software is hosted and maintained exclusively by Better Bucks LLC. We reserve the right to modify features, update functionality, and suspend or restrict access if necessary.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">7. FEES &amp; BILLING</p>
            <p>Subscription fees will be billed on a recurring basis. Pricing is subject to change with notice. Failure to pay may result in suspension or termination.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">8. TERMINATION</p>
            <p>We may suspend or terminate your access at any time if you violate these terms, payment is not received, or misuse of the platform occurs. Upon termination, your license is revoked immediately and access to the Software will be discontinued.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">9. DATA &amp; PRIVACY</p>
            <p>You retain ownership of your business data. However, you grant Better Bucks LLC the right to store and process data necessary to provide the service, and use aggregated, anonymized data for platform improvements.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">10. DISCLAIMER OF WARRANTIES</p>
            <p>The Software is provided "as is" and "as available." We make no guarantees regarding performance, uptime, or results from use.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">11. LIMITATION OF LIABILITY</p>
            <p>To the fullest extent permitted by law, Better Bucks LLC shall not be liable for indirect, incidental, or consequential damages, or loss of profits, data, or business opportunities.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">12. GOVERNING LAW</p>
            <p>This Agreement shall be governed by the laws of the State of Louisiana.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">13. CHANGES TO TERMS</p>
            <p>We may update these terms at any time. Continued use of the Software constitutes acceptance of any changes.</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">14. ACCEPTANCE OF TERMS</p>
            <p>By checking the box below, you acknowledge that you have read, understood, and agree to be bound by this Agreement.</p>
          </div>

        </div>

        {/* Agreement checkboxes + action */}
        <div className="px-6 py-4 border-t bg-muted/30 space-y-4 shrink-0">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms-agree"
              checked={termsAgreed}
              onCheckedChange={(v) => setTermsAgreed(!!v)}
              data-testid="checkbox-agree-terms"
            />
            <Label htmlFor="terms-agree" className="text-sm leading-snug cursor-pointer">
              <span className="font-semibold text-foreground">I have read and agree to the Terms of Service and Software License Agreement.</span>
              <span className="text-destructive ml-1">*</span>
              <span className="block text-muted-foreground font-normal mt-0.5 text-xs">I understand this is a binding legal agreement between my organization and Better Bucks LLC.</span>
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="marketing-agree"
              checked={marketingAgreed}
              onCheckedChange={(v) => setMarketingAgreed(!!v)}
              data-testid="checkbox-agree-marketing"
            />
            <Label htmlFor="marketing-agree" className="text-sm leading-snug cursor-pointer text-muted-foreground">
              I'd like to receive product updates, tips, and occasional promotions from Better Bucks. <span className="italic">(Optional)</span>
            </Label>
          </div>

          <Button
            className="w-full"
            disabled={!termsAgreed || isPending}
            onClick={() => acceptTerms()}
            data-testid="button-accept-terms"
          >
            {isPending ? "Saving…" : "Continue to Better Bucks"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You must agree to the Terms of Service to use this platform.
          </p>
        </div>
      </div>
    </div>
  );
}
