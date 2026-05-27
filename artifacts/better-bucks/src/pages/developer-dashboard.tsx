import { useState, useEffect, useMemo, useRef } from "react";
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
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";
import { Building2, Users, LogOut, LogIn, Code2, Trash2, AlertTriangle, Play, Pause, FileEdit, Save, BarChart3, ExternalLink, Search, ChevronLeft, ChevronRight, TrendingUp, DollarSign, PlusCircle, UserX, Filter, XCircle, BookOpen, Plus, Pencil, Calendar, ImageIcon, Upload, Loader2, Tag, ToggleLeft, ToggleRight, Copy, Check, Mail, Bot, Send, RotateCcw, Download, Megaphone, CreditCard, CheckCircle2, Clock, AlertOctagon, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import type { Organization, BlogPost, ReferralCode } from "@shared/schema";

const RESOLUTION_NOTE_TRUNCATE_AT = 60;

function ExpandableNote({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.length > RESOLUTION_NOTE_TRUNCATE_AT;
  if (!isLong) {
    return <span>{note}</span>;
  }
  return (
    <span>
      {expanded ? note : note.slice(0, RESOLUTION_NOTE_TRUNCATE_AT) + "…"}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Show less of resolution note" : "Show full resolution note"}
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-primary underline underline-offset-2 hover:no-underline focus:outline-none whitespace-nowrap"
      >
        {expanded ? "show less" : "show more"}
      </button>
    </span>
  );
}

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
  pendingOrderCount: number;
};

const tierLabels: Record<string, string> = {
  small: "A Little Better",
  mid: "Much Better",
  large: "A LOT Better",
  enterprise: "How much Better?",
};

const tierPrices: Record<string, number> = {
  small: 18,
  mid: 30,
  large: 48,
  enterprise: 0,
  starter: 55,
  growth: 155,
  pro: 305,
};

export default function DeveloperDashboardPage() {
  const { data: user, isLoading: userLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cmsValues, setCmsValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"orgs" | "cms" | "blog" | "referrals" | "enterprise" | "inbox" | "claude" | "marketing" | "stripe-orphans" | "orders">("orgs");
  const [ordersOrgFilter, setOrdersOrgFilter] = useState<string>("");
  const [msgOrderId, setMsgOrderId] = useState<number | null>(null);
  const [msgRecipient, setMsgRecipient] = useState<"employee" | "org">("employee");
  const [msgText, setMsgText] = useState("");
  const [blogForm, setBlogForm] = useState<Partial<BlogPost> & { isNew?: boolean } | null>(null);
  const [refCodeForm, setRefCodeForm] = useState<{ code: string; description: string; extraMonths: number } | null>(null);
  const [blogImageUploading, setBlogImageUploading] = useState(false);

  // Claude coding agent state
  type ToolStep = { name: string; input: Record<string, any>; output?: string; status: "running" | "done" };
  type ChatMessage = { role: "user" | "assistant"; content: string; toolSteps?: ToolStep[] };
  const [claudeMessages, setClaudeMessages] = useState<ChatMessage[]>([]);
  const [claudeInput, setClaudeInput] = useState("");
  const [claudeStreaming, setClaudeStreaming] = useState(false);
  const claudeBottomRef = useRef<HTMLDivElement>(null);
  const claudeAbortRef = useRef<AbortController | null>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const [showMcpToken, setShowMcpToken] = useState(false);
  const [copiedMcpUrl, setCopiedMcpUrl] = useState(false);
  const [copiedMcpToken, setCopiedMcpToken] = useState(false);

  const { data: mcpConfig } = useQuery<{ url: string; token: string | null }>({
    queryKey: ["/api/developer/mcp-config"],
    enabled: activeTab === "claude",
    staleTime: Infinity,
  });

  function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    claudeBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [claudeMessages, claudeStreaming]);

  function toggleToolExpand(key: string) {
    setExpandedTools(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function sendToClaud() {
    const text = claudeInput.trim();
    if (!text || claudeStreaming) return;

    // Only pass text-role messages to backend (tool steps are UI-only)
    const history = claudeMessages.map(m => ({ role: m.role, content: m.content }));
    const newMessages = [...history, { role: "user" as const, content: text }];

    setClaudeMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "", toolSteps: [] }]);
    setClaudeInput("");
    setClaudeStreaming(true);

    const abortController = new AbortController();
    claudeAbortRef.current = abortController;

    try {
      const resp = await fetch("/api/developer/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: newMessages }),
        signal: abortController.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || "Request failed");
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "text") {
              setClaudeMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + evt.text };
                }
                return updated;
              });
            } else if (evt.type === "tool_start") {
              setClaudeMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  const steps = [...(last.toolSteps ?? []), { name: evt.name, input: evt.input, status: "running" as const }];
                  updated[updated.length - 1] = { ...last, toolSteps: steps };
                }
                return updated;
              });
            } else if (evt.type === "tool_result") {
              setClaudeMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  const steps = (last.toolSteps ?? []).map((s, i) =>
                    i === (last.toolSteps!.length - 1) && s.status === "running"
                      ? { ...s, output: evt.output, status: "done" as const }
                      : s
                  );
                  updated[updated.length - 1] = { ...last, toolSteps: steps };
                }
                return updated;
              });
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          } catch (parseErr: any) {
            if (parseErr?.message && parseErr.message !== "Unexpected end of JSON input") {
              setClaudeMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${parseErr.message}` };
                }
                return updated;
              });
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setClaudeMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content || `⚠️ ${err?.message || "Something went wrong."}` };
          }
          return updated;
        });
      }
    } finally {
      setClaudeStreaming(false);
      claudeAbortRef.current = null;
    }
  }

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

  const [deleteDialog, setDeleteDialog] = useState<{ orgId: number; orgName: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<OrgWithStats | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async ({ orgId, orgName, reason }: { orgId: number; orgName: string; reason: string }) => {
      const res = await apiRequest("DELETE", `/api/developer/organizations/${orgId}`, { confirmOrgName: orgName, reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/metrics"] });
      toast({ title: "Deleted", description: "Organization has been removed and notification email sent." });
      setDeleteDialog(null);
      setDeleteReason("");
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

  type MarketingSubscriber = { name: string; email: string | null; source: string; orgName: string | null; role: string | null; dateOptedIn: string | null };
  const { data: marketingSubscribers, isLoading: marketingLoading } = useQuery<MarketingSubscriber[]>({
    queryKey: ["/api/developer/marketing-subscribers"],
    enabled: activeTab === "marketing",
  });

  type DevOrder = {
    id: number; description: string; photoUrls: string[] | null; itemUrl: string | null;
    selectedSize: string | null; selectedColor: string | null; quantity: number; pointsCost: number;
    convertedValue: string | null; status: string; adminNotes: string | null; createdAt: string;
    orgId: number; orgName: string; orgCode: string;
    user: { id: number; fullName: string; email: string | null; username: string };
    shippingAddress: { line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null; country: string | null };
  };
  const { data: devOrders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<DevOrder[]>({
    queryKey: ["/api/developer/orders", ordersOrgFilter],
    queryFn: async () => {
      const url = ordersOrgFilter ? `/api/developer/orders?orgId=${ordersOrgFilter}` : "/api/developer/orders";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: activeTab === "orders",
    staleTime: 0,
  });

  const fulfillOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("PATCH", `/api/developer/orders/${orderId}/fulfill`);
      return res.json();
    },
    onSuccess: () => {
      void refetchOrders();
      toast({ title: "Order Fulfilled", description: "Marked as completed and confirmation email sent." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const sendOrderMessageMutation = useMutation({
    mutationFn: async ({ orderId, recipient, message }: { orderId: number; recipient: "employee" | "org"; message: string }) => {
      const res = await apiRequest("POST", `/api/developer/orders/${orderId}/message`, { recipient, message });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Message sent", description: `Email delivered to ${data.to}.` });
      setMsgOrderId(null);
      setMsgText("");
    },
    onError: (e: Error) => {
      toast({ title: "Failed to send message", description: e.message, variant: "destructive" });
    },
  });

  type StripeOrphanRow = { id: number; stripeCustomerId: string | null; stripeSubscriptionId: string | null; status: string; retryCount: number; lastError: string | null; resolutionNote: string | null; createdAt: string; updatedAt: string };
  type StripeOrphansData = { rows: StripeOrphanRow[]; counts: Record<string, number> };
  const { data: stripeOrphansData, isLoading: stripeOrphansLoading, refetch: refetchStripeOrphans } = useQuery<StripeOrphansData>({
    queryKey: ["/api/developer/stripe-orphans"],
    enabled: user?.role === "developer",
  });
  const permanentlyFailedCount = stripeOrphansData?.counts["failed_permanently"] ?? 0;
  const [orphanBannerDismissed, setOrphanBannerDismissed] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveOrphanId, setResolveOrphanId] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [orphanSearch, setOrphanSearch] = useState("");
  const [orphanStatusFilter, setOrphanStatusFilter] = useState<string | null>(null);
  const [orphanDateFrom, setOrphanDateFrom] = useState("");
  const [orphanDateTo, setOrphanDateTo] = useState("");

  const filteredOrphanRows = useMemo(() => {
    if (!stripeOrphansData?.rows) return [];
    const q = orphanSearch.trim().toLowerCase();
    return stripeOrphansData.rows.filter((r) => {
      if (orphanStatusFilter && r.status !== orphanStatusFilter) return false;
      if (q && !(r.stripeCustomerId?.toLowerCase().includes(q) || r.stripeSubscriptionId?.toLowerCase().includes(q))) return false;
      if (orphanDateFrom && new Date(r.createdAt) < new Date(orphanDateFrom)) return false;
      if (orphanDateTo && new Date(r.createdAt) > new Date(orphanDateTo + "T23:59:59")) return false;
      return true;
    });
  }, [stripeOrphansData, orphanSearch, orphanStatusFilter, orphanDateFrom, orphanDateTo]);
  const resolveOrphanMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      await apiRequest("PATCH", `/api/developer/stripe-orphans/${id}`, { note: note.trim() || null });
    },
    onSuccess: () => {
      toast({ title: "Marked resolved", description: "The record has been marked as resolved." });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/stripe-orphans"] });
      setResolveDialogOpen(false);
      setResolveOrphanId(null);
      setResolveNote("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark record as resolved.", variant: "destructive" });
    },
  });

  const retryOrphanMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/developer/stripe-orphans/${id}/retry`, {});
      return res.json() as Promise<{ status: string }>;
    },
    onSuccess: (data) => {
      const label = data.status === "resolved" ? "Resolved" : data.status === "failed_permanently" ? "Still failing" : "Retried";
      toast({ title: label, description: `Retry complete — new status: ${data.status}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/stripe-orphans"] });
    },
    onError: (e: Error) => {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    },
  });

  function downloadMarketingCsv(rows: MarketingSubscriber[]) {
    const headers = ["Name", "Email", "Organization", "Role", "Source", "Date Opted In"];
    const escape = (v: string | null | undefined) => {
      const s = v ?? "";
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...rows.map(r => [
        escape(r.name),
        escape(r.email),
        escape(r.orgName),
        escape(r.role),
        escape(r.source),
        escape(r.dateOptedIn ? new Date(r.dateOptedIn).toLocaleDateString("en-US") : ""),
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marketing-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        {permanentlyFailedCount > 0 && !orphanBannerDismissed && (
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800" role="alert" data-testid="banner-orphan-alert">
            <AlertOctagon className="h-5 w-5 shrink-0 text-red-600" />
            <p className="flex-1 text-sm font-medium">
              <span className="font-bold">{permanentlyFailedCount} Stripe orphan{permanentlyFailedCount !== 1 ? "s" : ""}</span> permanently failed and need manual cleanup in Stripe.
            </p>
            <button
              aria-label="Dismiss"
              onClick={() => setOrphanBannerDismissed(true)}
              className="ml-auto p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700"
              data-testid="banner-orphan-dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="text-dev-dashboard-title">
              Developer Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              View all organizations and manage customer accounts.
            </p>
          </div>
        </div>


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
                        type="number" inputMode="numeric"
                        min={0}
                        max={12}
                        value={refCodeForm.extraMonths}
                        onChange={(e) => { const v = parseInt(e.target.value); setRefCodeForm(p => ({ ...p!, extraMonths: isNaN(v) ? 0 : v })); }}
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
                          <Badge variant="secondary">{rc.extraMonths === 0 ? "No extra months" : `+${rc.extraMonths} month${rc.extraMonths > 1 ? "s" : ""}`}</Badge>
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
            {/* ── Summary stats ─────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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

            {/* ── Demo Account quick-access ─────────────────── */}
            {(() => {
              const demoOrg = organizations?.find(o => o.code === "VIEWDEMO");
              if (!demoOrg) return null;
              return (
                <Card className="mb-8 border-blue-200 bg-blue-50/40">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-blue-100">
                          <Play className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-blue-900">Self-Guided Demo Account</p>
                          <p className="text-xs text-blue-600/80 mt-0.5">
                            Code: <span className="font-mono font-semibold">VIEWDEMO</span>
                            {" · "}{demoOrg.totalUsers} users
                            {demoOrg.primeAdmin && <> · Owner: <span className="font-medium">{demoOrg.primeAdmin.username}</span></>}
                          </p>
                        </div>
                      </div>
                      {demoOrg.primeAdmin && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => impersonateMutation.mutate(demoOrg.primeAdmin!.id)}
                          disabled={impersonateMutation.isPending}
                          data-testid="button-enter-demo"
                        >
                          <LogIn className="mr-1.5 h-3.5 w-3.5" />
                          Enter Demo
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

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
                              <div className="flex flex-col gap-1">
                                <code className="text-xs bg-amber-100 px-1.5 py-0.5 rounded">{org.code}</code>
                                {org.pendingOrderCount > 0 && (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border border-amber-300 text-xs w-fit" data-testid={`badge-pending-orders-${org.id}`}>
                                    {org.pendingOrderCount} to fulfill
                                  </Badge>
                                )}
                              </div>
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
                      type="search"
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
                      <option value="small">Small ($18/mo)</option>
                      <option value="mid">Mid ($30/mo)</option>
                      <option value="large">Large ($48/mo)</option>
                      <option value="enterprise">Enterprise (custom)</option>
                      <option value="starter">Starter – 5,000 Bucks ($55/mo)</option>
                      <option value="growth">Growth – 15,000 Bucks ($155/mo)</option>
                      <option value="pro">Pro – 30,000 Bucks ($305/mo)</option>
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
                            <TableRow
                              key={org.id}
                              data-testid={`row-org-${org.id}`}
                              className="cursor-pointer hover:bg-muted/60 transition-colors"
                              onClick={() => setSelectedOrg(org)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-1.5">
                                  {org.licenseAcceptedAt
                                    ? <span title={`Agreement signed ${new Date(org.licenseAcceptedAt).toLocaleDateString()}`} className="text-green-600 text-base leading-none">✓</span>
                                    : <span title="No license agreement on record" className="text-red-500 text-base leading-none">✗</span>
                                  }
                                  {org.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{org.code}</code>
                                  {org.pendingOrderCount > 0 && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border border-amber-300 text-xs w-fit" data-testid={`badge-pending-orders-${org.id}`}>
                                      {org.pendingOrderCount} to fulfill
                                    </Badge>
                                  )}
                                </div>
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
                                          onClick={(e) => {
                                            e.stopPropagation();
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
                                      onClick={(e) => { e.stopPropagation(); impersonateMutation.mutate(org.primeAdmin!.id); }}
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
                                      onClick={(e) => { e.stopPropagation(); togglePauseMutation.mutate({ orgId: org.id, newStatus: "paused" }); }}
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
                                      onClick={(e) => { e.stopPropagation(); togglePauseMutation.mutate({ orgId: org.id, newStatus: "active" }); }}
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
                                      onClick={(e) => {
                                        e.stopPropagation();
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteReason("");
                                      setDeleteDialog({ orgId: org.id, orgName: org.name });
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

        {activeTab === "enterprise" && <EnterpriseAccountsTab />}

        {activeTab === "orders" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-600" />
                Orders to Fulfill
              </CardTitle>
              <CardDescription>
                Approved orders across all organizations, ready to be purchased and shipped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-5">
                <Label htmlFor="orders-org-filter" className="shrink-0 text-sm font-medium">Filter by org:</Label>
                <select
                  id="orders-org-filter"
                  value={ordersOrgFilter}
                  onChange={e => setOrdersOrgFilter(e.target.value)}
                  className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid="select-orders-org-filter"
                >
                  <option value="">All Organizations</option>
                  {(organizations ?? []).map(o => (
                    <option key={o.id} value={String(o.id)}>{o.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => void refetchOrders()} disabled={ordersLoading}>
                  <RefreshCw className={`h-4 w-4 ${ordersLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {ordersLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !devOrders || devOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                  <p className="text-sm font-medium">No pending orders to fulfill</p>
                  <p className="text-xs">All approved orders have been processed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {devOrders.map(order => {
                    const addr = order.shippingAddress;
                    const hasAddress = addr.line1 || addr.city;
                    const addressStr = [addr.line1, addr.line2, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(", ");
                    const photo = order.photoUrls?.[0];
                    return (
                      <div key={order.id} className="border border-border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors">
                        <div className="flex gap-4">
                          {photo && (
                            <img src={photo} alt={order.description} className="h-20 w-20 rounded-lg object-cover shrink-0 border border-border" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <p className="font-semibold text-sm text-foreground leading-snug">{order.description}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{order.orgName}</Badge>
                                  <span className="text-xs text-muted-foreground">Order #{order.id}</span>
                                  <span className="text-xs text-muted-foreground">{order.pointsCost} Bucks</span>
                                  {order.convertedValue && <span className="text-xs text-muted-foreground">≈ {order.convertedValue}</span>}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  onClick={() => fulfillOrderMutation.mutate(order.id)}
                                  disabled={fulfillOrderMutation.isPending}
                                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white"
                                  data-testid={`button-fulfill-order-${order.id}`}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  Mark Fulfilled
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setMsgOrderId(order.id); setMsgRecipient("employee"); setMsgText(""); }}
                                  data-testid={`button-message-order-${order.id}`}
                                >
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  Message
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                              <div>
                                <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">Employee</p>
                                <p className="font-medium text-foreground">{order.user.fullName}</p>
                                {order.user.email && <p className="text-muted-foreground">{order.user.email}</p>}
                              </div>
                              <div>
                                <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">Ship To</p>
                                {hasAddress ? (
                                  <p className="text-foreground whitespace-pre-line">{addressStr}</p>
                                ) : (
                                  <p className="text-amber-600 italic">No shipping address on file</p>
                                )}
                              </div>
                              {(order.selectedSize || order.selectedColor || order.quantity > 1) && (
                                <div>
                                  <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">Details</p>
                                  <p className="text-foreground">
                                    {[order.selectedSize && `Size: ${order.selectedSize}`, order.selectedColor && `Color: ${order.selectedColor}`, order.quantity > 1 && `Qty: ${order.quantity}`].filter(Boolean).join(" · ")}
                                  </p>
                                </div>
                              )}
                              {order.itemUrl && (
                                <div>
                                  <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">Item Link</p>
                                  <a href={order.itemUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-all">
                                    View item <ExternalLink className="inline h-3 w-3 ml-0.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Message order dialog ── */}
        {msgOrderId !== null && (
          <Dialog open onOpenChange={open => { if (!open) setMsgOrderId(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send message about Order #{msgOrderId}</DialogTitle>
                <DialogDescription>
                  Email will be sent to the selected recipient via Better Bucks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant={msgRecipient === "employee" ? "default" : "outline"}
                    onClick={() => setMsgRecipient("employee")}
                  >
                    Employee
                  </Button>
                  <Button
                    size="sm"
                    variant={msgRecipient === "org" ? "default" : "outline"}
                    onClick={() => setMsgRecipient("org")}
                  >
                    Org owner
                  </Button>
                </div>
                <Textarea
                  rows={5}
                  placeholder="Type your message here…"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  data-testid="textarea-order-message"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMsgOrderId(null)}>Cancel</Button>
                <Button
                  onClick={() => sendOrderMessageMutation.mutate({ orderId: msgOrderId, recipient: msgRecipient, message: msgText })}
                  disabled={!msgText.trim() || sendOrderMessageMutation.isPending}
                  data-testid="button-send-order-message"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {sendOrderMessageMutation.isPending ? "Sending…" : "Send"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {activeTab === "inbox" && <InboxTab />}

        {activeTab === "claude" && (
          <Card className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
            <CardHeader className="flex-row items-center justify-between gap-4 pb-3 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-600 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Claude Coding Agent</CardTitle>
                  <CardDescription className="text-xs">claude-opus-4-5 · reads &amp; writes source files</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMcpPanel(p => !p)}
                  className="text-violet-700 border-violet-200 hover:bg-violet-50"
                  data-testid="button-mcp-toggle"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  claude.ai
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setClaudeMessages([]); setClaudeInput(""); }}
                  disabled={claudeStreaming}
                  data-testid="button-claude-clear"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  New chat
                </Button>
              </div>
            </CardHeader>

            {showMcpPanel && (
              <div className="shrink-0 border-b bg-violet-50 px-4 py-3" data-testid="mcp-panel">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-violet-900">Connect to claude.ai</p>
                    <p className="text-xs text-violet-700 mt-0.5">Add this as an integration in claude.ai so you can prompt Claude there and have it read &amp; write your source files.</p>
                  </div>
                  <button onClick={() => setShowMcpPanel(false)} className="text-violet-400 hover:text-violet-600 mt-0.5 shrink-0" data-testid="button-mcp-close">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-violet-800 mb-1">Step 1 — Copy the server URL</p>
                    <div className="flex items-center gap-2 bg-white border border-violet-200 rounded-lg px-3 py-1.5">
                      <code className="text-xs text-gray-700 flex-1 truncate" data-testid="text-mcp-url">{mcpConfig?.url ?? "Loading…"}</code>
                      <button
                        onClick={() => mcpConfig?.url && copyToClipboard(mcpConfig.url, setCopiedMcpUrl)}
                        className="shrink-0 text-violet-500 hover:text-violet-700"
                        data-testid="button-copy-mcp-url"
                      >
                        {copiedMcpUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-violet-800 mb-1">Step 2 — Copy the auth token</p>
                    <div className="flex items-center gap-2 bg-white border border-violet-200 rounded-lg px-3 py-1.5">
                      <code className="text-xs text-gray-700 flex-1 truncate" data-testid="text-mcp-token">
                        {mcpConfig?.token
                          ? showMcpToken
                            ? mcpConfig.token
                            : mcpConfig.token.slice(0, 4) + "••••••••••••••••••••••••••••"
                          : "Not configured"}
                      </code>
                      <button
                        onClick={() => setShowMcpToken(p => !p)}
                        className="shrink-0 text-violet-400 hover:text-violet-600 text-xs"
                        data-testid="button-toggle-mcp-token"
                      >
                        {showMcpToken ? "hide" : "show"}
                      </button>
                      <button
                        onClick={() => mcpConfig?.token && copyToClipboard(mcpConfig.token, setCopiedMcpToken)}
                        className="shrink-0 text-violet-500 hover:text-violet-700"
                        data-testid="button-copy-mcp-token"
                      >
                        {copiedMcpToken ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-violet-700">
                    <span className="font-medium">Step 3</span> — In claude.ai, go to <span className="font-medium">Settings → Integrations → Add integration</span>, paste the URL, choose "Bearer token" auth, and paste the token.
                  </p>
                </div>
              </div>
            )}

            <CardContent className="flex-1 overflow-y-auto py-4 space-y-4" data-testid="claude-message-list">
              {claudeMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                  <Bot className="h-12 w-12 text-violet-300" />
                  <div>
                    <p className="font-semibold text-gray-800">Claude Coding Agent</p>
                    <p className="text-sm text-gray-500 mt-1">Can read, write, and search your source files</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {[
                      "List all files in server/",
                      "Read server/routes.ts lines 1-50",
                      "Add a data-testid to the logout button in layout-admin.tsx",
                      "Search for all TODO comments in the codebase",
                    ].map(s => (
                      <button
                        key={s}
                        onClick={() => setClaudeInput(s)}
                        className="text-xs px-3 py-1.5 rounded-full border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors"
                        data-testid="button-claude-starter"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {claudeMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`claude-message-${i}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center mt-0.5">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[82%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {msg.role === "assistant" && (msg.toolSteps ?? []).map((step, si) => {
                      const toolKey = `${i}-${si}`;
                      const isExpanded = expandedTools[toolKey];
                      const toolIcon: Record<string, string> = {
                        read_file: "📖", write_file: "✏️", list_directory: "📁",
                        search_code: "🔍", run_command: "⚡",
                      };
                      const pathLabel = step.input.path ?? step.input.command ?? step.input.pattern ?? "";
                      return (
                        <div key={si} className="w-full">
                          <button
                            onClick={() => toggleToolExpand(toolKey)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono w-full text-left transition-colors ${
                              step.status === "running"
                                ? "bg-amber-50 border border-amber-200 text-amber-800"
                                : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                            }`}
                            data-testid={`tool-step-${i}-${si}`}
                          >
                            <span>{toolIcon[step.name] ?? "🔧"}</span>
                            <span className="font-semibold">{step.name}</span>
                            {pathLabel && <span className="text-gray-400 truncate max-w-[200px]">{pathLabel}</span>}
                            {step.status === "running" && <Loader2 className="h-3 w-3 ml-auto animate-spin text-amber-500 shrink-0" />}
                            {step.status === "done" && step.output && (
                              <span className="ml-auto text-gray-400 shrink-0">{isExpanded ? "▲" : "▼"}</span>
                            )}
                          </button>
                          {isExpanded && step.output && (
                            <pre className="mt-1 p-2 bg-gray-900 text-green-400 text-xs rounded-lg overflow-x-auto max-h-48 font-mono leading-relaxed whitespace-pre-wrap">
                              {step.output}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                    {(msg.content || (msg.role === "assistant" && claudeStreaming && i === claudeMessages.length - 1)) && (
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed w-full ${
                          msg.role === "user"
                            ? "bg-[#162A4A] text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-900 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                        {msg.role === "assistant" && claudeStreaming && i === claudeMessages.length - 1 && !msg.content && (
                          <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse rounded-sm" />
                        )}
                        {msg.role === "assistant" && claudeStreaming && i === claudeMessages.length - 1 && msg.content && (
                          <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 rounded-sm" />
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center mt-0.5 text-xs font-bold text-gray-700">
                      M
                    </div>
                  )}
                </div>
              ))}
              <div ref={claudeBottomRef} />
            </CardContent>

            <div className="shrink-0 border-t p-3 flex gap-2 items-end bg-white rounded-b-lg">
              <Textarea
                value={claudeInput}
                onChange={e => setClaudeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendToClaud();
                  }
                }}
                placeholder="Message Claude… (Enter to send, Shift+Enter for new line)"
                className="resize-none min-h-[44px] max-h-40 text-sm"
                rows={1}
                disabled={claudeStreaming}
                data-testid="input-claude-message"
              />
              {claudeStreaming ? (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => claudeAbortRef.current?.abort()}
                  className="shrink-0 h-10 w-10 border-red-300 text-red-600 hover:bg-red-50"
                  data-testid="button-claude-stop"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={sendToClaud}
                  disabled={!claudeInput.trim()}
                  className="shrink-0 h-10 w-10 bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-claude-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        )}

        {activeTab === "stripe-orphans" && (
          <div className="space-y-6">
            {/* Status count cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(["pending", "processing", "failed_permanently", "resolved"] as const).map((status) => {
                const count = stripeOrphansData?.counts[status] ?? 0;
                const config = {
                  pending: { label: "Pending", icon: Clock, bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", iconBg: "bg-yellow-100", activeBorder: "border-yellow-500 ring-2 ring-yellow-400" },
                  processing: { label: "Processing", icon: RefreshCw, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", iconBg: "bg-blue-100", activeBorder: "border-blue-500 ring-2 ring-blue-400" },
                  failed_permanently: { label: "Perm. Failed", icon: AlertOctagon, bg: "bg-red-50", border: "border-red-200", text: "text-red-700", iconBg: "bg-red-100", activeBorder: "border-red-500 ring-2 ring-red-400" },
                  resolved: { label: "Resolved", icon: CheckCircle2, bg: "bg-green-50", border: "border-green-200", text: "text-green-700", iconBg: "bg-green-100", activeBorder: "border-green-500 ring-2 ring-green-400" },
                }[status];
                const Icon = config.icon;
                const isActive = orphanStatusFilter === status;
                return (
                  <Card
                    key={status}
                    className={`${config.bg} ${isActive ? config.activeBorder : config.border} border cursor-pointer transition-all hover:shadow-md select-none`}
                    onClick={() => setOrphanStatusFilter(isActive ? null : status)}
                    data-testid={`card-orphan-status-${status}`}
                    title={isActive ? `Click to clear filter` : `Click to filter by ${config.label}`}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.iconBg}`}>
                          <Icon className={`h-5 w-5 ${config.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-2xl font-bold ${config.text}`}>{stripeOrphansLoading ? "—" : count}</p>
                          <p className={`text-xs font-medium ${config.text} opacity-80`}>{config.label}</p>
                        </div>
                        {isActive && <Filter className={`h-4 w-4 shrink-0 ${config.text}`} />}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Search / filter bar */}
            <Card className="border">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-9"
                      placeholder="Search by customer ID or subscription ID…"
                      value={orphanSearch}
                      onChange={(e) => setOrphanSearch(e.target.value)}
                      data-testid="input-orphan-search"
                    />
                    {orphanSearch && (
                      <button
                        onClick={() => setOrphanSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      type="date"
                      className="w-36 text-sm"
                      value={orphanDateFrom}
                      onChange={(e) => setOrphanDateFrom(e.target.value)}
                      data-testid="input-orphan-date-from"
                      title="Created from"
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input
                      type="date"
                      className="w-36 text-sm"
                      value={orphanDateTo}
                      onChange={(e) => setOrphanDateTo(e.target.value)}
                      data-testid="input-orphan-date-to"
                      title="Created to"
                    />
                  </div>
                  {(orphanSearch || orphanStatusFilter || orphanDateFrom || orphanDateTo) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground"
                      onClick={() => { setOrphanSearch(""); setOrphanStatusFilter(null); setOrphanDateFrom(""); setOrphanDateTo(""); }}
                      data-testid="button-clear-orphan-filters"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Grouped status sections */}
            {stripeOrphansLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !stripeOrphansData?.rows.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                  <p className="text-muted-foreground text-sm font-medium">No stripe cleanup records found.</p>
                  <p className="text-muted-foreground text-xs">The queue is clear — all Stripe objects were linked successfully.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  {(orphanSearch || orphanStatusFilter || orphanDateFrom || orphanDateTo) ? (
                    <p className="text-sm text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{filteredOrphanRows.length}</span> of {stripeOrphansData.rows.length} records
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{stripeOrphansData.rows.length} record{stripeOrphansData.rows.length !== 1 ? "s" : ""} total</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchStripeOrphans()}
                    data-testid="button-refresh-stripe-orphans"
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                {filteredOrphanRows.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground text-sm font-medium">No records match your filters.</p>
                      <p className="text-muted-foreground text-xs">Try adjusting the search term, status, or date range.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {(["pending", "processing", "failed_permanently", "resolved"] as const).map((status) => {
                  const groupRows = filteredOrphanRows.filter((r) => r.status === status);
                  if (!groupRows.length) return null;
                  const sectionConfig = {
                    pending: { label: "Pending", headerBg: "bg-yellow-50", headerBorder: "border-yellow-200", badgeClass: "bg-yellow-100 text-yellow-700", icon: Clock },
                    processing: { label: "Processing", headerBg: "bg-blue-50", headerBorder: "border-blue-200", badgeClass: "bg-blue-100 text-blue-700", icon: RefreshCw },
                    failed_permanently: { label: "Permanently Failed", headerBg: "bg-red-50", headerBorder: "border-red-200", badgeClass: "bg-red-100 text-red-700", icon: AlertOctagon },
                    resolved: { label: "Resolved", headerBg: "bg-green-50", headerBorder: "border-green-200", badgeClass: "bg-green-100 text-green-700", icon: CheckCircle2 },
                  }[status];
                  const SectionIcon = sectionConfig.icon;
                  return (
                    <Card key={status} className={`border ${sectionConfig.headerBorder}`} data-testid={`section-stripe-orphans-${status}`}>
                      <CardHeader className={`${sectionConfig.headerBg} rounded-t-lg py-3 px-4 flex flex-row items-center gap-2`}>
                        <SectionIcon className="h-4 w-4" />
                        <CardTitle className="text-sm font-semibold">{sectionConfig.label}</CardTitle>
                        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sectionConfig.badgeClass}`}>
                          {groupRows.length} record{groupRows.length !== 1 ? "s" : ""}
                        </span>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">ID</TableHead>
                                <TableHead>Customer ID</TableHead>
                                <TableHead>Subscription ID</TableHead>
                                <TableHead className="w-16">Retries</TableHead>
                                <TableHead>Last Error</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Updated</TableHead>
                                {status === "resolved" ? <TableHead>Resolution Note</TableHead> : <TableHead className="w-44">Actions</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupRows.map((row) => (
                                <TableRow key={row.id} data-testid={`row-stripe-orphan-${row.id}`}>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {row.stripeCustomerId ?? <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {row.stripeSubscriptionId ?? <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-sm text-center">{row.retryCount}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate" title={row.lastError ?? undefined}>
                                    {row.lastError ?? <span className="italic">—</span>}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(row.createdAt).toISOString()}>
                                    {new Date(row.createdAt).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(row.updatedAt).toISOString()}>
                                    {new Date(row.updatedAt).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                  </TableCell>
                                  {status === "resolved" ? (
                                    <TableCell className="text-xs text-muted-foreground max-w-xs">
                                      {row.resolutionNote
                                        ? <ExpandableNote note={row.resolutionNote} />
                                        : <span className="italic">—</span>}
                                    </TableCell>
                                  ) : (
                                    <TableCell>
                                      <div className="flex items-center gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs h-7"
                                          disabled={retryOrphanMutation.isPending || resolveOrphanMutation.isPending}
                                          onClick={() => retryOrphanMutation.mutate(row.id)}
                                          data-testid={`button-retry-orphan-${row.id}`}
                                        >
                                          <RotateCcw className="mr-1 h-3 w-3" />
                                          Retry Now
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-green-300 text-green-700 hover:bg-green-50 text-xs h-7"
                                          disabled={resolveOrphanMutation.isPending || retryOrphanMutation.isPending}
                                          onClick={() => { setResolveOrphanId(row.id); setResolveNote(""); setResolveDialogOpen(true); }}
                                          data-testid={`button-resolve-orphan-${row.id}`}
                                        >
                                          <CheckCircle2 className="mr-1 h-3 w-3" />
                                          Resolve
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                    );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}

        <Dialog open={resolveDialogOpen} onOpenChange={(open) => { if (!resolveOrphanMutation.isPending) { setResolveDialogOpen(open); if (!open) { setResolveOrphanId(null); setResolveNote(""); } } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Resolve Record</DialogTitle>
              <DialogDescription>
                Optionally add a short note explaining why this record is being marked as resolved (e.g. "Deleted in Stripe dashboard").
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="resolve-note" className="text-sm font-medium">Note (optional)</Label>
              <Textarea
                id="resolve-note"
                className="mt-1.5 resize-none"
                rows={3}
                placeholder="e.g. Deleted in Stripe dashboard"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                maxLength={500}
                data-testid="input-resolve-note"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setResolveDialogOpen(false); setResolveOrphanId(null); setResolveNote(""); }} disabled={resolveOrphanMutation.isPending}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={resolveOrphanMutation.isPending}
                onClick={() => { if (resolveOrphanId !== null) resolveOrphanMutation.mutate({ id: resolveOrphanId, note: resolveNote }); }}
                data-testid="button-confirm-resolve-orphan"
              >
                {resolveOrphanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resolving…</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Mark Resolved</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {activeTab === "marketing" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-600 text-white">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Marketing Subscribers</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {marketingLoading ? "Loading…" : `${marketingSubscribers?.length ?? 0} subscriber${(marketingSubscribers?.length ?? 0) !== 1 ? "s" : ""} opted in`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!marketingSubscribers?.length}
                onClick={() => marketingSubscribers && downloadMarketingCsv(marketingSubscribers)}
                data-testid="button-export-marketing-csv"
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <Download className="mr-1.5 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {marketingLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !marketingSubscribers?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <Megaphone className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No marketing subscribers yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Date Opted In</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketingSubscribers.map((sub, i) => (
                        <TableRow key={i} data-testid={`row-marketing-subscriber-${i}`}>
                          <TableCell className="font-medium">{sub.name}</TableCell>
                          <TableCell>
                            {sub.email ? (
                              <a href={`mailto:${sub.email}`} className="text-blue-600 hover:underline text-sm" data-testid={`link-subscriber-email-${i}`}>
                                {sub.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sub.orgName ?? "—"}</TableCell>
                          <TableCell>
                            {sub.role && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {sub.role}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sub.source === "In-App Opt-In" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                              {sub.source}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sub.dateOptedIn ? new Date(sub.dateOptedIn).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>
      <SiteFooter />

      {/* Org detail dialog */}
      <Dialog open={!!selectedOrg} onOpenChange={(open) => { if (!open) setSelectedOrg(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOrg && (() => {
            const o = selectedOrg;
            const isFree = o.stripeCustomerId === "free_membership" || o.stripeCustomerId?.startsWith("promo_");
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    {o.name}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant={o.status === "active" ? "default" : "destructive"} className={`capitalize ${o.status === "paused" ? "bg-amber-500" : ""}`}>{o.status}</Badge>
                      <Badge variant="outline">{tierLabels[o.tier] || o.tier}</Badge>
                      {o.isDemo && <Badge variant="secondary">Demo</Badge>}
                      {isFree ? <Badge variant="secondary">Free</Badge> : <Badge variant="outline">${tierPrices[o.tier] ?? 0}/mo</Badge>}
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* Identity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Org Code</p>
                      <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono">{o.code}</code>
                    </div>
                    {o.siteId && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Site ID</p>
                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono">{o.siteId}</code>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Created</p>
                      <p className="text-sm">{new Date(o.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">License Agreement</p>
                      {o.licenseAcceptedAt ? (
                        <p className="text-sm text-green-700 font-medium">✓ {new Date(o.licenseAcceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      ) : (
                        <p className="text-sm text-red-500">✗ Not on record</p>
                      )}
                    </div>
                  </div>

                  {/* Users */}
                  <div className="border rounded-lg p-3 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{o.adminCount}</p>
                      <p className="text-xs text-muted-foreground">Admins</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{o.employeeCount}</p>
                      <p className="text-xs text-muted-foreground">Employees</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{o.pendingOrderCount}</p>
                      <p className="text-xs text-muted-foreground">Pending Orders</p>
                    </div>
                  </div>

                  {/* Bucks balance */}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Org Bucks Balance</p>
                    <p className="text-sm font-semibold">{(o.orgBucksBalance ?? 0).toLocaleString()} Bucks</p>
                  </div>

                  {/* Owner */}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Organization Owner</p>
                    {o.primeAdmin ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{o.primeAdmin.fullName}</p>
                          <p className="text-xs text-muted-foreground">@{o.primeAdmin.username}</p>
                          {o.primeAdmin.email && <p className="text-xs text-muted-foreground">{o.primeAdmin.email}</p>}
                        </div>
                        {o.primeAdmin && (o.status === "active" || o.status === "paused") && (
                          <Button size="sm" variant="outline" onClick={() => { setSelectedOrg(null); impersonateMutation.mutate(o.primeAdmin!.id); }}>
                            <LogIn className="mr-1.5 h-3 w-3" />
                            Enter
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No owner set</p>
                    )}
                  </div>

                  {/* Billing */}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Billing</p>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stripe Customer</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded max-w-[220px] truncate">{o.stripeCustomerId ?? "—"}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subscription</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded max-w-[220px] truncate">{o.stripeSubscriptionId ?? "—"}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Marketing opt-in</span>
                        <span>{o.marketingOptIn ? "✓ Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t">
                    {o.status === "active" && (
                      <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        onClick={() => { setSelectedOrg(null); togglePauseMutation.mutate({ orgId: o.id, newStatus: "paused" }); }}
                        disabled={togglePauseMutation.isPending}>
                        <Pause className="mr-1.5 h-3 w-3" />Pause
                      </Button>
                    )}
                    {o.status === "paused" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700"
                        onClick={() => { setSelectedOrg(null); togglePauseMutation.mutate({ orgId: o.id, newStatus: "active" }); }}
                        disabled={togglePauseMutation.isPending}>
                        <Play className="mr-1.5 h-3 w-3" />Reactivate
                      </Button>
                    )}
                    {o.status === "active" && !isFree && (
                      <Button size="sm" variant="outline" className="text-amber-700 border-amber-400 hover:bg-amber-50"
                        onClick={() => {
                          setSelectedOrg(null);
                          const hasPaidSub = o.stripeSubscriptionId && o.stripeSubscriptionId !== "pending_checkout";
                          const msg = hasPaidSub
                            ? `Cancel subscription for "${o.name}"? This will stop Stripe billing and immediately pause all users' access. Data is preserved.`
                            : `Pause "${o.name}"? All users will lose access. Data is preserved.`;
                          if (confirm(msg)) cancelSubMutation.mutate(o.id);
                        }}
                        disabled={cancelSubMutation.isPending}>
                        <XCircle className="mr-1.5 h-3 w-3" />Cancel Sub
                      </Button>
                    )}
                    <Button size="sm" variant="destructive"
                      onClick={() => { setSelectedOrg(null); setDeleteReason(""); setDeleteDialog({ orgId: o.id, orgName: o.name }); }}
                      disabled={deleteMutation.isPending}>
                      <Trash2 className="mr-1.5 h-3 w-3" />Delete
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) { setDeleteDialog(null); setDeleteReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              This will delete <span className="font-semibold text-foreground">"{deleteDialog?.orgName}"</span>. Data is preserved for auditing but the account will be deactivated. A notification email will be sent to the organization's admins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Reason for deletion <span className="text-red-500">*</span></Label>
            <Textarea
              id="delete-reason"
              data-testid="input-delete-reason"
              placeholder="e.g. Non-payment, Terms of Service violation, Customer request..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="min-h-[80px]"
            />
            {deleteReason.length > 0 && deleteReason.trim().length < 3 && (
              <p className="text-xs text-red-500">Reason must be at least 3 characters.</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDeleteDialog(null); setDeleteReason(""); }} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteReason.trim().length < 3 || deleteMutation.isPending}
              onClick={() => {
                if (deleteDialog) {
                  deleteMutation.mutate({ orgId: deleteDialog.orgId, orgName: deleteDialog.orgName, reason: deleteReason.trim() });
                }
              }}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EntAccount = {
  id: number;
  companyName: string;
  contactEmail: string;
  contactName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  customPrice: number;
  billingCycle: string;
  maxLogins: number;
  contractUrl: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
};

type InboxData = {
  rfis: { id: number; name: string; email: string; phone: string; needs: string; inquiryType: string; emailSent: boolean; createdAt: string }[];
  affiliates: { id: number; name: string; email: string; phone: string; webpage: string; additionalInfo: string; emailSent: boolean; createdAt: string }[];
};

function InboxTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<InboxData>({
    queryKey: ["/api/developer/inbox"],
    queryFn: () => fetch("/api/developer/inbox", { credentials: "include" }).then(r => r.json()),
  });

  const resendRfi = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/developer/inbox/rfi/${id}/resend`, {}),
    onSuccess: () => { toast({ title: "Notification resent" }); queryClient.invalidateQueries({ queryKey: ["/api/developer/inbox"] }); },
    onError: (e: any) => toast({ title: "Resend failed", description: e.message, variant: "destructive" }),
  });

  const resendAffiliate = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/developer/inbox/affiliate/${id}/resend`, {}),
    onSuccess: () => { toast({ title: "Notification resent" }); queryClient.invalidateQueries({ queryKey: ["/api/developer/inbox"] }); },
    onError: (e: any) => toast({ title: "Resend failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading inbox…</div>;

  const rfis = data?.rfis ?? [];
  const affiliates = data?.affiliates ?? [];
  const totalUnset = rfis.filter(r => !r.emailSent).length + affiliates.filter(a => !a.emailSent).length;

  return (
    <div className="space-y-6">
      {totalUnset > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800" data-testid="inbox-alert-unsent">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
          <span><strong>{totalUnset}</strong> submission{totalUnset !== 1 ? "s" : ""} without a confirmed email notification. Use the Resend button to send them now.</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> RFI Submissions ({rfis.length})
          </CardTitle>
          <CardDescription>Better Bucks and Website inquiry forms submitted via the public site.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rfis.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No RFI submissions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notified</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfis.map(r => (
                  <TableRow key={r.id} data-testid={`row-rfi-${r.id}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <a href={`mailto:${r.email}`} className="text-primary hover:underline text-sm">{r.email}</a>
                    </TableCell>
                    <TableCell className="text-sm">{r.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.inquiryType === "website" ? "Website" : "Better Bucks"}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.emailSent
                        ? <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Sent</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Not sent</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => resendRfi.mutate(r.id)} disabled={resendRfi.isPending} data-testid={`button-resend-rfi-${r.id}`}>
                        <Mail className="h-3.5 w-3.5 mr-1" /> Resend
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Affiliate Applications ({affiliates.length})
          </CardTitle>
          <CardDescription>Affiliate program applications submitted via the public affiliate page.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {affiliates.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No affiliate applications yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Notified</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map(a => (
                  <TableRow key={a.id} data-testid={`row-affiliate-${a.id}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <a href={`mailto:${a.email}`} className="text-primary hover:underline text-sm">{a.email}</a>
                    </TableCell>
                    <TableCell className="text-sm">{a.phone}</TableCell>
                    <TableCell className="max-w-[140px]">
                      <a href={a.webpage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm truncate block">{a.webpage}</a>
                    </TableCell>
                    <TableCell>
                      {a.emailSent
                        ? <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Sent</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Not sent</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => resendAffiliate.mutate(a.id)} disabled={resendAffiliate.isPending} data-testid={`button-resend-affiliate-${a.id}`}>
                        <Mail className="h-3.5 w-3.5 mr-1" /> Resend
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EnterpriseAccountsTab() {
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [contractUploading, setContractUploading] = useState<number | null>(null);

  const [form, setForm] = useState({
    companyName: "", contactEmail: "", contactName: "",
    address: "", city: "", state: "", zip: "",
    customPrice: "", billingCycle: "monthly" as string,
    maxLogins: "", notes: "",
  });

  const { data: accounts, isLoading, isError, error, refetch } = useQuery<EntAccount[]>({
    queryKey: ["/api/developer/enterprise-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/developer/enterprise-accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/enterprise-accounts"] });
      toast({ title: "Created", description: "Enterprise account created and billing started." });
      setShowForm(false);
      setForm({ companyName: "", contactEmail: "", contactName: "", address: "", city: "", state: "", zip: "", customPrice: "", billingCycle: "monthly", maxLogins: "", notes: "" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/developer/enterprise-accounts/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/enterprise-accounts"] });
      toast({ title: "Cancelled", description: "Enterprise account cancelled and customer notified." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: number; email: string }) => {
      const res = await apiRequest("POST", `/api/developer/enterprise-accounts/${id}/send-test-email`, { email });
      return res.json();
    },
    onSuccess: (data) => toast({ title: "Sent", description: data.message }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleContractUpload(accountId: number, file: File) {
    setContractUploading(accountId);
    try {
      const fd = new FormData();
      fd.append("contract", file);
      const res = await fetch(`/api/developer/enterprise-accounts/${accountId}/upload-contract`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errData.message || "Upload failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/developer/enterprise-accounts"] });
      toast({ title: "Contract uploaded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setContractUploading(null);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceInCents = Math.round(parseFloat(form.customPrice) * 100);
    if (isNaN(priceInCents) || priceInCents < 100) {
      toast({ title: "Error", description: "Price must be at least $1.00", variant: "destructive" });
      return;
    }
    const logins = parseInt(form.maxLogins);
    if (!Number.isFinite(logins) || logins < 1) {
      toast({ title: "Error", description: "Max logins must be at least 1", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...form,
      customPrice: priceInCents,
      maxLogins: logins,
    });
  };

  const fmtPrice = (cents: number) => "$" + (cents / 100).toFixed(2);
  const cycleLabels: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Enterprise Accounts
              </CardTitle>
              <CardDescription>Custom-priced accounts with specialized billing and contract management.</CardDescription>
            </div>
            <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-enterprise">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Enterprise Account
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t bg-muted/30">
            <form onSubmit={handleSubmit} onFocusCapture={scrollOnFocus} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ent-company">Company Name</Label>
                  <Input id="ent-company" required value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} data-testid="input-ent-company" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ent-contact-name">Contact Name</Label>
                  <Input id="ent-contact-name" required value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} data-testid="input-ent-contact-name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ent-email">Contact Email</Label>
                  <Input id="ent-email" type="email" inputMode="email" required value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} data-testid="input-ent-email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ent-address">Street Address</Label>
                  <Input id="ent-address" autoComplete="street-address" required value={form.address} onChange={e => setForm({...form, address: e.target.value})} data-testid="input-ent-address" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ent-city">City</Label>
                    <Input id="ent-city" autoComplete="address-level2" required value={form.city} onChange={e => setForm({...form, city: e.target.value})} data-testid="input-ent-city" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ent-state">State</Label>
                    <Input id="ent-state" autoComplete="address-level1" required value={form.state} onChange={e => setForm({...form, state: e.target.value})} data-testid="input-ent-state" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ent-zip">ZIP</Label>
                    <Input id="ent-zip" inputMode="numeric" pattern="[0-9\-]*" autoComplete="postal-code" required value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} data-testid="input-ent-zip" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ent-price">Custom Price ($)</Label>
                  <Input id="ent-price" type="number" inputMode="decimal" step="0.01" min="1" required value={form.customPrice} onChange={e => setForm({...form, customPrice: e.target.value})} placeholder="e.g. 499.99" data-testid="input-ent-price" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ent-cycle">Billing Cycle</Label>
                  <select id="ent-cycle" className="flex h-11 sm:h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={form.billingCycle} onChange={e => setForm({...form, billingCycle: e.target.value})} data-testid="select-ent-cycle">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ent-logins">Max Logins (Usage Limit)</Label>
                  <Input id="ent-logins" type="number" inputMode="numeric" min="1" required value={form.maxLogins} onChange={e => setForm({...form, maxLogins: e.target.value})} placeholder="e.g. 500" data-testid="input-ent-logins" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ent-notes">Notes (optional)</Label>
                <Textarea id="ent-notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Internal notes about this account..." data-testid="input-ent-notes" />
              </div>
              {createMutation.isError && (
                <p role="alert" className="text-sm font-medium text-destructive" data-testid="error-create-enterprise">
                  {(createMutation.error as Error)?.message || "Failed to create enterprise account"}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-enterprise">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Create & Start Billing
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent className={showForm ? "border-t" : ""}>
          {isLoading ? (
            <div className="py-8 text-center"><Loader /></div>
          ) : isError ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-red-600 font-medium">Failed to load enterprise accounts</p>
              <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-enterprise">Retry</Button>
            </div>
          ) : !accounts?.length ? (
            <p className="py-8 text-center text-muted-foreground">No enterprise accounts yet. Click "New Enterprise Account" to create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Logins</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map(acc => (
                    <TableRow key={acc.id} data-testid={`row-enterprise-${acc.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{acc.companyName}</p>
                          <p className="text-xs text-muted-foreground">{acc.address}, {acc.city}, {acc.state} {acc.zip}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{acc.contactName}</p>
                          <p className="text-xs text-muted-foreground">{acc.contactEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-700">{fmtPrice(acc.customPrice)}</span>
                        <span className="text-xs text-muted-foreground">{cycleLabels[acc.billingCycle]}</span>
                      </TableCell>
                      <TableCell>{acc.maxLogins.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={acc.status === "active" ? "default" : acc.status === "cancelled" ? "destructive" : "secondary"}>
                          {acc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {acc.contractUrl ? (
                          <a href={acc.contractUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1" data-testid={`link-contract-${acc.id}`}>
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        ) : (
                          <label className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <Upload className="h-3 w-3" />
                            {contractUploading === acc.id ? "Uploading..." : "Upload"}
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => { if (e.target.files?.[0]) handleContractUpload(acc.id, e.target.files[0]); }} />
                          </label>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => sendTestEmailMutation.mutate({ id: acc.id, email: acc.contactEmail })}
                            disabled={sendTestEmailMutation.isPending}
                            data-testid={`button-test-email-${acc.id}`}
                          >
                            <Mail className="mr-1 h-3 w-3" /> Test Email
                          </Button>
                          {acc.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() => {
                                if (confirm(`Cancel enterprise account for "${acc.companyName}"? Stripe billing will be stopped and they will be notified.`)) {
                                  cancelMutation.mutate(acc.id);
                                }
                              }}
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-enterprise-${acc.id}`}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
