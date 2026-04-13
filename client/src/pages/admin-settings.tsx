import { AdminLayout } from "@/components/layout-admin";
import { SpinningLogo } from "@/components/spinning-logo";
import { useUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CreditCard, Shield, AlertTriangle, Copy, Check, Users, ExternalLink, Pencil, ArrowUpDown, Trash2, Store, Plus, Tag, FolderTree, QrCode, ToggleLeft, RefreshCw, KeyRound, Eye, EyeOff, Mail, Send, UserCheck, TrendingUp, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Organization, ShopWebsite, Department, TransactionCategory } from "@shared/schema";

type OrgWithFree = Organization & { isFree: boolean; employeeCount: number };
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const tierDefaults: Record<string, { name: string; price: number; maxEmployees: number }> = {
  small:      { name: "Small Site",      price: 4999,  maxEmployees: 25 },
  mid:        { name: "Mid-Size Site",   price: 9999,  maxEmployees: 75 },
  large:      { name: "Large Site",      price: 14999, maxEmployees: 150 },
  enterprise: { name: "Enterprise Site", price: 29999, maxEmployees: -1 },
};
const tierOrder = ["small", "mid", "large", "enterprise"] as const;

type TierPricingMap = Record<string, { price: number; maxEmployees: number; name: string; description: string }>;

function getTierInfo(tier: string, livePricing?: TierPricingMap) {
  const lp = livePricing?.[tier];
  const fallback = tierDefaults[tier];
  return {
    name: lp?.name || fallback?.name || tier,
    price: lp?.price ?? fallback?.price ?? 0,
    maxEmployees: lp?.maxEmployees ?? fallback?.maxEmployees ?? 0,
  };
}

