import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageSEO } from "@/components/page-seo";
import { AppLogo } from "@/components/app-logo";
import { SiteFooter } from "@/components/site-footer";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Globe,
  Layers,
  LayoutTemplate,
  LineChart,
  LogIn,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

const NAVY = "#162A4A";
const BUCKS_COLOR = "#4E9F3D";

const STATS = [
  { value: "2", label: "Months to build BetterBucks.net" },
  { value: "60+", label: "Pages, dashboards & flows shipped" },
  { value: "1", label: "Developer — me, working with you directly" },
];

const SERVICES = [
  {
    icon: LayoutTemplate,
    title: "Custom Marketing Sites",
    body: "A site built around your brand, not a template. Hand-coded, fast, and designed to convert visitors into customers.",
  },
  {
    icon: Layers,
    title: "Web Apps & Dashboards",
    body: "Real software — logins, databases, payments, admin panels. Like the platform you're on right now.",
  },
  {
    icon: Smartphone,
    title: "Mobile-First Design",
    body: "Every page works beautifully on phone, tablet, and desktop. No clunky mobile afterthoughts.",
  },
  {
    icon: Search,
    title: "Built-In SEO",
    body: "Schema markup, fast page loads, clean structure, and content that ranks. So Google actually sends you traffic.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Hosting & SSL",
    body: "HTTPS, daily backups, and a managed environment. You don't have to think about servers.",
  },
  {
    icon: LineChart,
    title: "Analytics & Tracking",
    body: "See who's visiting, what they click, and where they drop off — so we can make it better over time.",
  },
];

const PROCESS = [
  { icon: Sparkles, title: "Discovery", body: "We talk through your business, your goals, and what success looks like. No commitment yet." },
  { icon: LayoutTemplate, title: "Design", body: "I mock up the look and feel and walk you through it before any code is written." },
  { icon: Code2, title: "Build", body: "I write the code. You see progress every week — not a black box for 3 months." },
  { icon: Rocket, title: "Launch", body: "We go live, set up your domain, and make sure everything works on every device." },
  { icon: Clock, title: "Support", body: "Bugs, tweaks, new pages — I stay involved after launch so you're never stranded." },
];

const FAQS = [
  {
    q: "Why hire you instead of using a website builder like Wix, Squarespace, or Shopify?",
    a: "Drag-and-drop builders are great for very simple sites. But the moment you want something custom — a unique design, a real database, a login system, automated emails, or anything beyond their templates — you hit a wall. I build everything from scratch in code, which means there's no ceiling on what your site can do. You also own your code outright.",
  },
  {
    q: "How do I know you can actually build this?",
    a: "You're looking at the proof. BetterBucks.net is a full multi-tenant SaaS platform — payments, role-based logins, admin dashboards, employee portals, email notifications, blog, the works. I designed and coded it solo in roughly 2 months. I can build something at least that ambitious for you.",
  },
  {
    q: "How long does a typical project take?",
    a: "A polished marketing site is usually 2–4 weeks. A web app with logins, payments, and a database is typically 6–10 weeks. I'll give you a real timeline after our discovery call.",
  },
  {
    q: "How much does it cost?",
    a: "It depends entirely on scope. A custom marketing site usually starts in the low four figures. A full web app is a bigger investment. I'll quote you a flat price after we talk — no hourly surprises.",
  },
  {
    q: "Do you do SEO?",
    a: "Yes. SEO is built in from day one — schema markup, fast load times, clean URLs, mobile optimization, and a sitemap. I'll also help you target the keywords your customers actually search for.",
  },
  {
    q: "What if I already have a website?",
    a: "I can rebuild it, redesign it, or add new features (a store, a member area, a booking system). Tell me what's broken and what you wish it did.",
  },
];

