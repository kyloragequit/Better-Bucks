import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { ArrowLeft } from "lucide-react";
import { InstagramFloat } from "@/components/instagram-float";
import { PageSEO } from "@/components/page-seo";

export default function AboutPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageSEO
        title="About Better Bucks – Our Mission"
        description="Learn how Better Bucks was built to help organizations recognize and reward employee performance with a flexible digital currency."
        canonicalPath="/about"
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

      <main className="flex-1 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2" data-testid="text-about-title">About Better Bucks</h1>
            <div className="h-1 w-16 bg-secondary mx-auto rounded-full" />
          </div>
          <div className="space-y-6 text-gray-700 text-base sm:text-lg leading-relaxed">
            <p>
              Better Bucks LLC was founded in 2026 by Southeastern Louisiana University Business Administration student, Miles Gideon Chase.
            </p>
            <p>
              Throughout his college career, Miles saw the emphasis focused on behaviors in the workplace in 21st century business. Through his various jobs (7 to be precise) and internships throughout his college career, he saw how psychology and incentives play a major role in how to have happier and more effective employees. He also saw that poor incentives &mdash; things that the employees did not want &mdash; actually discouraged employees more than they made them want to be more effective. He also saw that managers had difficulty allocating their time to actually reward their employees.
            </p>
            <p className="text-xl font-semibold text-gray-900">
              That's why he made Better Bucks.
            </p>
            <p>
              Better Bucks streamlines the process for employee incentives. It allows them to tell you what they want and helps you to easily and instantly reward them with things they want.
            </p>
            <p className="text-2xl font-bold text-center text-primary mt-8">
              Better Bucks for a Better Business!
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-sm text-gray-400 flex items-center justify-center gap-2">
          <AppLogo size="sm" />
          <span>Better Bucks LLC</span>
        </div>
      </footer>
      <InstagramFloat />
    </div>
  );
}
