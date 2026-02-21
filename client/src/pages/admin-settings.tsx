import { AdminLayout } from "@/components/layout-admin";
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
import { Building2, CreditCard, Shield, Loader2, AlertTriangle, Copy, Check, Users, ExternalLink, Pencil, ArrowUpDown, Trash2, Store, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Organization, ShopWebsite } from "@shared/schema";

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

const tierLabels: Record<string, string> = {
  small: "Small Site",
  mid: "Mid-Size Site",
  large: "Large Site",
  enterprise: "Enterprise Site",
};

const tierPrices: Record<string, number> = {
  small: 149,
  mid: 349,
  large: 599,
  enterprise: 999,
};

export default function AdminSettingsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: org, isLoading } = useQuery<OrgWithFree>({
    queryKey: ["/api/organizations/my-org"],
    enabled: user?.role === "prime_admin",
  });

  const { mutate: cancelSubscription, isPending: isCancelling } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/cancel-subscription");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my-org"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your organization's subscription has been cancelled.",
      });
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

  const { mutate: deleteOrganization, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/delete");
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

  const handleCopyCode = () => {
    if (org?.code) {
      navigator.clipboard.writeText(org.code);
      setCopied(true);
      toast({ title: "Copied!", description: "Organization code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (user?.role !== "prime_admin") {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-muted-foreground">
          Only the primary administrator can access settings.
        </div>
      </AdminLayout>
    );
  }

  const tierLabel = org ? (tierLabels[org.tier] || org.tier) : "";
  const tierPrice = org ? (tierPrices[org.tier] || 0) : 0;
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
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  {org.status === "active" ? "Active" : org.status === "inactive" ? "Cancelled" : "Pending"}
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
                      {org.isFree ? "Free" : `$${tierPrice}/month`}
                    </div>
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
                        {isUpdatingUrl ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid="button-delete-org">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Organization
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete your organization, all employee accounts, transaction history, and orders. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteOrganization()}
                              disabled={isDeleting}
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
                        <div className="font-medium">{tierLabel} - ${tierPrice}/month</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className="font-medium text-green-600">Active</div>
                      </div>
                    </div>

                    {changingTier ? (
                      <div className="border-t pt-4 space-y-3">
                        <Label>Select a new plan</Label>
                        <Select value={selectedTier} onValueChange={setSelectedTier}>
                          <SelectTrigger data-testid="select-new-tier">
                            <SelectValue placeholder="Choose a plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {org.tier !== "small" && <SelectItem value="small">Small Site - $149/mo (up to 100)</SelectItem>}
                            {org.tier !== "mid" && <SelectItem value="mid">Mid-Size Site - $349/mo (up to 300)</SelectItem>}
                            {org.tier !== "large" && <SelectItem value="large">Large Site - $599/mo (up to 500)</SelectItem>}
                            {org.tier !== "enterprise" && <SelectItem value="enterprise">Enterprise - $999/mo (unlimited)</SelectItem>}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => changeTier(selectedTier)}
                            disabled={isChangingTier || !selectedTier}
                            data-testid="button-confirm-change-tier"
                          >
                            {isChangingTier ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
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

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" data-testid="button-cancel-subscription">
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Cancel Subscription
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will immediately cancel your organization's subscription. 
                                All team members will lose access to the portal. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-dialog-cancel">Keep Subscription</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelSubscription()}
                                className="bg-destructive text-destructive-foreground"
                                disabled={isCancelling}
                                data-testid="button-confirm-cancel"
                              >
                                {isCancelling ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelling...
                                  </>
                                ) : (
                                  "Yes, Cancel Subscription"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Subscription Cancelled</div>
                      <div>Your organization's subscription has been cancelled.</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Unable to load organization information.
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
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
      toast({ title: "Error", description: "All fields are required. Points must be a positive number.", variant: "destructive" });
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
            Add websites your employees can shop from and set how many points equal a dollar at each store.
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
                <Label htmlFor="shop-rate">Points per $1</Label>
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
                Example: {parseInt(newRate)} points = $1.00 {newName ? `on ${newName}` : ""}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={addMutation.isPending}
                data-testid="button-save-new-shop"
              >
                {addMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
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
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (!websites || websites.length === 0) ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No shop websites added yet. Add a shop to let employees choose where to spend their points.
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
                        <Label>Points per $1</Label>
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
                        {updateMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
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
                          {shop.pointsPerDollar} pts = $1.00
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