export default function WebsiteServicesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !details) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const needsBlock = projectType
        ? `Project type: ${projectType}\n\n${details}`
        : details;
      const res = await fetch("/api/info-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          needs: needsBlock,
          inquiryType: "website",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setSubmitted(true);
      toast({ title: "Got it!", description: data.message });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <PageSEO
        title="Custom Website Design & Development | Built by the Maker of Better Bucks"
        description="Skip the cookie-cutter website builders. Get a custom website, web app, or online store designed and coded for your business by Miles Chase — the developer behind BetterBucks.net. Built in 2 months. Get a free quote."
        keywords="custom website design, website development, professional website builder, web designer for small business, freelance web developer, custom web development, website creation services, hire a web developer, alternative to Wix, alternative to Squarespace, custom website builder, build me a website, web app developer, SaaS development, full stack developer for hire"
        canonicalPath="/website-services"
        jsonLd={[
          {
            "@type": "ProfessionalService",
            "@id": "https://betterbucks.net/website-services#service",
            name: "Custom Website Design & Development by Miles Chase",
            description:
              "Custom websites, web apps, and online stores designed and developed for small and mid-sized businesses. Built by the developer behind BetterBucks.net.",
            url: "https://betterbucks.net/website-services",
            email: "miles.chase@betterbucks.net",
            areaServed: "United States",
            priceRange: "$$",
            provider: {
              "@type": "Person",
              name: "Miles Chase",
              email: "miles.chase@betterbucks.net",
              url: "https://betterbucks.net/website-services",
            },
            serviceType: [
              "Custom Website Design",
              "Web Application Development",
              "SaaS Development",
              "E-commerce Development",
              "SEO-Optimized Web Development",
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
            data-testid="button-home-logo"
          >
            <AppLogo size="sm" />
            <span className="font-bold text-base" style={{ color: NAVY }}>
              Better Bucks
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back-to-betterbucks"
            >
              Better Bucks Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/login")}
              data-testid="button-header-login"
            >
              <LogIn className="mr-1.5 h-4 w-4" />
              Log In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1f3a64 60%, ${NAVY} 100%)`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5"
              style={{ background: `${BUCKS_COLOR}30`, color: "#a7e58e" }}
              data-testid="badge-built-by"
            >
              <Globe className="h-3.5 w-3.5" />
              Built by the developer behind BetterBucks.net
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-5">
              I'll build you a custom website — the right way.
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-3 max-w-xl">
              I designed and coded the entire BetterBucks platform — the site you're looking at right now —
              <strong className="text-white"> from scratch in 2 months</strong>. Logins, payments, dashboards,
              email, the whole thing.
            </p>
            <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-xl">
              If you want a real website — not a drag-and-drop template — I can build it for you too.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => document.getElementById("inquiry-form")?.scrollIntoView({ behavior: "smooth" })}
                className="font-bold"
                style={{ background: BUCKS_COLOR, color: "white" }}
                data-testid="button-hero-quote"
              >
                Get a Free Quote
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold"
                data-testid="button-hero-services"
              >
                See What I Build
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {STATS.map((s) => (
              <Card key={s.label} className="bg-white/5 border-white/10 backdrop-blur" data-testid={`card-stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl sm:text-4xl font-black text-white mb-1">{s.value}</div>
                  <div className="text-xs text-white/70 leading-tight">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BUCKS_COLOR }}>
            Live Proof
          </p>
          <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ color: NAVY }}>
            This entire site is the portfolio.
          </h2>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            Multi-tenant SaaS, role-based logins (employee / admin / super admin), Stripe billing,
            email notifications, a custom blog, an admin dashboard, a rewards store, and SEO-optimized
            marketing pages. <strong style={{ color: NAVY }}>One developer. Two months.</strong>
          </p>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BUCKS_COLOR }}>
              What I Build
            </p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>
              Real websites and real software — not templates.
            </h2>
            <p className="text-gray-600">
              Whether you need a polished marketing site or a full web application, I can build it.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((s) => (
              <Card key={s.title} className="border-gray-200 hover:shadow-lg transition-shadow" data-testid={`card-service-${s.title.replace(/\s+/g, "-").toLowerCase()}`}>
                <CardContent className="p-6">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: `${BUCKS_COLOR}15` }}
                  >
                    <s.icon className="h-5 w-5" style={{ color: BUCKS_COLOR }} />
                  </div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: NAVY }}>{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BUCKS_COLOR }}>
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>
              A simple, no-surprises process.
            </h2>
            <p className="text-gray-600">
              You'll always know what stage we're in and what's coming next.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {PROCESS.map((p, i) => (
              <div key={p.title} className="relative" data-testid={`step-process-${i + 1}`}>
                <Card className="border-gray-200 h-full">
                  <CardContent className="p-5">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-4 font-black text-white text-sm"
                      style={{ background: NAVY }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <p.icon className="h-4 w-4" style={{ color: BUCKS_COLOR }} />
                      <h3 className="font-bold" style={{ color: NAVY }}>{p.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{p.body}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why not a builder */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BUCKS_COLOR }}>
              Custom Code vs Drag-and-Drop
            </p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>
              Why not just use a website builder?
            </h2>
            <p className="text-gray-600">
              Wix, Squarespace, and Shopify are fine for very simple sites. Here's where they fall short.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card className="border-gray-200" data-testid="card-builders">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-3" style={{ color: NAVY }}>Drag-and-Drop Builders</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Limited to their templates and components</li>
                  <li>• Slow page loads hurt your SEO ranking</li>
                  <li>• You can't build real software (logins, dashboards, automations)</li>
                  <li>• Monthly fees forever — and your site lives on their servers</li>
                  <li>• Hard to make your brand actually stand out</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-2" style={{ borderColor: BUCKS_COLOR }} data-testid="card-custom-built">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-3" style={{ color: NAVY }}>Custom-Built (What I Do)</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BUCKS_COLOR }} />Designed around your brand and your customers</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BUCKS_COLOR }} />Lightning fast — built for SEO from the start</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BUCKS_COLOR }} />Real software when you need it (logins, payments, dashboards)</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BUCKS_COLOR }} />You own the code. Host wherever you want.</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BUCKS_COLOR }} />A real human (me) you can call when something needs to change</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Inquiry form */}
      <section id="inquiry-form" className="py-16 sm:py-24" style={{ background: NAVY }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 text-white">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "#a7e58e" }}>
              Let's Talk
            </p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Tell me about your project.
            </h2>
            <p className="text-white/70 max-w-xl mx-auto">
              Fill this out and I'll get back to you within one business day. No pressure, no sales pitch —
              just a real conversation about what you need.
            </p>
          </div>

          {submitted ? (
            <Card className="bg-white" data-testid="card-form-success">
              <CardContent className="p-10 text-center">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ background: `${BUCKS_COLOR}20` }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: BUCKS_COLOR }} />
                </div>
                <h3 className="text-2xl font-black mb-2" style={{ color: NAVY }}>Got it!</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Thanks, {name.split(" ")[0] || "there"}. I'll reach out within one business day to talk
                  about your project.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white shadow-2xl">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Your Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        required
                        data-testid="input-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@yourcompany.com"
                        required
                        data-testid="input-email"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 555-1234"
                        required
                        data-testid="input-phone"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="project-type">Project Type</Label>
                      <Select value={projectType} onValueChange={setProjectType}>
                        <SelectTrigger id="project-type" data-testid="select-project-type">
                          <SelectValue placeholder="Pick one (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Marketing site">Marketing / brochure site</SelectItem>
                          <SelectItem value="E-commerce / online store">E-commerce / online store</SelectItem>
                          <SelectItem value="Web app or SaaS">Web app or SaaS</SelectItem>
                          <SelectItem value="Redesign of existing site">Redesign of an existing site</SelectItem>
                          <SelectItem value="Landing page">Single landing page</SelectItem>
                          <SelectItem value="Not sure yet">Not sure yet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="details">Tell me about your project *</Label>
                    <Textarea
                      id="details"
                      rows={5}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="What does your business do? What do you want the site to do? Any examples of sites you like?"
                      required
                      data-testid="input-details"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full font-bold"
                    style={{ background: BUCKS_COLOR, color: "white" }}
                    data-testid="button-submit-inquiry"
                  >
                    {submitting ? "Sending..." : "Send My Project Details"}
                    {!submitting && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Or email me directly: <a href="mailto:miles.chase@betterbucks.net" className="font-semibold underline" style={{ color: NAVY }}>miles.chase@betterbucks.net</a>
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BUCKS_COLOR }}>
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>
              Common questions
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <Card key={i} className="border-gray-200" data-testid={`card-faq-${i + 1}`}>
                <CardContent className="p-5">
                  <h3 className="font-bold mb-2" style={{ color: NAVY }}>{f.q}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center text-sm text-gray-500">
            Curious about <Link href="/" className="font-semibold underline" style={{ color: NAVY }} data-testid="link-betterbucks-home">Better Bucks</Link>, the employee-rewards platform that this site demos? That's the SaaS I built — and an example of what I can build for you.
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
