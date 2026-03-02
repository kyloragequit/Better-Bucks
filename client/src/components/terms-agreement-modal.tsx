import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppLogo } from "@/components/app-logo";
import { SpinningLogo } from "@/components/spinning-logo";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function TermsAgreementModal() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { mutate: acceptTerms, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/user/accept-terms", { marketingOptIn: marketingAgreed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  if (!user || user.termsAcceptedAt) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-[560px] max-h-[90vh] flex flex-col gap-0 p-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby={undefined}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo size="xs" />
            <DialogTitle className="text-base font-bold">Terms of Service &amp; Privacy Policy</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Please read and agree to our terms before using Better Bucks.
          </p>
        </DialogHeader>

        {/* Scrollable terms body */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="px-6 py-4 space-y-6 text-sm text-muted-foreground leading-relaxed">

            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Terms of Service</h2>
              <p className="text-xs text-muted-foreground">Last Updated: 3/2/2026</p>
              <p>These Terms of Service ("Terms") govern your access to and use of the Better Bucks web application and related services operated by Better Bucks LLC. By checking the box below, you agree to be bound by these Terms.</p>

              <div><p className="font-semibold text-foreground mb-1">1. Service Overview</p><p>Better Bucks provides a cloud-based employee incentive and recognition platform for organizational use only.</p></div>
              <div><p className="font-semibold text-foreground mb-1">2. Account Responsibilities</p><p>Organizations are responsible for ensuring authorized use, maintaining credential confidentiality, and providing accurate information. Better Bucks reserves the right to suspend accounts that violate these Terms.</p></div>
              <div><p className="font-semibold text-foreground mb-1">3. Acceptable Use</p><p>You agree not to use the Service for unlawful purposes, attempt unauthorized access, upload malicious content, interfere with system security, or misrepresent identity. Violations may result in immediate termination.</p></div>
              <div><p className="font-semibold text-foreground mb-1">4. Customer Data Ownership</p><p>Organizations retain ownership of all submitted data. You grant Better Bucks a limited license to process data solely for operating and improving the Service.</p></div>
              <div><p className="font-semibold text-foreground mb-1">5. Fees &amp; Subscriptions</p><p>If operating under a paid plan, fees follow agreed pricing tiers, are due per billing terms, and are non-refundable unless agreed in writing. Non-payment may result in suspended access.</p></div>
              <div><p className="font-semibold text-foreground mb-1">6. Service Availability</p><p>Better Bucks strives for reliable uptime but does not guarantee uninterrupted access. Temporary interruptions may occur due to maintenance, technical issues, or circumstances beyond our control.</p></div>
              <div><p className="font-semibold text-foreground mb-1">7. Intellectual Property</p><p>All software, branding, and platform functionality are the exclusive property of Better Bucks. You may not copy, distribute, reverse engineer, or sublicense the Service without written permission.</p></div>
              <div><p className="font-semibold text-foreground mb-1">8. Limitation of Liability</p><p>To the fullest extent permitted by law, Better Bucks is not liable for indirect or consequential damages, loss of profits, or decisions made based on platform data. The Service is provided "as is."</p></div>
              <div><p className="font-semibold text-foreground mb-1">9. Termination</p><p>We may suspend or terminate access for violations, non-payment, or legal risk. Organizations may discontinue use at any time.</p></div>
              <div><p className="font-semibold text-foreground mb-1">10. Governing Law</p><p>These Terms are governed by the laws of the United States.</p></div>
            </section>

            <hr className="border-border" />

            <section className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Privacy Policy</h2>
              <p className="text-xs text-muted-foreground">Last Updated: 3/2/2026</p>
              <div><p className="font-semibold text-foreground mb-1">Information We Collect</p><p>We may collect names, email addresses, phone numbers, employee identifiers, account credentials, and activity data. We also automatically collect IP addresses, device/browser information, and usage analytics.</p></div>
              <div><p className="font-semibold text-foreground mb-1">How We Use Information</p><p>We use your information to operate the Service, provide support, improve features, maintain security, and provide analytics. <strong className="text-foreground">We do not sell personal information.</strong></p></div>
              <div><p className="font-semibold text-foreground mb-1">Data Sharing</p><p>We may share data only with hosting providers, platform service providers, and legal authorities when required by law. All providers are required to protect data confidentiality.</p></div>
              <div><p className="font-semibold text-foreground mb-1">Data Security &amp; Retention</p><p>We implement reasonable safeguards to protect your information. Data is retained while accounts are active or as legally required. Organizations may request data deletion upon termination.</p></div>
              <div><p className="font-semibold text-foreground mb-1">Contact</p><p>For questions or data requests: <a href="mailto:miles.chase@betterbucks.net" className="text-primary underline">miles.chase@betterbucks.net</a></p></div>
            </section>

          </div>
        </ScrollArea>

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
              <span className="font-semibold text-foreground">I agree to the Terms of Service and Privacy Policy</span>
              <span className="text-destructive ml-1">*</span>
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
              I agree to receive marketing communications from Better Bucks (optional)
            </Label>
          </div>

          <Button
            className="w-full"
            disabled={!termsAgreed || isPending}
            onClick={() => acceptTerms()}
            data-testid="button-accept-terms"
          >
            {isPending ? (
              <>
                <SpinningLogo className="mr-2 h-4 w-4" />
                Saving…
              </>
            ) : (
              "Continue to Better Bucks"
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You must agree to the Terms of Service to use this platform.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
