import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import {
  ArrowLeft, Package, User, Search, CheckCircle2,
  MapPin, ExternalLink, ChevronDown, ChevronRight,
  Building2, Users, ShoppingBag,
} from "lucide-react";
import { SpinningLogo } from "@/components/spinning-logo";

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

function UserCard({ user, onFulfill, fulfillingId }: {
  user: OrgUser;
  onFulfill: (orderId: number) => void;
  fulfillingId: number | null;
}) {
  const [expanded, setExpanded] = useState(user.orders.length > 0);
  const hasOrders = user.orders.length > 0;

  return (
    <Card className={hasOrders ? "border-amber-200 bg-amber-50/30" : ""}>
      <CardHeader className="py-3 px-4">
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
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="flex items-start gap-1.5 mb-3 text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <AddressBlock user={user} />
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
        </CardContent>
      )}
    </Card>
  );
}

export default function DeveloperOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

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

        {/* Search + filter */}
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

        {/* Users */}
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
      </div>
    </div>
  );
}
