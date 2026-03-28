import { useState, useEffect, useMemo } from "react";
import { SiteFooter } from "@/components/site-footer";
import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppLogo } from "@/components/app-logo";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, LogOut, LogIn, Code2, Shield, Trash2, AlertTriangle, Play, Pause, FileEdit, Save, BarChart3, ExternalLink, Search, ChevronLeft, ChevronRight, TrendingUp, DollarSign, PlusCircle, UserX, Filter, XCircle, BookOpen, Plus, Pencil, Calendar, ImageIcon, Upload, Loader2, Tag, ToggleLeft, ToggleRight, Copy, Check, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Organization, BlogPost, ReferralCode } from "@shared/schema";

const CMS_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "hero_headline", label: "Hero Headline" },
  { key: "hero_subheadline", label: "Hero Sub-headline", multiline: true },
  { key: "benefit1_title", label: "Benefit 1 — Title" },
  { key: "benefit1_subtitle", label: "Benefit 1 — Subtitle" },
  { key: "benefit1_bullet1", label: "Benefit 1 — Bullet 1" },
  { key: "benefit1_bullet2", label: "Benefit 1 — Bullet 2" },
  { key: "benefit1_bullet3", label: "Benefit 1 — Bullet 3" },
  { key: "benefit2_title", label: "Benefit 2 — Title" },
  { key: "benefit2_subtitle", label: "Benefit 2 — Subtitle" },
  { key: "benefit2_bullet1", label: "Benefit 2 — Bullet 1" },
  { key: "benefit2_bullet2", label: "Benefit 2 — Bullet 2" },
  { key: "benefit2_bullet3", label: "Benefit 2 — Bullet 3" },
  { key: "benefit3_title", label: "Benefit 3 — Title" },
  { key: "benefit3_subtitle", label: "Benefit 3 — Subtitle" },
  { key: "benefit3_bullet1", label: "Benefit 3 — Bullet 1" },
  { key: "benefit3_bullet2", label: "Benefit 3 — Bullet 2" },
  { key: "benefit3_bullet3", label: "Benefit 3 — Bullet 3" },
  { key: "cta_headline", label: "CTA Headline" },
  { key: "cta_subtext", label: "CTA Sub-text", multiline: true },
  { key: "instagram_handle", label: "Instagram Handle (without @)" },
];

const CMS_DEFAULTS: Record<string, string> = {
  hero_headline: "Reward What's Important",
  hero_subheadline: `A "Bucks"-based incentive system that helps businesses recognize employees instantly, automate rewards, and drive measurable results — without extra admin work.`,
  benefit1_title: "Simple Rewards, Zero Hassle",
  benefit1_subtitle: "Streamline how you recognize employees.",
  benefit1_bullet1: "Replace spreadsheets and manual tracking",
  benefit1_bullet2: "Reward employees in seconds",
  benefit1_bullet3: "Centralized platform for all incentives",
  benefit2_title: "Motivate Performance That Matters",
  benefit2_subtitle: "Turn everyday actions into measurable results.",
  benefit2_bullet1: "Tie rewards to KPIs, attendance, or goals",
  benefit2_bullet2: "Reinforce productivity and accountability",
  benefit2_bullet3: "Encourage behaviors aligned with company success",
  benefit3_title: "Control Costs While Boosting Engagement",
  benefit3_subtitle: "Incentives employees love — with budgets you control.",
  benefit3_bullet1: "Predictable incentive spending",
  benefit3_bullet2: "Flexible reward options employees choose",
  benefit3_bullet3: "Scales easily as your workforce grows",
  cta_headline: "Ready to transform your employee rewards?",
  cta_subtext: "Fill out the form below and we'll get back to you about how Better Bucks can work for your team.",
  instagram_handle: "better_bucks",
};

type OrgWithStats = Organization & {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  primeAdmin: { id: number; username: string; fullName: string; email: string | null } | null;
};

const tierLabels: Record<string, string> = {
  small: "Small Site",
  mid: "Mid-Size",
  large: "Large Site",
  enterprise: "Enterprise",
};

