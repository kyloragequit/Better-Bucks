import { SiteFooter } from "@/components/site-footer";
import { AppLogo } from "@/components/app-logo";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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

        {/* ── Terms of Service ─────────────────────────────── */}
        <section>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: 3/2/2026</p>

          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            These Terms of Service ("Terms") govern your access to and use of the Better Bucks web application and related services (the "Service") operated by Better Bucks ("Better Bucks," "Company," "we," "our," or "us"). By accessing or using the Service, you agree to be bound by these Terms.
          </p>

          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">1. Service Overview</h2>
              <p className="text-sm text-muted-foreground mb-2">Better Bucks provides a cloud-based employee incentive and recognition platform that enables organizations to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Award and manage employee reward points</li>
                <li>Track performance, safety, and recognition programs</li>
                <li>Generate administrative reports and analytics</li>
                <li>Support employee engagement initiatives</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">The Service is intended for organizational and business use only.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">2. Account Registration &amp; Responsibilities</h2>
              <p className="text-sm text-muted-foreground mb-2">Organizations are responsible for:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Ensuring authorized use of accounts</li>
                <li>Maintaining confidentiality of login credentials</li>
                <li>Providing accurate and current information</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Account administrators control employee access and permissions within their organization. Better Bucks reserves the right to suspend or terminate accounts that violate these Terms.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">3. Acceptable Use</h2>
              <p className="text-sm text-muted-foreground mb-2">You agree not to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Use the Service for unlawful or fraudulent purposes</li>
                <li>Attempt unauthorized access to systems or data</li>
                <li>Upload malicious software or harmful content</li>
                <li>Interfere with system functionality or security</li>
                <li>Misrepresent identity or organizational authority</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Violation may result in immediate suspension or termination.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">4. Customer Data Ownership</h2>
              <p className="text-sm text-muted-foreground">Organizations retain ownership of all data submitted to the Service, including employee and program data. You grant Better Bucks a limited, non-exclusive license to process and store data solely for the purpose of operating, maintaining, and improving the Service.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">5. Fees and Subscription (If Applicable)</h2>
              <p className="text-sm text-muted-foreground mb-2">If the Service is provided under a paid agreement:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Fees follow agreed pricing tiers</li>
                <li>Payments are due according to billing terms</li>
                <li>Fees are non-refundable unless otherwise agreed in writing</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Failure to pay may result in suspension of access.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">6. Service Availability</h2>
              <p className="text-sm text-muted-foreground mb-2">Better Bucks strives to maintain reliable service availability but does not guarantee uninterrupted access. Temporary interruptions may occur due to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Maintenance or updates</li>
                <li>Technical issues</li>
                <li>Circumstances beyond our control</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">7. Intellectual Property</h2>
              <p className="text-sm text-muted-foreground mb-2">All software, branding, designs, and platform functionality are the exclusive property of Better Bucks. Users may not:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Copy, distribute, or reverse engineer the Service</li>
                <li>Resell or sublicense access without written permission</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">8. Limitation of Liability</h2>
              <p className="text-sm text-muted-foreground mb-2">To the fullest extent permitted by law, Better Bucks shall not be liable for:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Indirect or consequential damages</li>
                <li>Loss of profits or business interruption</li>
                <li>Decisions made based on platform data</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">The Service is provided "as is" without warranties of any kind.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">9. Termination</h2>
              <p className="text-sm text-muted-foreground mb-2">We may suspend or terminate access if:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>These Terms are violated</li>
                <li>Payment obligations are unmet</li>
                <li>Use creates legal or security risk</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Organizations may discontinue use at any time.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">10. Changes to Terms</h2>
              <p className="text-sm text-muted-foreground">We may update these Terms periodically. Continued use of the Service after updates constitutes acceptance of revised Terms.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">11. Governing Law</h2>
              <p className="text-sm text-muted-foreground">These Terms are governed by the laws of the United States.</p>
            </div>
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* ── Privacy Policy ───────────────────────────────── */}
        <section>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: 3/2/2026</p>

          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            This Privacy Policy explains how Better Bucks collects, uses, and protects information when you use the Service.
          </p>

          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">1. Information We Collect</h2>
              <p className="text-sm font-semibold text-foreground mb-1">Information Provided by Organizations and Users</p>
              <p className="text-sm text-muted-foreground mb-2">We may collect:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Names</li>
                <li>Email addresses</li>
                <li>Phone numbers</li>
                <li>Employee identifiers</li>
                <li>Account credentials</li>
                <li>Incentive and recognition activity data</li>
                <li>Administrative account information</li>
              </ul>
              <p className="text-sm font-semibold text-foreground mt-4 mb-1">Automatically Collected Information</p>
              <p className="text-sm text-muted-foreground mb-2">We may automatically collect:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>IP addresses</li>
                <li>Device and browser information</li>
                <li>Login activity and timestamps</li>
                <li>Usage analytics and interaction data</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">2. How We Use Information</h2>
              <p className="text-sm text-muted-foreground mb-2">We use information to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Operate and maintain the Service</li>
                <li>Provide platform functionality</li>
                <li>Enable communication and account support</li>
                <li>Improve system performance and features</li>
                <li>Maintain security and prevent fraud</li>
                <li>Provide reporting and analytics</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2 font-medium">We do not sell personal information.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">3. Data Sharing</h2>
              <p className="text-sm text-muted-foreground mb-2">Better Bucks does not sell or rent user data. We may share information only with:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Hosting and infrastructure providers</li>
                <li>Service providers required to operate the platform</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">All service providers are required to protect data confidentiality.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">4. Data Security</h2>
              <p className="text-sm text-muted-foreground">We implement reasonable administrative, technical, and organizational safeguards designed to protect personal information. No online system can guarantee absolute security.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">5. Data Retention</h2>
              <p className="text-sm text-muted-foreground mb-2">We retain information:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>While accounts remain active</li>
                <li>As necessary to fulfill operational or legal obligations</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Organizations may request deletion of data upon termination of services.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">6. Employee Data &amp; Organizational Control</h2>
              <p className="text-sm text-muted-foreground mb-2">Employee accounts are administered by their employer. Employers determine:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Participation in incentive programs</li>
                <li>Data visibility within their organization</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Better Bucks acts as a data processor on behalf of client organizations.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">7. User Rights</h2>
              <p className="text-sm text-muted-foreground mb-2">Depending on applicable law, individuals may request:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Access to personal data</li>
                <li>Correction of inaccurate data</li>
                <li>Deletion of personal information (subject to organizational approval)</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Requests may be submitted to: <a href="mailto:miles.chase@betterbucks.net" className="text-primary underline">miles.chase@betterbucks.net</a></p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">8. Cookies &amp; Tracking Technologies</h2>
              <p className="text-sm text-muted-foreground mb-2">We may use cookies or similar technologies to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li>Maintain login sessions</li>
                <li>Improve user experience</li>
                <li>Analyze platform usage</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">Users may manage cookie preferences through browser settings.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">9. Policy Updates</h2>
              <p className="text-sm text-muted-foreground">We may update this Privacy Policy periodically. Updates will be posted with a revised "Last Updated" date.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">10. Contact Information</h2>
              <p className="text-sm text-muted-foreground">
                Better Bucks<br />
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
