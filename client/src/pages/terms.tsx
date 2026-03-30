import { SiteFooter } from "@/components/site-footer";
import { AppLogo } from "@/components/app-logo";
import { PageSEO } from "@/components/page-seo";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PageSEO
        title="Terms of Service & Software License Agreement | Better Bucks"
        description="Read the Better Bucks Terms of Service and Software License Agreement."
        canonicalPath="/terms"
        noindex
      />
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-terms"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <AppLogo size="xs" linkTo="/" />
        <span className="text-sm font-semibold text-foreground">Better Bucks LLC</span>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-16">

        {/* ── Terms of Service & Software License Agreement ── */}
        <section>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">Terms of Service &amp; Software License Agreement</h1>
          <p className="text-sm text-muted-foreground mb-2">BETTER BUCKS LLC</p>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: 3/2/2026</p>

          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            By creating an account, accessing, or using the Better Bucks platform ("Software"), you ("User" or "Company") agree to be bound by these Terms of Service and Software License Agreement ("Agreement"). If you do not agree, do not use the Software.
          </p>

          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">1. License Grant</h2>
              <p className="text-sm text-muted-foreground">Better Bucks LLC ("Company," "we," "us") grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Software for internal business purposes. This is a license—not a sale.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">2. Ownership</h2>
              <p className="text-sm text-muted-foreground">All rights, title, and interest in and to the Software—including all intellectual property—are and will remain the exclusive property of Better Bucks LLC. You do not acquire any ownership rights through use of the Software.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">3. Permitted Use</h2>
              <p className="text-sm text-muted-foreground">You agree to use the Software solely for: managing employee incentives, tracking performance, conducting internal surveys, and internal business operations.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">4. Restrictions</h2>
              <p className="text-sm text-muted-foreground mb-2">You may NOT:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Copy, reproduce, or distribute the Software</li>
                <li>Modify, adapt, or create derivative works</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Resell, sublicense, or commercially exploit the Software</li>
                <li>Allow unauthorized third-party access</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">5. Account Responsibility</h2>
              <p className="text-sm text-muted-foreground">You are responsible for maintaining account security, all activity under your account, and ensuring your users comply with this Agreement.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">6. Hosting &amp; Access</h2>
              <p className="text-sm text-muted-foreground">The Software is hosted and maintained exclusively by Better Bucks LLC. We reserve the right to modify features, update functionality, and suspend or restrict access if necessary.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">7. Fees &amp; Billing</h2>
              <p className="text-sm text-muted-foreground">Subscription fees will be billed on a recurring basis. Pricing is subject to change with notice. Failure to pay may result in suspension or termination.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">8. Termination</h2>
              <p className="text-sm text-muted-foreground">We may suspend or terminate your access at any time if you violate these terms, payment is not received, or misuse of the platform occurs. Upon termination, your license is revoked immediately and access to the Software will be discontinued.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">9. Data &amp; Privacy</h2>
              <p className="text-sm text-muted-foreground">You retain ownership of your business data. However, you grant Better Bucks LLC the right to store and process data necessary to provide the service, and use aggregated, anonymized data for platform improvements.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">10. Disclaimer of Warranties</h2>
              <p className="text-sm text-muted-foreground">The Software is provided "as is" and "as available." We make no guarantees regarding performance, uptime, or results from use.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">11. Limitation of Liability</h2>
              <p className="text-sm text-muted-foreground">To the fullest extent permitted by law, Better Bucks LLC shall not be liable for indirect, incidental, or consequential damages, or loss of profits, data, or business opportunities.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">12. Governing Law</h2>
              <p className="text-sm text-muted-foreground">This Agreement shall be governed by the laws of the State of Texas.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">13. Changes to Terms</h2>
              <p className="text-sm text-muted-foreground">We may update these terms at any time. Continued use of the Software constitutes acceptance of any changes.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">14. Acceptance of Terms</h2>
              <p className="text-sm text-muted-foreground">By creating an account or using the Software, you acknowledge that you have read, understood, and agree to be bound by this Agreement.</p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Better Bucks LLC</strong><br />
                Email: <a href="mailto:miles.chase@betterbucks.net" className="text-primary underline">miles.chase@betterbucks.net</a><br />
                Website: <a href="https://betterbucks.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://betterbucks.net</a>
              </p>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
