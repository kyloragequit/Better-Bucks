import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { ArrowLeft, Construction } from "lucide-react";
import { PageSEO } from "@/components/page-seo";

export default function HowItWorksPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageSEO
        title="How It Works – Automated Incentive Tracking for Shift-Based Teams | Better Bucks"
        description="Replace your spreadsheet reward system in minutes. Operations and HR managers get full performance visibility — hourly employees earn Bucks for safety compliance, attendance, and KPIs, then redeem them in your company store."
        canonicalPath="/how-it-works"
      />

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <AppLogo size="sm" linkTo="/" />
            <span className="text-lg font-bold text-gray-900">Better Bucks</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-16 sm:py-24">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Construction className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4" data-testid="text-how-it-works-title">How It Works</h1>
          <p className="text-lg text-gray-600 mb-8">
            This page is coming soon. We're putting together a detailed walkthrough of how Better Bucks helps your organization reward what's important.
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </main>

      <footer className="border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-sm text-gray-400 flex items-center justify-center gap-2">
          <AppLogo size="sm" />
          <span>Better Bucks LLC</span>
        </div>
      </footer>
    </div>
  );
}