const tierPrices: Record<string, number> = {
  small: 49.99,
  mid: 99.99,
  large: 149.99,
  enterprise: 299.99,
};

export default function DeveloperDashboardPage() {
  const { data: user, isLoading: userLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cmsValues, setCmsValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"orgs" | "cms" | "blog" | "referrals" | "agreements">("orgs");
  const [blogForm, setBlogForm] = useState<Partial<BlogPost> & { isNew?: boolean } | null>(null);
  const [refCodeForm, setRefCodeForm] = useState<{ code: string; description: string; extraMonths: number } | null>(null);
  const [blogImageUploading, setBlogImageUploading] = useState(false);

  async function handleBlogImageUpload(file: File) {
    setBlogImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/developer/blog-image", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      const { url } = await res.json();
      setBlogForm(p => ({ ...p!, imageUrl: url }));
      toast({ title: "Uploaded", description: "Hero image uploaded successfully." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBlogImageUploading(false);
    }
  }

  const { data: organizations, isLoading } = useQuery<OrgWithStats[]>({
    queryKey: ["/api/developer/organizations"],
    enabled: user?.role === "developer",
  });

  const { data: cmsContent } = useQuery<Record<string, string>>({
    queryKey: ["/api/page-content"],
    enabled: user?.role === "developer",
  });

  const { data: metrics } = useQuery<{ totalCreated: number; totalDeleted: number; monthlyBilling: number }>({
    queryKey: ["/api/developer/metrics"],
    enabled: user?.role === "developer",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [marketingFilter, setMarketingFilter] = useState(false);
  const [copiedEmailId, setCopiedEmailId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  const filteredOrgs = useMemo(() => {
    let list = organizations ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") {
      if (typeFilter === "free") list = list.filter(o => o.stripeCustomerId === "free_membership");
      else if (typeFilter === "promo") list = list.filter(o => !!o.stripeCustomerId?.startsWith("promo_"));
      else list = list.filter(o => o.tier === typeFilter && o.stripeCustomerId !== "free_membership" && !o.stripeCustomerId?.startsWith("promo_"));
    }
    if (marketingFilter) list = list.filter(o => o.marketingOptIn);
    return list;
  }, [organizations, searchQuery, typeFilter, marketingFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrgs.length / PAGE_SIZE));
  const paginatedOrgs = filteredOrgs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (cmsContent) {
      const merged: Record<string, string> = {};
      for (const f of CMS_FIELDS) {
        merged[f.key] = cmsContent[f.key] ?? CMS_DEFAULTS[f.key] ?? "";
      }
      setCmsValues(merged);
    } else {
      setCmsValues({ ...CMS_DEFAULTS });
    }
  }, [cmsContent]);

  const saveCmsMutation = useMutation({
    mutationFn: async (entries: Record<string, string>) => {
      const res = await apiRequest("PATCH", "/api/page-content", entries);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-content"] });
      toast({ title: "Saved", description: "Landing page content updated successfully." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/developer/impersonate/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Impersonation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/admin/dashboard";
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const togglePauseMutation = useMutation({
    mutationFn: async ({ orgId, newStatus }: { orgId: number; newStatus: "active" | "paused" }) => {
      const res = await apiRequest("PATCH", `/api/developer/organizations/${orgId}/status`, { status: newStatus });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      toast({ title: "Updated", description: `Organization ${variables.newStatus === "paused" ? "paused" : "reactivated"}.` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("DELETE", `/api/developer/organizations/${orgId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/metrics"] });
      toast({ title: "Deleted", description: "Organization has been removed." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const cancelSubMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("POST", `/api/developer/organizations/${orgId}/cancel-subscription`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/metrics"] });
      toast({ title: "Subscription Cancelled", description: "Stripe billing stopped and organization paused." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const { data: blogPosts, isLoading: blogLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    enabled: user?.role === "developer",
  });

  const saveBlogMutation = useMutation({
    mutationFn: async (data: Partial<BlogPost> & { isNew?: boolean }) => {
      const { isNew, id, createdAt, ...payload } = data as any;
      if (isNew) {
        const res = await apiRequest("POST", "/api/developer/blog", payload);
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/developer/blog/${id}`, payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setBlogForm(null);
      toast({ title: "Saved", description: "Blog post saved successfully." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteBlogMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/developer/blog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Deleted", description: "Blog post deleted." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const { data: referralCodes, isLoading: referralLoading } = useQuery<ReferralCode[]>({
    queryKey: ["/api/developer/referral-codes"],
    enabled: activeTab === "referrals",
  });

  const createRefCodeMutation = useMutation({
    mutationFn: async (data: { code: string; description: string; extraMonths: number }) => {
      const res = await apiRequest("POST", "/api/developer/referral-codes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/referral-codes"] });
      setRefCodeForm(null);
      toast({ title: "Created", description: "Referral code created." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleRefCodeMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/developer/referral-codes/${id}`, { active });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/developer/referral-codes"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRefCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/developer/referral-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/referral-codes"] });
      toast({ title: "Deleted", description: "Referral code deleted." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
  });

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user || user.role !== "developer") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Please sign in with developer credentials to continue.</p>
            <Button className="mt-4" onClick={() => setLocation("/developer")}>Go to Developer Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-gray-900 text-white border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" />
            <div>
              <span className="text-lg font-bold">Better Bucks</span>
              <Badge variant="outline" className="ml-2 text-secondary border-secondary text-xs">
                DEVELOPER
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              <Code2 className="inline h-4 w-4 mr-1" />
              {user.username}
            </span>
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-ga-dashboard"
            >
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
              >
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Analytics
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-dev-logout"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="text-dev-dashboard-title">
              Developer Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              {activeTab === "cms" ? "Edit landing page text and links." : activeTab === "blog" ? "Create and manage blog posts." : activeTab === "referrals" ? "Create and manage referral codes for signup discounts." : activeTab === "agreements" ? "View Terms of Service & Software License Agreement acceptance records." : "View all organizations and manage customer accounts."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={activeTab === "orgs" ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("orgs"); setBlogForm(null); }}
              data-testid="button-tab-orgs"
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Organizations
            </Button>
            <Button
              variant={activeTab === "cms" ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("cms"); setBlogForm(null); }}
              data-testid="button-tab-cms"
            >
              <FileEdit className="mr-1.5 h-4 w-4" />
              Edit Home Page
            </Button>
            <Button
              variant={activeTab === "blog" ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("blog"); setBlogForm(null); }}
              data-testid="button-tab-blog"
            >
              <BookOpen className="mr-1.5 h-4 w-4" />
              Blog
            </Button>
            <Button
              variant={activeTab === "referrals" ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("referrals"); setBlogForm(null); }}
              data-testid="button-tab-referrals"
            >
              <Tag className="mr-1.5 h-4 w-4" />
              Referral Codes
            </Button>
            <Button
              variant={activeTab === "agreements" ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("agreements"); setBlogForm(null); }}
              data-testid="button-tab-agreements"
            >
              <Shield className="mr-1.5 h-4 w-4" />
              Agreements
            </Button>
          </div>
        </div>

        <a
          href="https://analytics.google.com/analytics/web/"
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-6"
          data-testid="card-ga-analytics-link"
        >
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors cursor-pointer">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-600 text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900">Google Analytics 4</p>
                    <p className="text-sm text-blue-700">View traffic, user sessions, and page analytics for the Better Bucks website</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-blue-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </a>

        {activeTab === "blog" ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between flex gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Blog Posts
                </CardTitle>
                <CardDescription>
                  Manage blog content visible at /blog. Posts are public.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setBlogForm({ isNew: true, title: "", slug: "", excerpt: "", content: "", imageUrl: "", imageAlt: "", imageSource: "", authorName: "Better Bucks Team", authorPhotoUrl: "", sources: "[]", publishedAt: new Date() })}
                data-testid="button-new-blog-post"
                disabled={blogForm?.isNew === true}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Post
              </Button>
            </CardHeader>
            <CardContent>
              {blogForm && (
                <div className="mb-6 p-5 border rounded-xl bg-gray-50 space-y-4">
                  <h3 className="font-semibold text-gray-900 text-base">{blogForm.isNew ? "New Blog Post" : "Edit Blog Post"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Title *</Label>
                      <Input
                        value={blogForm.title ?? ""}
                        onChange={e => setBlogForm(p => ({ ...p!, title: e.target.value }))}
                        placeholder="How Better Bucks Transforms Teams"
                        data-testid="input-blog-title"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">URL Slug *</Label>
                      <Input
                        value={blogForm.slug ?? ""}
                        onChange={e => setBlogForm(p => ({ ...p!, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }))}
                        placeholder="how-better-bucks-transforms-teams"
                        data-testid="input-blog-slug"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-1.5 block text-sm font-medium">Excerpt (max 500 chars) *</Label>
                      <Textarea
                        rows={2}
                        value={blogForm.excerpt ?? ""}
                        onChange={e => setBlogForm(p => ({ ...p!, excerpt: e.target.value }))}
                        placeholder="A short summary shown on the blog listing page."
                        data-testid="input-blog-excerpt"
                        className="resize-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-1.5 block text-sm font-medium">Content (HTML) *</Label>
                      <Textarea
                        rows={10}
                        value={blogForm.content ?? ""}
                        onChange={e => setBlogForm(p => ({ ...p!, content: e.target.value }))}
                        placeholder="<p>Your full blog post HTML here...</p>"
                        data-testid="input-blog-content"
                        className="font-mono text-sm resize-y"
                      />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-1.5 block text-sm font-medium">Hero Image *</Label>
                        <div className="flex gap-2">
                          <Input
                            value={blogForm.imageUrl ?? ""}
                            onChange={e => setBlogForm(p => ({ ...p!, imageUrl: e.target.value }))}
                            placeholder="https://images.unsplash.com/... or upload →"
                            data-testid="input-blog-image-url"
                            className="flex-1 min-w-0"
                          />
                          <label className="shrink-0">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              data-testid="input-blog-image-upload"
                              disabled={blogImageUploading}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleBlogImageUpload(file);
                                e.target.value = "";
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10 px-3 pointer-events-none"
                              disabled={blogImageUploading}
                              data-testid="button-blog-image-upload"
                              asChild
                            >
                              <span>
                                {blogImageUploading
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Upload className="h-4 w-4" />}
                              </span>
                            </Button>
                          </label>
                        </div>
                        {(blogForm.imageUrl?.startsWith("/blog-images/") || blogForm.imageUrl?.startsWith("data:image/") || blogForm.imageUrl?.startsWith("http")) && (
                          <img
                            src={blogForm.imageUrl}
                            alt="Preview"
                            className="mt-2 h-20 w-full object-cover rounded-md border"
                          />
                        )}
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-sm font-medium">Image Alt Text</Label>
                        <Input
                          value={blogForm.imageAlt ?? ""}
                          onChange={e => setBlogForm(p => ({ ...p!, imageAlt: e.target.value }))}
                          placeholder="A team reviewing employee rewards data..."
                          data-testid="input-blog-image-alt"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Describes the image for screen readers and SEO.</p>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-sm font-medium">Image Source / Credit (optional)</Label>
                        <Input
                          value={blogForm.imageSource ?? ""}
                          onChange={e => setBlogForm(p => ({ ...p!, imageSource: e.target.value }))}
                          placeholder="Photo by John Smith via Unsplash"
                          data-testid="input-blog-image-source"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Displayed as a caption beneath the image.</p>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Author Name *</Label>
                      <Input
                        value={blogForm.authorName ?? ""}
                        onChange={e => setBlogForm(p => ({ ...p!, authorName: e.target.value }))}
                        placeholder="Better Bucks Team"
                        data-testid="input-blog-author-name"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Author Photo URL (optional)</Label>
                      <Input
                        value={blogForm.authorPhotoUrl ?? ""}
                        onChange={e => setBlogForm(p => ({ ...p!, authorPhotoUrl: e.target.value }))}
                        placeholder="https://..."
                        data-testid="input-blog-author-photo"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium">Publish Date</Label>
                      <Input
                        type="date"
                        value={blogForm.publishedAt ? new Date(blogForm.publishedAt).toISOString().split("T")[0] : ""}
                        onChange={e => setBlogForm(p => ({ ...p!, publishedAt: new Date(e.target.value) }))}
                        data-testid="input-blog-published-at"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-1.5 block text-sm font-medium">Sources (JSON array, optional)</Label>
                      <Textarea
                        rows={3}
                        value={blogForm.sources ?? "[]"}
                        onChange={e => setBlogForm(p => ({ ...p!, sources: e.target.value }))}
                        placeholder={'[{"label": "Source Name", "url": "https://..."}]'}
                        data-testid="input-blog-sources"
                        className="font-mono text-sm resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => setBlogForm(null)} data-testid="button-blog-cancel">Cancel</Button>
                    <Button
                      size="sm"
                      onClick={() => saveBlogMutation.mutate(blogForm!)}
                      disabled={saveBlogMutation.isPending}
                      data-testid="button-blog-save"
                    >
                      <Save className="mr-1.5 h-4 w-4" />
                      {saveBlogMutation.isPending ? "Saving..." : "Save Post"}
                    </Button>
                  </div>
                </div>
              )}

              {blogLoading ? (
                <div className="flex justify-center py-10"><Loader /></div>
              ) : !blogPosts || blogPosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No blog posts yet.</p>
                  <p className="text-sm mt-1">Click "New Post" to write your first one.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blogPosts.map(post => (
                      <TableRow key={post.id} data-testid={`row-blog-post-${post.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">{post.title}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{post.slug}</code>
                        </TableCell>
                        <TableCell className="text-sm">{post.authorName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBlogForm({ ...post, isNew: false })}
                              data-testid={`button-edit-blog-${post.id}`}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Delete "${post.title}"?`)) deleteBlogMutation.mutate(post.id);
                              }}
                              disabled={deleteBlogMutation.isPending}
                              data-testid={`button-delete-blog-${post.id}`}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : activeTab === "referrals" ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Referral Codes
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Codes entered on the signup page give customers extra free months. They are included in the lead notification email.
                  </CardDescription>
                </div>
                {!refCodeForm && (
                  <Button size="sm" onClick={() => setRefCodeForm({ code: "", description: "", extraMonths: 1 })} data-testid="button-new-referral-code">
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Code
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {refCodeForm && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                  <h3 className="font-semibold text-sm">Create New Referral Code</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="rc-code">Code</Label>
                      <Input
                        id="rc-code"
                        placeholder="e.g. PARTNER2025"
                        value={refCodeForm.code}
                        onChange={(e) => setRefCodeForm(p => ({ ...p!, code: e.target.value.toUpperCase() }))}
                        className="uppercase"
                        data-testid="input-referral-code-value"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rc-desc">Description (optional)</Label>
                      <Input
                        id="rc-desc"
                        placeholder="e.g. Partner referral"
                        value={refCodeForm.description}
                        onChange={(e) => setRefCodeForm(p => ({ ...p!, description: e.target.value }))}
                        data-testid="input-referral-code-description"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rc-months">Extra Free Months</Label>
                      <Input
                        id="rc-months"
                        type="number"
                        min={1}
                        max={12}
                        value={refCodeForm.extraMonths}
                        onChange={(e) => setRefCodeForm(p => ({ ...p!, extraMonths: parseInt(e.target.value) || 1 }))}
                        data-testid="input-referral-code-months"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!refCodeForm.code.trim() || createRefCodeMutation.isPending}
                      onClick={() => createRefCodeMutation.mutate(refCodeForm)}
                      data-testid="button-save-referral-code"
                    >
                      <Save className="mr-1.5 h-4 w-4" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRefCodeForm(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {referralLoading ? (
                <div className="flex justify-center py-8"><Loader /></div>
              ) : !referralCodes || referralCodes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Tag className="mx-auto h-10 w-10 mb-3 opacity-30" />
                  <p>No referral codes yet. Create one to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Extra Months</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralCodes.map((rc) => (
                      <TableRow key={rc.id} data-testid={`row-referral-code-${rc.id}`}>
                        <TableCell className="font-mono font-semibold text-sm">{rc.code}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{rc.description || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">+{rc.extraMonths} month{rc.extraMonths > 1 ? "s" : ""}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rc.active ? "default" : "secondary"} className={rc.active ? "bg-green-100 text-green-800 border-green-200" : ""}>
                            {rc.active ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(rc.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title={rc.active ? "Disable" : "Enable"}
                              onClick={() => toggleRefCodeMutation.mutate({ id: rc.id, active: !rc.active })}
                              data-testid={`button-toggle-referral-${rc.id}`}
                            >
                              {rc.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Delete"
                              onClick={() => { if (confirm(`Delete referral code "${rc.code}"?`)) deleteRefCodeMutation.mutate(rc.id); }}
                              data-testid={`button-delete-referral-${rc.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : activeTab === "cms" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Home Page Content Editor
              </CardTitle>
              <CardDescription>
                Changes are saved permanently and appear live on the public landing page immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {CMS_FIELDS.map((field) => (
                  <div key={field.key} className={field.multiline ? "md:col-span-2" : ""}>
                    <Label htmlFor={`cms-${field.key}`} className="mb-1.5 block text-sm font-medium">
                      {field.label}
                    </Label>
                    {field.multiline ? (
                      <Textarea
                        id={`cms-${field.key}`}
                        rows={3}
                        value={cmsValues[field.key] ?? ""}
                        onChange={(e) => setCmsValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        data-testid={`input-cms-${field.key}`}
                        className="resize-y"
                      />
                    ) : (
                      <Input
                        id={`cms-${field.key}`}
                        value={cmsValues[field.key] ?? ""}
                        onChange={(e) => setCmsValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        data-testid={`input-cms-${field.key}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => saveCmsMutation.mutate(cmsValues)}
                  disabled={saveCmsMutation.isPending}
                  data-testid="button-save-cms"
                >
                  {saveCmsMutation.isPending ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Loader />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Building2 className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Organizations</p>
                      <p className="text-2xl font-bold" data-testid="text-total-orgs">{organizations?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Shield className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Admins</p>
                      <p className="text-2xl font-bold" data-testid="text-total-admins">
                        {organizations?.reduce((sum, o) => sum + o.adminCount, 0) || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Users className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold" data-testid="text-total-employees">
                        {organizations?.reduce((sum, o) => sum + o.employeeCount, 0) || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={organizations?.some(o => o.status === "paused") ? "border-amber-300 bg-amber-50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-amber-100">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paused Accounts</p>
                      <p className="text-2xl font-bold text-amber-600" data-testid="text-paused-orgs">
                        {organizations?.filter(o => o.status === "paused").length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Platform metrics row ─────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-green-100">
                      <PlusCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accounts Created (all time)</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-total-created">{metrics?.totalCreated ?? "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-red-100">
                      <UserX className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accounts Deleted (all time)</p>
                      <p className="text-2xl font-bold text-red-500" data-testid="text-total-deleted">{metrics?.totalDeleted ?? "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-secondary/10">
                      <DollarSign className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Est. Monthly Billing</p>
                      <p className="text-2xl font-bold" style={{ color: "var(--secondary)" }} data-testid="text-monthly-billing">
                        {metrics ? `$${metrics.monthlyBilling.toFixed(2)}/mo` : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {organizations?.some(o => o.status === "paused") && (
              <Card className="mb-8 border-amber-300 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                    Paused Organizations
                  </CardTitle>
                  <CardDescription>
                    These organizations have payment issues and their users are currently blocked from using the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Organization Owner</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {organizations.filter(o => o.status === "paused").map((org) => (
                          <TableRow key={org.id} data-testid={`row-paused-org-${org.id}`}>
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-amber-100 px-1.5 py-0.5 rounded">{org.code}</code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tierLabels[org.tier] || org.tier}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {org.primeAdmin ? (
                                <div>
                                  <div className="font-medium">{org.primeAdmin.fullName}</div>
                                  <div className="text-xs text-muted-foreground">{org.primeAdmin.username}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Not set up</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">{org.totalUsers}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => togglePauseMutation.mutate({ orgId: org.id, newStatus: "active" })}
                                  disabled={togglePauseMutation.isPending}
                                  data-testid={`button-reactivate-org-${org.id}`}
                                >
                                  <Play className="mr-1.5 h-3 w-3" />
                                  Reactivate
                                </Button>
                                {org.primeAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => impersonateMutation.mutate(org.primeAdmin!.id)}
                                    disabled={impersonateMutation.isPending}
                                    data-testid={`button-enter-paused-org-${org.id}`}
                                  >
                                    <LogIn className="mr-1.5 h-3 w-3" />
                                    Enter
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  All Organizations
                </CardTitle>
                <CardDescription>
                  Click "Enter" to impersonate an organization and view their account.
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or code…"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="pl-9"
                      data-testid="input-search-orgs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400 shrink-0" />
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                      className="border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      data-testid="select-type-filter"
                    >
                      <option value="all">All Types</option>
                      <option value="free">Free</option>
                      <option value="promo">Promo</option>
                      <option value="small">Small ($49.99/mo)</option>
                      <option value="mid">Mid ($99.99/mo)</option>
                      <option value="large">Large ($149.99/mo)</option>
                      <option value="enterprise">Enterprise ($299.99/mo)</option>
                    </select>
                  </div>
                  <Button
                    variant={marketingFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setMarketingFilter(v => !v); setCurrentPage(1); }}
                    data-testid="button-filter-marketing"
                    className="whitespace-nowrap"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Marketing opt-in{marketingFilter ? ` (${filteredOrgs.length})` : ""}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Monthly Cost</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Admins</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Organization Owner</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrgs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                            {searchQuery || typeFilter !== "all" ? "No organizations match your filters." : "No organizations found."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrgs.map((org) => {
                          const isFree = org.stripeCustomerId === "free_membership" || org.stripeCustomerId?.startsWith("promo_");
                          return (
                            <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                              <TableCell className="font-medium">{org.name}</TableCell>
                              <TableCell>
                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{org.code}</code>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{tierLabels[org.tier] || org.tier}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {isFree ? "Free" : `$${tierPrices[org.tier] || 0}/mo`}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={org.status === "active" ? "default" : "destructive"}
                                  className={`capitalize ${org.status === "paused" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                                  data-testid={`badge-status-org-${org.id}`}
                                >
                                  {org.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium">{org.adminCount}</TableCell>
                              <TableCell className="text-center font-medium">{org.employeeCount}</TableCell>
                              <TableCell className="text-sm">
                                {org.primeAdmin ? (
                                  <div className="space-y-0.5">
                                    <div className="font-medium">{org.primeAdmin.fullName}</div>
                                    <div className="text-xs text-muted-foreground">{org.primeAdmin.username}</div>
                                    {org.primeAdmin.email && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">{org.primeAdmin.email}</span>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(org.primeAdmin!.email!);
                                            setCopiedEmailId(org.id);
                                            setTimeout(() => setCopiedEmailId(null), 1500);
                                          }}
                                          className="p-0.5 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                          data-testid={`button-copy-email-${org.id}`}
                                          title="Copy email"
                                        >
                                          {copiedEmailId === org.id
                                            ? <Check className="h-3 w-3 text-green-600" />
                                            : <Copy className="h-3 w-3" />}
                                        </button>
                                      </div>
                                    )}
                                    {org.marketingOptIn && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5 mt-0.5">
                                        <Mail className="h-2.5 w-2.5" />
                                        Marketing
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Not set up</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {org.primeAdmin && (org.status === "active" || org.status === "paused") ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => impersonateMutation.mutate(org.primeAdmin!.id)}
                                      disabled={impersonateMutation.isPending}
                                      data-testid={`button-enter-org-${org.id}`}
                                    >
                                      <LogIn className="mr-1.5 h-3 w-3" />
                                      Enter
                                    </Button>
                                  ) : !org.primeAdmin && (org.status === "active" || org.status === "paused") ? (
                                    <span className="text-xs text-muted-foreground">No owner set</span>
                                  ) : null}
                                  {org.status === "active" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                      onClick={() => togglePauseMutation.mutate({ orgId: org.id, newStatus: "paused" })}
                                      disabled={togglePauseMutation.isPending}
                                      data-testid={`button-pause-org-${org.id}`}
                                    >
                                      <Pause className="mr-1.5 h-3 w-3" />
                                      Pause
                                    </Button>
                                  )}
                                  {org.status === "paused" && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => togglePauseMutation.mutate({ orgId: org.id, newStatus: "active" })}
                                      disabled={togglePauseMutation.isPending}
                                      data-testid={`button-reactivate-org-${org.id}`}
                                    >
                                      <Play className="mr-1.5 h-3 w-3" />
                                      Reactivate
                                    </Button>
                                  )}
                                  {org.status === "active" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-amber-700 border-amber-400 hover:bg-amber-50"
                                      onClick={() => {
                                        const hasPaidSub = !isFree && org.stripeSubscriptionId && org.stripeSubscriptionId !== "pending_checkout";
                                        const msg = hasPaidSub
                                          ? `Cancel subscription for "${org.name}"? This will stop Stripe billing and immediately pause all users' access. Data is preserved.`
                                          : `Pause "${org.name}"? All users will lose access. Data is preserved.`;
                                        if (confirm(msg)) cancelSubMutation.mutate(org.id);
                                      }}
                                      disabled={cancelSubMutation.isPending}
                                      data-testid={`button-cancel-sub-org-${org.id}`}
                                    >
                                      <XCircle className="mr-1.5 h-3 w-3" />
                                      Cancel Sub
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      if (confirm(`Delete "${org.name}"? It will be hidden from the dashboard but data is preserved for auditing.`)) {
                                        deleteMutation.mutate(org.id);
                                      }
                                    }}
                                    disabled={deleteMutation.isPending}
                                    data-testid={`button-delete-org-${org.id}`}
                                  >
                                    <Trash2 className="mr-1.5 h-3 w-3" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {filteredOrgs.length === 0
                        ? "No results"
                        : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredOrgs.length)} of ${filteredOrgs.length}`}
                    </p>
                    {marketingFilter && filteredOrgs.length > 0 && (() => {
                      const emails = filteredOrgs.flatMap(o => o.primeAdmin?.email ? [o.primeAdmin.email] : []);
                      if (emails.length === 0) return null;
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => {
                            navigator.clipboard.writeText(emails.join(", "));
                            toast({ title: "Emails copied", description: `${emails.length} email${emails.length > 1 ? "s" : ""} copied to clipboard.` });
                          }}
                          data-testid="button-copy-all-marketing-emails"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy all {emails.length} emails
                        </Button>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
        {activeTab === "agreements" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                License Agreement Records
              </CardTitle>
              <CardDescription>
                Organizations that have accepted the Terms of Service &amp; Software License Agreement at signup. Organizations created before this feature was launched will show no acceptance date.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agreement Accepted</TableHead>
                      <TableHead>Account Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader />
                        </TableCell>
                      </TableRow>
                    ) : (organizations ?? []).filter(o => o.status !== "deleted").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No organizations found.</TableCell>
                      </TableRow>
                    ) : (
                      (organizations ?? [])
                        .filter(o => o.status !== "deleted" && !o.isDemo)
                        .sort((a, b) => {
                          if (a.licenseAcceptedAt && b.licenseAcceptedAt) return new Date(b.licenseAcceptedAt).getTime() - new Date(a.licenseAcceptedAt).getTime();
                          if (a.licenseAcceptedAt) return -1;
                          if (b.licenseAcceptedAt) return 1;
                          return 0;
                        })
                        .map(org => (
                          <TableRow key={org.id} data-testid={`row-agreement-${org.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{org.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{org.code}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tierLabels[org.tier] ?? org.tier}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={org.status === "active" ? "default" : "secondary"}>{org.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {org.licenseAcceptedAt ? (
                                <div>
                                  <p className="text-sm font-medium text-green-700">
                                    {new Date(org.licenseAcceptedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(org.licenseAcceptedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Before feature launch</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">
                                {new Date(org.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
