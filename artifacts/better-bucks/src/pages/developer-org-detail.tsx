import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import {
  ArrowLeft, Package, User, Search, CheckCircle2,
  MapPin, ExternalLink, ChevronDown, ChevronRight,
  Building2, Users, ShoppingBag, Store, Plus, Copy,
  Trash2, ImageIcon, Tag,
} from "lucide-react";
import { SpinningLogo } from "@/components/spinning-logo";

// ─── Types ───────────────────────────────────────────────────────────────────

type OrgUser = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: string;
  balance: number;
  status: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
  termsAcceptedAt: string | null;
  marketingOptIn: boolean;
  orders: OrgOrder[];
};

type OrgOrder = {
  id: number;
  description: string;
  pointsCost: number;
  status: string;
  createdAt: string;
  itemUrl: string | null;
  selectedSize: string | null;
  selectedColor: string | null;
  adminNotes: string | null;
};

type OrgDetail = {
  id: number;
  name: string;
  code: string;
  status: string;
  tier: string;
  pendingOrderCount: number;
  users: OrgUser[];
};

type StoreItem = {
  id: number;
  organizationId: number;
  name: string;
  price: number;
  url: string | null;
  imageUrl: string | null;
  available: boolean;
  requiresSize: boolean;
  requiresColor: boolean;
  createdAt: string;
};

type StoreItemWithOrg = StoreItem & {
  orgName: string;
  orgCode: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  prime_admin: "Owner",
  admin: "Admin",
  employee: "Employee",
  developer: "Developer",
};

const ROLE_COLORS: Record<string, string> = {
  prime_admin: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  employee: "bg-gray-100 text-gray-700 border-gray-200",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function AddressBlock({ user }: { user: OrgUser }) {
  const parts = [
    user.shippingAddressLine1,
    user.shippingAddressLine2,
    [user.shippingCity, user.shippingState].filter(Boolean).join(", "),
    user.shippingZip,
    user.shippingCountry,
  ].filter(Boolean);
  if (parts.length === 0) return <span className="text-xs text-muted-foreground italic">No address on file</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {parts.join(" · ")}
    </span>
  );
}

// ─── UserCard ────────────────────────────────────────────────────────────────