export default function AdminSettingsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [siteIdCopied, setSiteIdCopied] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState(false);
  const [siteIdValue, setSiteIdValue] = useState("");
  const [siteIdAvailable, setSiteIdAvailable] = useState<boolean | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const { data: org, isLoading } = useQuery<OrgWithFree>({
    queryKey: ["/api/organizations/my-org"],
    enabled: user?.role === "prime_admin" || user?.role === "admin",
  });

  const { data: livePricing } = useQuery<TierPricingMap>({
    queryKey: ["/api/organizations/tier-pricing"],
    enabled: user?.role === "prime_admin" || user?.role === "admin",
  });

  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<string | null>(null);

  const { mutate: cancelSubscription, isPending: isCancelling } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/cancel-subscription");
      return await res.json();
    },
    onSuccess: (data: { cancelledImmediately?: boolean; cancelAt?: string; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      if (data.cancelledImmediately) {
        toast({
          title: "Subscription Cancelled",
          description: "Your trial has ended. All team members have been removed from the platform.",
        });
      } else if (data.cancelAt) {
        const dateStr = new Date(data.cancelAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        setCancelAtPeriodEnd(dateStr);
        toast({
          title: "Cancellation Scheduled",
          description: `Your subscription will end on ${dateStr}. You retain full access until then.`,
        });
      } else {
        toast({
          title: "Subscription Cancelled",
          description: "Your organization's subscription has been cancelled.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [changingTier, setChangingTier] = useState(false);
  const [selectedTier, setSelectedTier] = useState("");
  const [cancelStep, setCancelStep] = useState<"closed" | "alternatives" | "confirm">("closed");
  const [cancelUpgradeTier, setCancelUpgradeTier] = useState("");

  const { mutate: changeTier, isPending: isChangingTier } = useMutation({
    mutationFn: async (tier: string) => {
      const res = await apiRequest("POST", "/api/organizations/change-tier", { tier });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      toast({ title: "Plan Changed", description: "Your subscription has been updated to the new plan." });
      setChangingTier(false);
    },
    onError: (error: Error) => {
      toast({ title: "Change Failed", description: error.message, variant: "destructive" });
    },
  });

  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const { mutate: deleteOrganization, isPending: isDeleting } = useMutation({
    mutationFn: async (confirmOrgName: string) => {
      const res = await apiRequest("POST", "/api/organizations/delete", { confirmOrgName });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Organization Deleted",
        description: "Your organization has been permanently deleted.",
      });
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [editingStoreUrl, setEditingStoreUrl] = useState(false);
  const [storeUrlValue, setStoreUrlValue] = useState("");

  const { mutate: updateStoreUrl, isPending: isUpdatingUrl } = useMutation({
    mutationFn: async (storeUrl: string) => {
      const res = await apiRequest("PATCH", "/api/organizations/store-url", { storeUrl });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/store-url"] });
      toast({ title: "Store URL Updated", description: "Your employees will now see the new store link." });
      setEditingStoreUrl(false);
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const { mutate: setSiteId, isPending: isSettingSiteId } = useMutation({
    mutationFn: async (siteId: string) => {
      const res = await apiRequest("PATCH", "/api/organizations/site-id", { siteId });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to set Site ID");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      toast({ title: "Site ID Saved", description: "Employees can now join using this Site ID." });
      setEditingSiteId(false);
      setSiteIdAvailable(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Save", description: error.message, variant: "destructive" });
    },
  });

  const [showPinForm, setShowPinForm] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [confirmPinValue, setConfirmPinValue] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);

  const { data: pinStatus } = useQuery<{ hasUniversalPin: boolean; pin: string | null }>({
    queryKey: ["/api/admin/settings/universal-pin"],
  });

  const { mutate: setUniversalPin, isPending: isSettingPin } = useMutation({
    mutationFn: async (pin: string | null) => {
      const res = await apiRequest("PATCH", "/api/admin/settings/universal-pin", { pin });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to set universal PIN");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/universal-pin"] });
      toast({ title: pinValue ? "Universal PIN Set" : "Universal PIN Removed", description: pinValue ? "All employees can now log in using this PIN." : "Universal PIN has been removed." });
      setShowPinForm(false);
      setPinValue("");
      setConfirmPinValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  async function checkSiteIdAvailability(value: string) {
    if (!value || value.length < 3) { setSiteIdAvailable(null); return; }
    setCheckingAvailability(true);
    try {
      const res = await fetch(`/api/organizations/site-id/check/${encodeURIComponent(value.toLowerCase())}`, { credentials: "include" });
      const data = await res.json();
      setSiteIdAvailable(data.available ?? false);
    } catch { setSiteIdAvailable(null); } finally { setCheckingAvailability(false); }
  }

  const handleCopyCode = () => {
    if (org?.code) {
      navigator.clipboard.writeText(org.code);
      setCopied(true);
      toast({ title: "Copied!", description: "Organization code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySiteIdUrl = () => {
    if (org?.siteId) {
      const url = `${window.location.origin}/join/${org.siteId}`;
      navigator.clipboard.writeText(url);
      setSiteIdCopied(true);
      toast({ title: "Copied!", description: "Join link copied to clipboard" });
      setTimeout(() => setSiteIdCopied(false), 2000);
    }
  };

  if (user?.role !== "prime_admin" && user?.role !== "admin") {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-muted-foreground">
          Only administrators can access settings.
        </div>
      </AdminLayout>
    );
  }

  const currentTierInfo = org ? getTierInfo(org.tier, livePricing) : null;
  const tierLabel = currentTierInfo?.name ?? "";
  const grandfatheredPrice = org?.signupPrice ? (org.signupPrice / 100) : null;
  const currentTierPrice = currentTierInfo ? (currentTierInfo.price / 100) : 0;
  const tierPrice = grandfatheredPrice ?? currentTierPrice;
  const employeeLimit = org?.maxEmployees === -1 ? "Unlimited" : String(org?.maxEmployees || 0);
  const employeeCount = org?.employeeCount || 0;

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Organization Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your organization's membership and details</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <SpinningLogo className="h-6 w-6" />
          </div>
        ) : org ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {org.name}
                  </CardTitle>
                  <CardDescription>Organization Details</CardDescription>
                </div>
                <Badge variant={org.status === "active" ? "default" : "destructive"} data-testid="badge-org-status">
                  {org.status === "active" ? "Active" : org.status === "inactive" ? "Cancelled" : org.status === "paused" ? "Paused" : "Pending"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Organization Code</div>
                    <div className="font-mono text-lg font-bold tracking-widest" data-testid="text-settings-org-code">{org.code}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyCode} data-testid="button-copy-org-code">
                    {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Share this code with team members who need to register for your organization.
                </div>

              </CardContent>
            </Card>

            {/* ── Site ID & Employee Access ─────────────────────────────── */}
            <Card data-testid="card-site-id">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Site ID & Employee Access
                </CardTitle>
                <CardDescription>
                  Set a unique Site ID so employees can join without a password by scanning a QR code. Email and phone are not required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {org.siteId ? (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Current Site ID</div>
                        <div className="font-mono text-lg font-bold tracking-wide" data-testid="text-current-site-id">{org.siteId}</div>
                        <div className="text-xs text-muted-foreground mt-1">{window.location.origin}/join/{org.siteId}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopySiteIdUrl} data-testid="button-copy-site-id-url">
                          {siteIdCopied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                          {siteIdCopied ? "Copied" : "Copy link"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSiteIdValue(org.siteId || ""); setEditingSiteId(true); setSiteIdAvailable(null); }} data-testid="button-edit-site-id">
                          <Pencil className="mr-2 h-3 w-3" />
                          Change
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-2">
                      <div className="bg-white p-4 rounded-xl border shadow-sm" data-testid="qr-site-id">
                        <QRCodeSVG
                          value={`${window.location.origin}/join/${org.siteId}`}
                          size={200}
                          fgColor="#162A4A"
                          level="M"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Print this QR code and post it at your worksite. Employees scan it to sign up or sign in — no password or email required.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <QrCode className="h-12 w-12 text-muted-foreground/40" />
                    <div>
                      <p className="font-medium text-sm">No Site ID set yet</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        Set a Site ID to generate a QR code that employees can scan to create accounts and sign in without passwords.
                      </p>
                    </div>
                    <Button onClick={() => { setSiteIdValue(""); setEditingSiteId(true); setSiteIdAvailable(null); }} data-testid="button-set-site-id">
                      <QrCode className="mr-2 h-4 w-4" />
                      Set Site ID
                    </Button>
                  </div>
                )}

                {editingSiteId && (
                  <div className="border-t pt-4 space-y-3">
                    <Label htmlFor="input-site-id">
                      {org.siteId ? "Change Site ID" : "Set Site ID"}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="input-site-id"
                          placeholder="e.g. acme-warehouse or warehouse1"
                          value={siteIdValue}
                          onChange={(e) => {
                            const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                            setSiteIdValue(v);
                            setSiteIdAvailable(null);
                          }}
                          onBlur={() => checkSiteIdAvailability(siteIdValue)}
                          maxLength={30}
                          data-testid="input-site-id"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkSiteIdAvailability(siteIdValue)}
                        disabled={checkingAvailability || siteIdValue.length < 3}
                        data-testid="button-check-site-id"
                      >
                        {checkingAvailability ? <SpinningLogo className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">3–30 characters, lowercase letters, numbers, and hyphens only.</p>
                    {siteIdAvailable === true && (
                      <p className="text-xs text-green-600 flex items-center gap-1" data-testid="text-site-id-available"><Check className="h-3 w-3" /> This Site ID is available</p>
                    )}
                    {siteIdAvailable === false && (
                      <p className="text-xs text-destructive" data-testid="text-site-id-taken">This Site ID is already taken</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => setSiteId(siteIdValue)}
                        disabled={isSettingSiteId || siteIdValue.length < 3 || siteIdAvailable === false}
                        data-testid="button-save-site-id"
                      >
                        {isSettingSiteId ? <><SpinningLogo className="mr-2 h-4 w-4" />Saving...</> : "Save Site ID"}
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingSiteId(false); setSiteIdAvailable(null); }} data-testid="button-cancel-site-id">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Universal Passkey ───────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Universal Passkey
                </CardTitle>
                <CardDescription>
                  Set a single PIN that any employee can use to log in — a fallback when they forget their individual PIN.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-universal-pin-status">
                      {pinStatus?.hasUniversalPin ? "Universal PIN is set and active" : "No universal PIN configured"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {pinStatus?.hasUniversalPin && !showPinForm && (
                      <Button variant="outline" size="sm" onClick={() => setUniversalPin(null)} disabled={isSettingPin} data-testid="button-remove-universal-pin">
                        Remove PIN
                      </Button>
                    )}
                    <Button variant={showPinForm ? "outline" : "default"} size="sm" onClick={() => { setShowPinForm(f => !f); setPinValue(""); setConfirmPinValue(""); }} data-testid="button-set-universal-pin">
                      {showPinForm ? "Cancel" : pinStatus?.hasUniversalPin ? "Change PIN" : "Set PIN"}
                    </Button>
                  </div>
                </div>

                {pinStatus?.hasUniversalPin && !showPinForm && (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current Universal PIN</p>
                      <p className="font-mono font-semibold tracking-widest text-foreground" data-testid="text-current-pin">
                        {pinStatus.pin
                          ? (showCurrentPin ? pinStatus.pin : "•".repeat(pinStatus.pin.length))
                          : <span className="text-muted-foreground text-sm font-normal italic">Set before this feature was added — change to reveal</span>
                        }
                      </p>
                    </div>
                    {pinStatus.pin && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground ml-4"
                        onClick={() => setShowCurrentPin(v => !v)}
                        data-testid="button-toggle-pin-visibility"
                      >
                        {showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                )}

                {showPinForm && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="pin-value">New Universal PIN</Label>
                        <div className="relative">
                          <Input
                            id="pin-value"
                            type={showPin ? "text" : "password"}
                            value={pinValue}
                            onChange={e => setPinValue(e.target.value)}
                            placeholder="Min. 4 characters"
                            data-testid="input-universal-pin"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPin(p => !p)}
                          >
                            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pin-confirm">Confirm PIN</Label>
                        <Input
                          id="pin-confirm"
                          type={showPin ? "text" : "password"}
                          value={confirmPinValue}
                          onChange={e => setConfirmPinValue(e.target.value)}
                          placeholder="Re-enter PIN"
                          data-testid="input-universal-pin-confirm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The universal PIN works as a fallback — employees can use either their personal PIN or this one. Keep it secure and share it only with your team.
                    </p>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={isSettingPin || !pinValue || pinValue.length < 4 || pinValue !== confirmPinValue}
                        onClick={() => {
                          if (pinValue !== confirmPinValue) {
                            toast({ title: "PINs don't match", description: "Please make sure both PIN fields match.", variant: "destructive" });
                            return;
                          }
                          setUniversalPin(pinValue);
                        }}
                        data-testid="button-save-universal-pin"
                      >
                        {isSettingPin ? "Saving..." : "Save Universal PIN"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Plan & Usage
                </CardTitle>
                <CardDescription>
                  Your current plan and employee usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Current Plan</div>
                    <div className="font-medium" data-testid="text-current-tier">{tierLabel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Employee Limit</div>
                    <div className="font-medium" data-testid="text-employee-limit">{employeeLimit}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current Employees</div>
                    <div className="font-medium" data-testid="text-employee-count">{employeeCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Monthly Cost</div>
                    <div className="font-medium" data-testid="text-monthly-cost">
                      {org.isFree ? "Free" : `$${tierPrice.toFixed(2)}/month`}
                    </div>
                    {!org.isFree && grandfatheredPrice !== null && currentTierPrice > 0 && grandfatheredPrice < currentTierPrice && (
                      <div className="text-xs text-green-600 mt-0.5" data-testid="text-grandfathered-savings">
                        Locked-in rate (currently ${currentTierPrice.toFixed(2)}/mo)
                      </div>
                    )}
                  </div>
                </div>
                {!org.isFree && org.maxEmployees > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{employeeCount} of {org.maxEmployees} employees used</span>
                      <span>{Math.round((employeeCount / org.maxEmployees) * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          employeeCount / org.maxEmployees > 0.9 ? "bg-destructive" :
                          employeeCount / org.maxEmployees > 0.7 ? "bg-yellow-500" : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, (employeeCount / org.maxEmployees) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Employee Store
                  </CardTitle>
                  <CardDescription>
                    The website your employees browse to pick items for orders
                  </CardDescription>
                </div>
                {!editingStoreUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStoreUrlValue(org.storeUrl || "https://dscpromostore.com/");
                      setEditingStoreUrl(true);
                    }}
                    data-testid="button-edit-store-url"
                  >
                    <Pencil className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {editingStoreUrl ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="store-url">Store Website URL</Label>
                      <Input
                        id="store-url"
                        type="url"
                        placeholder="https://example.com/store"
                        value={storeUrlValue}
                        onChange={(e) => setStoreUrlValue(e.target.value)}
                        data-testid="input-store-url"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateStoreUrl(storeUrlValue)}
                        disabled={isUpdatingUrl || !storeUrlValue}
                        data-testid="button-save-store-url"
                      >
                        {isUpdatingUrl ? <SpinningLogo className="mr-2 h-3 w-3" /> : null}
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingStoreUrl(false)}
                        data-testid="button-cancel-store-url"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Current Store URL</div>
                    <a
                      href={org.storeUrl || "https://dscpromostore.com/"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline break-all"
                      data-testid="text-store-url"
                    >
                      {org.storeUrl || "https://dscpromostore.com/"}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <ShopWebsitesSection />

            <FeatureFlagsSection org={org} />

            <RoleLabelsSection org={org} />
            <DepartmentsSection />
            <SuperUserTransferSection />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Membership
                </CardTitle>
                <CardDescription>
                  {org.isFree ? "You have a free membership" : "Your subscription details"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {org.isFree ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                      <Shield className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Free Membership</div>
                        <div>Your organization has a complimentary membership with full access to all features.</div>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <AlertDialog onOpenChange={(open) => { if (!open) setDeleteConfirmName(""); }}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid="button-delete-org">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Organization
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-3 text-sm text-muted-foreground">
                                <p>This will permanently delete your organization, all employee accounts, transaction history, and orders. This action cannot be undone.</p>
                                <p>Type <strong>{org.name}</strong> below to confirm:</p>
                                <Input
                                  value={deleteConfirmName}
                                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                                  placeholder={org.name}
                                  data-testid="input-confirm-org-name"
                                />
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteOrganization(deleteConfirmName)}
                              disabled={isDeleting || deleteConfirmName.trim().toLowerCase() !== org.name.trim().toLowerCase()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-delete-org"
                            >
                              {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ) : org.status === "active" ? (
                  <>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-sm text-muted-foreground">Plan</div>
                        <div className="font-medium">{tierLabel} - ${tierPrice.toFixed(2)}/month</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className={`font-medium ${cancelAtPeriodEnd ? "text-amber-600" : "text-green-600"}`}>
                          {cancelAtPeriodEnd ? "Cancelling" : "Active"}
                        </div>
                      </div>
                    </div>

                    {cancelAtPeriodEnd && (
                      <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold">Cancellation Scheduled</div>
                          <div className="mt-0.5 text-amber-700">Your subscription will end on <strong>{cancelAtPeriodEnd}</strong>. You and your team retain full access until then. No further charges will be made.</div>
                        </div>
                      </div>
                    )}

                    {changingTier ? (
                      <div className="border-t pt-4 space-y-3">
                        <Label>Select a new plan</Label>
                        <Select value={selectedTier} onValueChange={setSelectedTier}>
                          <SelectTrigger data-testid="select-new-tier">
                            <SelectValue placeholder="Choose a plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {tierOrder.filter(t => t !== org.tier).map(t => {
                              const info = getTierInfo(t, livePricing);
                              const price = (info.price / 100).toFixed(2);
                              const empLabel = info.maxEmployees === -1 ? "unlimited" : `up to ${info.maxEmployees}`;
                              const tooSmall = info.maxEmployees !== -1 && org.employeeCount > info.maxEmployees;
                              return (
                                <SelectItem key={t} value={t} disabled={tooSmall}>
                                  {info.name} - ${price}/mo ({empLabel}){tooSmall ? " — too many employees" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => changeTier(selectedTier)}
                            disabled={isChangingTier || !selectedTier}
                            data-testid="button-confirm-change-tier"
                          >
                            {isChangingTier ? <SpinningLogo className="mr-2 h-3 w-3" /> : null}
                            Confirm Change
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setChangingTier(false); setSelectedTier(""); }}
                            data-testid="button-cancel-change-tier"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t pt-4 flex items-center gap-3 flex-wrap">
                        <Button
                          variant="outline"
                          onClick={() => { setChangingTier(true); setSelectedTier(""); }}
                          data-testid="button-change-tier"
                        >
                          <ArrowUpDown className="mr-2 h-4 w-4" />
                          Change Plan
                        </Button>

                        <Button
                          variant="destructive"
                          onClick={() => { setCancelStep("alternatives"); setCancelUpgradeTier(""); }}
                          data-testid="button-cancel-subscription"
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Cancel Subscription
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Subscription Paused</div>
                        <div className="mt-0.5 text-amber-700">Your Stripe billing has been stopped and all team members have been blocked from accessing the platform. Your data is fully preserved.</div>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm text-muted-foreground mb-3">Ready to come back? Pick a plan and reactivate — your employees, settings, and history will be right where you left them.</p>
                      <a href="/admin/reactivate">
                        <Button data-testid="button-reactivate-from-settings">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Reactivate Subscription
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <CategoryManagementCard />
            <WeeklyReportCard />
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Unable to load organization information.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={cancelStep !== "closed"} onOpenChange={(open) => { if (!open) { setCancelStep("closed"); setCancelUpgradeTier(""); } }}>
        <DialogContent className="sm:max-w-lg">
          {cancelStep === "alternatives" && org && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Before you go...
                </DialogTitle>
                <DialogDescription>
                  Would a different plan be a better fit? You can switch plans instantly — your data, employees, and history stay exactly the same.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-2">
                {tierOrder.map(t => {
                  const info = getTierInfo(t, livePricing);
                  const price = (info.price / 100).toFixed(2);
                  const isCurrent = t === org.tier;
                  const tooSmall = info.maxEmployees !== -1 && org.employeeCount > info.maxEmployees;
                  const empLabel = info.maxEmployees === -1 ? "Unlimited employees" : `Up to ${info.maxEmployees} employees`;
                  return (
                    <button
                      key={t}
                      disabled={isCurrent || tooSmall}
                      onClick={() => setCancelUpgradeTier(t)}
                      className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                        cancelUpgradeTier === t
                          ? "border-primary bg-primary/5"
                          : isCurrent
                          ? "border-green-200 bg-green-50/50 cursor-default"
                          : tooSmall
                          ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                          : "border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
                      }`}
                      data-testid={`tier-option-${t}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm">{info.name}</span>
                          {isCurrent && <Badge variant="outline" className="ml-2 text-xs text-green-700 border-green-300">Current</Badge>}
                          {tooSmall && <span className="ml-2 text-xs text-red-500">Too many employees</span>}
                        </div>
                        <span className="font-semibold text-sm">${price}/mo</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{empLabel}</p>
                    </button>
                  );
                })}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => {
                    if (cancelUpgradeTier && cancelUpgradeTier !== org.tier) {
                      changeTier(cancelUpgradeTier);
                      setCancelStep("closed");
                      setCancelUpgradeTier("");
                    }
                  }}
                  disabled={!cancelUpgradeTier || cancelUpgradeTier === org.tier || isChangingTier}
                  className="w-full sm:w-auto"
                  data-testid="button-switch-plan-from-cancel"
                >
                  {isChangingTier ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                  Switch Plan
                </Button>
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto text-muted-foreground"
                  onClick={() => setCancelStep("confirm")}
                  data-testid="button-still-want-to-cancel"
                >
                  I still want to cancel
                </Button>
              </DialogFooter>
            </>
          )}

          {cancelStep === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Cancel Subscription?
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>If you are still in your <strong>free trial</strong>, your access will end immediately and no charge will be made.</p>
                    <p>If you have already been billed, your access will continue until the <strong>end of your current billing period</strong> — no further charges will be made after that.</p>
                    <p>Your organization data, employee accounts, and history are fully preserved. You can reactivate at any time.</p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => { setCancelStep("closed"); setCancelUpgradeTier(""); }}
                  data-testid="button-keep-subscription"
                >
                  Keep Subscription
                </Button>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  disabled={isCancelling}
                  onClick={() => {
                    cancelSubscription();
                    setCancelStep("closed");
                  }}
                  data-testid="button-confirm-cancel"
                >
                  {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Yes, Cancel Subscription
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function SuperUserTransferSection() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  type OrgUser = { id: number; fullName: string; username: string; role: string; status: string; email: string | null };
  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const eligibleUsers = orgUsers.filter(
    (u) => u.id !== user?.id && u.status === "approved" && (u.role === "admin" || u.role === "employee")
  );

  const { mutate: transfer, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/transfer-super-user", {
        targetUserId: parseInt(selectedUserId),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Super User Transferred", description: "You have been demoted to Admin. Please reload the page." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedUserId("");
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (error: Error) => {
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Super User
        </CardTitle>
        <CardDescription>
          The Super User is the only account that can remove pending accounts and manage organization settings.
          You can transfer this role to another approved user.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="text-sm">Current Super User: <strong>{user?.fullName}</strong></span>
        </div>

        {eligibleUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other approved users to transfer the role to. Add and approve users first.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Transfer Super User to</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-super-user-target">
                  <SelectValue placeholder="Select a user…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.fullName} ({u.username}) — {u.role === "admin" ? "Admin" : "Employee"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!selectedUserId || isPending}
                  data-testid="button-transfer-super-user"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Transfer Super User Role
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Transfer Super User Role?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will make{" "}
                    <strong>{eligibleUsers.find((u) => u.id === parseInt(selectedUserId))?.fullName}</strong>{" "}
                    the new Super User and demote your account to a regular Admin.
                    You will lose access to settings and account management. This cannot be undone by you.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => transfer()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-transfer"
                  >
                    Yes, Transfer Role
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureFlagsSection({ org }: { org: OrgWithFree }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [storeEnabled, setStoreEnabled] = useState(org.storeEnabled ?? true);
  const [manualOrdersEnabled, setManualOrdersEnabled] = useState(org.manualOrdersEnabled ?? true);
  const [allowEmployeePasswordCreation, setAllowEmployeePasswordCreation] = useState(org.allowEmployeePasswordCreation ?? true);
  const [ordersEnabled, setOrdersEnabled] = useState(org.ordersEnabled ?? true);

  const mutation = useMutation({
    mutationFn: async (flags: { storeEnabled: boolean; manualOrdersEnabled: boolean; allowEmployeePasswordCreation: boolean; ordersEnabled: boolean }) => {
      const res = await apiRequest("PATCH", "/api/organizations/feature-flags", flags);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/features"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save settings.", variant: "destructive" }),
  });

  const handleToggle = (field: "storeEnabled" | "manualOrdersEnabled" | "allowEmployeePasswordCreation" | "ordersEnabled", value: boolean) => {
    const next = {
      storeEnabled: field === "storeEnabled" ? value : storeEnabled,
      manualOrdersEnabled: field === "manualOrdersEnabled" ? value : manualOrdersEnabled,
      allowEmployeePasswordCreation: field === "allowEmployeePasswordCreation" ? value : allowEmployeePasswordCreation,
      ordersEnabled: field === "ordersEnabled" ? value : ordersEnabled,
    };
    if (field === "storeEnabled") setStoreEnabled(value);
    else if (field === "manualOrdersEnabled") setManualOrdersEnabled(value);
    else if (field === "allowEmployeePasswordCreation") setAllowEmployeePasswordCreation(value);
    else setOrdersEnabled(value);
    mutation.mutate(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ToggleLeft className="h-5 w-5" />
          Employee Features
        </CardTitle>
        <CardDescription>Control which features are available to employees in your organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium text-sm">Employee Store</p>
            <p className="text-xs text-muted-foreground mt-0.5">Allow employees to browse and purchase items from the store.</p>
          </div>
          <Switch
            checked={storeEnabled}
            onCheckedChange={(v) => handleToggle("storeEnabled", v)}
            disabled={mutation.isPending}
            data-testid="switch-store-enabled"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium text-sm">Manual Order Requests</p>
            <p className="text-xs text-muted-foreground mt-0.5">Allow employees to submit custom order requests for admin approval.</p>
          </div>
          <Switch
            checked={manualOrdersEnabled}
            onCheckedChange={(v) => handleToggle("manualOrdersEnabled", v)}
            disabled={mutation.isPending}
            data-testid="switch-manual-orders-enabled"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium text-sm">Employee Password Creation</p>
            <p className="text-xs text-muted-foreground mt-0.5">Allow employees to set their own password when registering for the first time.</p>
          </div>
          <Switch
            checked={allowEmployeePasswordCreation}
            onCheckedChange={(v) => handleToggle("allowEmployeePasswordCreation", v)}
            disabled={mutation.isPending}
            data-testid="switch-allow-employee-password"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium text-sm">Orders Page</p>
            <p className="text-xs text-muted-foreground mt-0.5">Show the Orders tab to employees so they can view and submit order requests.</p>
          </div>
          <Switch
            checked={ordersEnabled}
            onCheckedChange={(v) => handleToggle("ordersEnabled", v)}
            disabled={mutation.isPending}
            data-testid="switch-orders-enabled"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RoleLabelsSection({ org }: { org: OrgWithFree }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [adminLabel, setAdminLabel] = useState(org.adminRoleLabel || "Admin");
  const [employeeLabel, setEmployeeLabel] = useState(org.employeeRoleLabel || "Employee");

  const mutation = useMutation({
    mutationFn: async (data: { adminRoleLabel: string; employeeRoleLabel: string }) => {
      const res = await apiRequest("PUT", "/api/organizations/role-labels", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/role-labels"] });
      toast({ title: "Role Labels Updated", description: "Custom role names have been saved." });
      setEditing(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Role Names
          </CardTitle>
          <CardDescription>
            Customize how "Admin" and "Employee" roles are displayed throughout the portal
          </CardDescription>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => { setAdminLabel(org.adminRoleLabel || "Admin"); setEmployeeLabel(org.employeeRoleLabel || "Employee"); setEditing(true); }} data-testid="button-edit-role-labels">
            <Pencil className="mr-2 h-3 w-3" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="admin-label">Admin Role Name</Label>
                <Input id="admin-label" value={adminLabel} onChange={(e) => setAdminLabel(e.target.value)} placeholder="e.g. Group Lead" maxLength={30} data-testid="input-admin-role-label" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-label">Employee Role Name</Label>
                <Input id="employee-label" value={employeeLabel} onChange={(e) => setEmployeeLabel(e.target.value)} placeholder="e.g. Team Member" maxLength={30} data-testid="input-employee-role-label" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => mutation.mutate({ adminRoleLabel: adminLabel, employeeRoleLabel: employeeLabel })} disabled={mutation.isPending || !adminLabel.trim() || !employeeLabel.trim()} data-testid="button-save-role-labels">
                {mutation.isPending ? <SpinningLogo className="mr-2 h-3 w-3" /> : null}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Admin Role</div>
              <div className="font-medium" data-testid="text-admin-role-label">{org.adminRoleLabel || "Admin"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Employee Role</div>
              <div className="font-medium" data-testid="text-employee-role-label">{org.employeeRoleLabel || "Employee"}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DepartmentsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const { data: depts, isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/departments", { name });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department Added" });
      setAdding(false);
      setNewName("");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/departments/${id}`, { name });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department Updated" });
      setEditingId(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department Removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Departments
          </CardTitle>
          <CardDescription>
            Create departments and assign team members to them for easy filtering
          </CardDescription>
        </div>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="button-add-department">
            <Plus className="mr-2 h-3 w-3" />
            Add Department
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <div className="space-y-1">
              <Label htmlFor="dept-name">Department Name</Label>
              <Input id="dept-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Marketing" data-testid="input-new-department-name" />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => addMutation.mutate(newName.trim())} disabled={addMutation.isPending || !newName.trim()} data-testid="button-save-new-department">
                {addMutation.isPending ? <SpinningLogo className="mr-2 h-3 w-3" /> : null}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <SpinningLogo className="h-5 w-5" />
          </div>
        ) : (!depts || depts.length === 0) ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No departments created yet. Add departments to organize your team members.
          </div>
        ) : (
          <div className="space-y-2">
            {depts.map((dept) => (
              <div key={dept.id} className="border rounded-md p-3 flex items-center justify-between gap-4" data-testid={`dept-item-${dept.id}`}>
                {editingId === dept.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" data-testid={`input-edit-dept-name-${dept.id}`} />
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: dept.id, name: editName.trim() })} disabled={updateMutation.isPending || !editName.trim()}>Save</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{dept.name}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingId(dept.id); setEditName(dept.name); }} data-testid={`button-edit-dept-${dept.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid={`button-delete-dept-${dept.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {dept.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This department will be removed. Any team members assigned to it will become unassigned.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(dept.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShopWebsitesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newRate, setNewRate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editRate, setEditRate] = useState("");

  const { data: websites, isLoading } = useQuery<ShopWebsite[]>({
    queryKey: ["/api/shop-websites"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; pointsPerDollar: number }) => {
      const res = await apiRequest("POST", "/api/shop-websites", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-websites"] });
      toast({ title: "Shop Added", description: "New shop website has been added." });
      setAdding(false);
      setNewName("");
      setNewUrl("");
      setNewRate("");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; url: string; pointsPerDollar: number }) => {
      const res = await apiRequest("PATCH", `/api/shop-websites/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-websites"] });
      toast({ title: "Shop Updated" });
      setEditingId(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/shop-websites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-websites"] });
      toast({ title: "Shop Removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    const rate = parseInt(newRate);
    if (!newName.trim() || !newUrl.trim() || !rate || rate <= 0) {
      toast({ title: "Error", description: "All fields are required. Bucks must be a positive number.", variant: "destructive" });
      return;
    }
    addMutation.mutate({ name: newName.trim(), url: newUrl.trim(), pointsPerDollar: rate });
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    const rate = parseInt(editRate);
    if (!editName.trim() || !editUrl.trim() || !rate || rate <= 0) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingId, name: editName.trim(), url: editUrl.trim(), pointsPerDollar: rate });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Shop Websites & Conversion Rates
          </CardTitle>
          <CardDescription>
            Add websites your employees can shop from and set how many Bucks equal a dollar at each store.
          </CardDescription>
        </div>
        {!adding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            data-testid="button-add-shop"
          >
            <Plus className="mr-2 h-3 w-3" />
            Add Shop
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="shop-name">Shop Name</Label>
                <Input
                  id="shop-name"
                  placeholder="e.g. Amazon"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-new-shop-name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shop-url">Website URL</Label>
                <Input
                  id="shop-url"
                  type="url"
                  placeholder="https://amazon.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  data-testid="input-new-shop-url"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shop-rate">Bucks per $1</Label>
                <Input
                  id="shop-rate"
                  type="number"
                  min={1}
                  placeholder="e.g. 50"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  data-testid="input-new-shop-rate"
                />
              </div>
            </div>
            {newRate && parseInt(newRate) > 0 && (
              <p className="text-xs text-muted-foreground">
                Example: {parseInt(newRate)} Bucks = $1.00 {newName ? `on ${newName}` : ""}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={addMutation.isPending}
                data-testid="button-save-new-shop"
              >
                {addMutation.isPending ? <SpinningLogo className="mr-2 h-3 w-3" /> : null}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAdding(false); setNewName(""); setNewUrl(""); setNewRate(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <SpinningLogo className="h-5 w-5" />
          </div>
        ) : (!websites || websites.length === 0) ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No shop websites added yet. Add a shop to let employees choose where to spend their Bucks.
          </div>
        ) : (
          <div className="space-y-3">
            {websites.map((shop) => (
              <div key={shop.id} className="border rounded-md p-4" data-testid={`shop-item-${shop.id}`}>
                {editingId === shop.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Shop Name</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          data-testid={`input-edit-shop-name-${shop.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Website URL</Label>
                        <Input
                          type="url"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          data-testid={`input-edit-shop-url-${shop.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Bucks per $1</Label>
                        <Input
                          type="number"
                          min={1}
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          data-testid={`input-edit-shop-rate-${shop.id}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <SpinningLogo className="mr-2 h-3 w-3" /> : null}
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="font-medium">{shop.name}</div>
                      <a
                        href={shop.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline break-all"
                      >
                        {shop.url}
                      </a>
                      <div className="text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {shop.pointsPerDollar} bcks = $1.00
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(shop.id);
                          setEditName(shop.name);
                          setEditUrl(shop.url);
                          setEditRate(String(shop.pointsPerDollar));
                        }}
                        data-testid={`button-edit-shop-${shop.id}`}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid={`button-delete-shop-${shop.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {shop.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This shop website will be removed. Existing orders will not be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(shop.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PRESET_COLORS = [
  "#4E9F3D", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444",
  "#06B6D4", "#EC4899", "#F97316", "#10B981", "#6366F1",
  "#14B8A6", "#64748B",
];

function CategoryManagementCard() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data: categories, isLoading } = useQuery<TransactionCategory[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/categories`],
    enabled: !!user?.organizationId,
  });

  const { mutate: addCategory, isPending: adding } = useMutation({
    mutationFn: () => apiRequest("POST", `/api/organizations/${user?.organizationId}/categories`, { name: newName.trim(), color: newColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/categories`] });
      setNewName("");
      toast({ title: "Category added" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const { mutate: updateCategory, isPending: updating } = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/organizations/${user?.organizationId}/categories/${id}`, { name: editName.trim(), color: editColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/categories`] });
      setEditingId(null);
      toast({ title: "Category updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const { mutate: deleteCategory } = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/organizations/${user?.organizationId}/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/categories`] });
      toast({ title: "Category deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-categories">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Reward Categories
        </CardTitle>
        <CardDescription>
          Tag buck transactions by category to track what you're rewarding. Categories appear in analytics and reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Existing categories */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading categories…</div>
        ) : categories && categories.length > 0 ? (
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                {editingId === cat.id ? (
                  <>
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-8 max-w-[160px]"
                        data-testid={`input-edit-category-name-${cat.id}`}
                      />
                      <div className="flex gap-1 flex-wrap">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            className={`h-5 w-5 rounded-full border-2 transition-transform ${editColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditColor(c)}
                            data-testid={`color-edit-${c.slice(1)}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => updateCategory(cat.id)} disabled={updating || !editName.trim()} data-testid={`button-save-category-${cat.id}`}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-category-${cat.id}`}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium flex-1" data-testid={`text-category-name-${cat.id}`}>{cat.name}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }}
                        data-testid={`button-edit-category-${cat.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" data-testid={`button-delete-category-${cat.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This category will be removed. Existing transactions tagged with it won't be affected, but the category will no longer appear in analytics or the transaction form.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCategory(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid={`button-confirm-delete-category-${cat.id}`}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
            No categories yet. Add your first category below.
          </div>
        )}

        {/* Add new category */}
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Add a Category</p>
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Category name (e.g. Safety)"
              className="flex-1 min-w-[160px]"
              onKeyDown={e => e.key === "Enter" && newName.trim() && addCategory()}
              data-testid="input-new-category-name"
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-muted-foreground">Color:</span>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`h-6 w-6 rounded-full border-2 transition-transform ${newColor === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
                data-testid={`color-new-${c.slice(1)}`}
              />
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => addCategory()}
            disabled={adding || !newName.trim()}
            data-testid="button-add-category"
          >
            <Plus className="mr-2 h-4 w-4" />
            {adding ? "Adding…" : "Add Category"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyReportCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);
  const [pendingIds, setPendingIds] = useState<number[] | null | undefined>(undefined);
  const [dirty, setDirty] = useState(false);

  type ReportRecipientData = {
    eligible: Array<{ id: number; fullName: string; email: string | null; role: string }>;
    selectedIds: number[] | null;
  };

  const { data: recipientData, isLoading } = useQuery<ReportRecipientData>({
    queryKey: ["/api/admin/settings/report-recipients"],
  });

  // Initialise local state once data arrives
  const selectedIds: number[] = (() => {
    if (pendingIds !== undefined) return pendingIds ?? [];
    if (recipientData === undefined) return [];
    // null means "all eligible" (default)
    return recipientData.selectedIds ?? recipientData.eligible.map(u => u.id);
  })();

  const toggle = (id: number) => {
    const base = pendingIds !== undefined
      ? (pendingIds ?? recipientData?.eligible.map(u => u.id) ?? [])
      : (recipientData?.selectedIds ?? recipientData?.eligible.map(u => u.id) ?? []);
    const next = base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    setPendingIds(next);
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/admin/settings/report-recipients", { userIds: pendingIds ?? null });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/report-recipients"] });
      setDirty(false);
      toast({ title: "Recipients Saved", description: "Report recipient list has been updated." });
    },
    onError: (e: Error) => toast({ title: "Failed to Save", description: e.message, variant: "destructive" }),
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/weekly-report/trigger", {});
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to send report");
      }
      return res.json() as Promise<{ message: string; recipients: string[] }>;
    },
    onSuccess: (data) => {
      setSent(true);
      toast({ title: "Weekly Report Sent", description: data.message });
      setTimeout(() => setSent(false), 4000);
    },
    onError: (e: Error) => {
      toast({ title: "Failed to Send", description: e.message, variant: "destructive" });
    },
  });

  const eligible = recipientData?.eligible ?? [];
  const activeCount = selectedIds.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Weekly Report Emails
        </CardTitle>
        <CardDescription>
          A summary email is sent every Monday at 7 AM. Choose who receives it below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Report Recipients</Label>
            <div className="flex items-center gap-2">
              {eligible.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    const allIds = eligible.map(u => u.id);
                    const allSelected = allIds.every(id => selectedIds.includes(id));
                    setPendingIds(allSelected ? [] : allIds);
                    setDirty(true);
                  }}
                  data-testid="button-recipients-select-all"
                >
                  {eligible.length > 0 && eligible.every(u => selectedIds.includes(u.id)) ? "Deselect All" : "Select All"}
                </button>
              )}
              {dirty && (
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-recipients">
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                  {saveMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Loading…</div>
          ) : eligible.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              No admin email addresses configured. Add an email to an admin account to enable report emails.
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {eligible.map(u => {
                const checked = selectedIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    data-testid={`label-recipient-${u.id}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(u.id)}
                      data-testid={`checkbox-recipient-${u.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{u.fullName}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{u.role === "prime_admin" ? "Organization User" : "Admin"}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Schedule: <span className="font-medium text-foreground">Every Monday at 7:00 AM</span>
            {activeCount > 0 && <span className="ml-2 text-xs">· {activeCount} recipient{activeCount !== 1 ? "s" : ""}</span>}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending || sent || activeCount === 0 || dirty}
            data-testid="button-send-test-report"
            title={dirty ? "Save recipient changes before sending" : undefined}
          >
            {triggerMutation.isPending ? (
              <>Sending…</>
            ) : sent ? (
              <><Check className="mr-1.5 h-3.5 w-3.5 text-green-600" /> Sent!</>
            ) : (
              <><Send className="mr-1.5 h-3.5 w-3.5" /> Send Now</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