function UserCard({ user, onFulfill, fulfillingId }: {
  user: OrgUser;
  onFulfill: (orderId: number) => void;
  fulfillingId: number | null;
}) {
  const [expanded, setExpanded] = useState(user.orders.length > 0);
  const hasOrders = user.orders.length > 0;

  return (
    <Card className={hasOrders ? "border-amber-200 bg-amber-50/30" : ""}>
      <div className="py-3 px-4">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 w-full text-left group"
        >
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
            {initials(user.fullName || user.username)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{user.fullName || user.username}</span>
              <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {hasOrders && (
                <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1.5">
                  {user.orders.length} pending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">@{user.username}</span>
              {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
              <span className="text-xs font-medium text-primary">{user.balance.toLocaleString()} Bucks</span>
            </div>
          </div>
          <div className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>
      </div>

      {expanded && (
        <div className="pt-0 px-4 pb-4">
          <div className="flex items-start gap-1.5 mb-2 text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <AddressBlock user={user} />
          </div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {user.termsAcceptedAt ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                T&amp;C signed {new Date(user.termsAcceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-red-500">
                <span className="font-bold">✗</span> T&amp;C not accepted
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${user.marketingOptIn ? "text-blue-600" : "text-muted-foreground"}`}>
              {user.marketingOptIn ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-bold">✗</span>}
              Marketing {user.marketingOptIn ? "opted in" : "not opted in"}
            </span>
          </div>

          {hasOrders ? (
            <div className="space-y-3">
              {user.orders.map(order => (
                <div key={order.id} className="border rounded-lg bg-white p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{order.description}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span className="font-medium text-primary">{order.pointsCost.toLocaleString()} Bucks</span>
                        {order.selectedSize && <span>Size: {order.selectedSize}</span>}
                        {order.selectedColor && <span>Color: {order.selectedColor}</span>}
                        <span>#{order.id}</span>
                        <span>{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      {order.itemUrl && (
                        <a
                          href={order.itemUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Item
                        </a>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                      disabled={fulfillingId === order.id}
                      onClick={() => onFulfill(order.id)}
                      data-testid={`button-fulfill-order-${order.id}`}
                    >
                      {fulfillingId === order.id
                        ? <SpinningLogo className="h-3.5 w-3.5 mr-1" />
                        : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                      Fulfill
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No pending orders</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── StoreTab ────────────────────────────────────────────────────────────────

function StoreItemRow({ item, action }: {
  item: StoreItem | StoreItemWithOrg;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover flex-shrink-0 bg-gray-100" />
      ) : (
        <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-0.5 font-medium text-primary">
            <Tag className="h-3 w-3" />{item.price.toLocaleString()} Bucks
          </span>
          {"orgName" in item && (
            <span className="inline-flex items-center gap-0.5">
              <Building2 className="h-3 w-3" />{(item as StoreItemWithOrg).orgName}
              <code className="ml-1 bg-gray-100 px-1 rounded text-[10px]">{(item as StoreItemWithOrg).orgCode}</code>
            </span>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
              <ExternalLink className="h-3 w-3" />Link
            </a>
          )}
          {!item.available && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">Hidden</Badge>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function StoreTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const orgItemsKey = `/api/developer/organizations/${orgId}/store-items`;

  const { data: orgItems = [], isLoading: orgItemsLoading } = useQuery<StoreItem[]>({
    queryKey: [orgItemsKey],
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<StoreItemWithOrg[]>({
    queryKey: ["/api/developer/store-items/search", debouncedSearch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/developer/store-items/search?q=${encodeURIComponent(debouncedSearch)}`);
      return res.json();
    },
    enabled: debouncedSearch.length > 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [orgItemsKey] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/developer/organizations/${orgId}/store-items`, {
        name: newName.trim(),
        price: parseInt(newPrice),
        url: newUrl.trim() || undefined,
        imageUrl: newImageUrl.trim() || undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item added to store" });
      setNewName(""); setNewPrice(""); setNewUrl(""); setNewImageUrl("");
      setShowCreate(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyMutation = useMutation({
    mutationFn: async (sourceItemId: number) => {
      setAddingId(sourceItemId);
      const res = await apiRequest("POST", `/api/developer/organizations/${orgId}/store-items/copy`, { sourceItemId });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to add item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item added to org's store" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    onSettled: () => setAddingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      setDeletingId(itemId);
      const res = await apiRequest("DELETE", `/api/developer/store-items/${itemId}`);
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      toast({ title: "Item removed from store" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    onSettled: () => setDeletingId(null),
  });

  const orgItemNames = new Set(orgItems.map(i => i.name.toLowerCase()));
  const orgItemIds = new Set(orgItems.map(i => i.id));
  const filteredSearchResults = searchResults.filter(
    i => !orgItemIds.has(i.id) && !orgItemNames.has(i.name.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Current store items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-foreground">
            Current Store Items
            <span className="ml-2 text-xs font-normal text-muted-foreground">({orgItemsLoading ? "…" : orgItems.length})</span>
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowCreate(v => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create New
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="mb-4 border-primary/40 bg-primary/5">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Item Name *</Label>
                  <Input
                    placeholder="e.g. Nike Hoodie"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    data-testid="input-new-store-item-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Price (Bucks) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 5000"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    data-testid="input-new-store-item-price"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    placeholder="https://…"
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Product URL</Label>
                  <Input
                    placeholder="https://…"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setNewName(""); setNewPrice(""); setNewUrl(""); setNewImageUrl(""); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!newName.trim() || !newPrice || isNaN(parseInt(newPrice)) || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  data-testid="button-create-store-item"
                >
                  {createMutation.isPending ? <SpinningLogo className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Add to Store
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {orgItemsLoading ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : orgItems.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg bg-white">
            <Store className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No store items yet.</p>
            <p className="text-xs mt-1">Create one above or search below to add from another org's catalog.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orgItems.map(item => (
              <StoreItemRow
                key={item.id}
                item={item}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                    disabled={deletingId === item.id}
                    onClick={() => deleteMutation.mutate(item.id)}
                    data-testid={`button-delete-store-item-${item.id}`}
                  >
                    {deletingId === item.id
                      ? <SpinningLogo className="h-3.5 w-3.5" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Search & copy from other orgs */}
      <section>
        <h3 className="font-semibold text-sm mb-3">Add from Existing Catalog</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items across all orgs to copy here…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-store-item-search"
          />
        </div>

        {!search && (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            Type to search items created for any organization.
          </p>
        )}
        {search && searchLoading && (
          <div className="flex justify-center py-8"><Loader /></div>
        )}
        {search && !searchLoading && filteredSearchResults.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No items found matching "{search}".</p>
        )}
        {filteredSearchResults.length > 0 && (
          <div className="space-y-2">
            {filteredSearchResults.map(item => (
              <StoreItemRow
                key={item.id}
                item={item}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addingId === item.id}
                    onClick={() => copyMutation.mutate(item.id)}
                    data-testid={`button-add-store-item-${item.id}`}
                  >
                    {addingId === item.id
                      ? <SpinningLogo className="h-3.5 w-3.5 mr-1" />
                      : <Copy className="h-3.5 w-3.5 mr-1" />}
                    Add
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "users" | "store";

export default function DeveloperOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("users");

  const orgId = parseInt(id ?? "0");

  const { data: org, isLoading, error } = useQuery<OrgDetail>({
    queryKey: [`/api/developer/organizations/${orgId}/detail`],
    enabled: !isNaN(orgId) && orgId > 0,
  });

  const [fulfillingId, setFulfillingId] = useState<number | null>(null);

  const fulfillMutation = useMutation({
    mutationFn: async (orderId: number) => {
      setFulfillingId(orderId);
      await apiRequest("PATCH", `/api/developer/orders/${orderId}/fulfill`);
    },
    onSuccess: () => {
      toast({ title: "Order fulfilled", description: "Confirmation email sent to the employee." });
      queryClient.invalidateQueries({ queryKey: [`/api/developer/organizations/${orgId}/detail`] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to fulfill order.", variant: "destructive" });
    },
    onSettled: () => setFulfillingId(null),
  });

  const filtered = (org?.users ?? []).filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const withOrders = filtered.filter(u => u.orders.length > 0);
  const withoutOrders = filtered.filter(u => u.orders.length === 0);
  const displayed = showAll ? filtered : [...withOrders, ...withoutOrders];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Organization not found.</p>
        <Button variant="outline" onClick={() => navigate("/developer/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/developer/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Dashboard
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
              <h1 className="font-bold text-base truncate">{org.name}</h1>
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{org.code}</code>
              <Badge
                variant={org.status === "active" ? "default" : "destructive"}
                className={`capitalize text-xs ${org.status === "paused" ? "bg-amber-500" : ""}`}
              >
                {org.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold">{org.users.length}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>
          <Card className={org.pendingOrderCount > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="pt-4 pb-4 text-center">
              <Package className="h-5 w-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{org.pendingOrderCount}</p>
              <p className="text-xs text-muted-foreground">Pending Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <User className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-2xl font-bold">{org.users.filter(u => u.orders.length > 0).length}</p>
              <p className="text-xs text-muted-foreground">Users with Orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-users"
          >
            <Users className="h-4 w-4" />
            Users
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">{org.users.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab("store")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "store"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-store"
          >
            <Store className="h-4 w-4" />
            Store
          </button>
        </div>

        {/* Users tab */}
        {activeTab === "users" && (
          <>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, username, or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showAll ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAll(v => !v)}
              >
                {showAll ? "Pending first" : "Show all"}
              </Button>
            </div>

            {displayed.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No users match your search.</p>
            ) : (
              <div className="space-y-3">
                {withOrders.length > 0 && !showAll && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    {withOrders.length} user{withOrders.length !== 1 ? "s" : ""} with pending orders
                  </p>
                )}
                {displayed.map(user => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onFulfill={orderId => fulfillMutation.mutate(orderId)}
                    fulfillingId={fulfillingId}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Store tab */}
        {activeTab === "store" && (
          <StoreTab orgId={orgId} />
        )}
      </div>
    </div>
  );
}
