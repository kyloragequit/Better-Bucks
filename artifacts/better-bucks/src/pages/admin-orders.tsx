import { useState, useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePublicDemo } from "@/hooks/use-demo";
import { SpinningLogo } from "@/components/spinning-logo";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Package, Check, X, Eye, ExternalLink, Lock, Pencil, Send, Search } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useDebounce } from "@/hooks/use-debounce";
import type { Order, User } from "@shared/schema";

type OrderWithUser = Order & { user: User };

type PaginatedOrdersResponse = { orders: OrderWithUser[]; hasMore: boolean; total: number };

const PAGE_LIMIT = 50;

const SCROLL_KEY_MOBILE = "bb_orders_list_scroll_mobile";
const SCROLL_KEY_DESKTOP = "bb_orders_list_scroll_desktop";

function statusVariant(status: string) {
  switch (status) {
    case "pending": return "secondary";
    case "approved": return "default";
    case "rejected": return "destructive";
    case "completed": return "default";
    default: return "secondary";
  }
}

export default function AdminOrdersPage() {
  const isPublicDemo = usePublicDemo();
  const { data: currentUser } = useUser();
  const isPrime = currentUser?.role === "prime_admin";
  const [selectedOrder, setSelectedOrder] = useState<OrderWithUser | null>(null);
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 150);

  const { data: orgInfo } = useQuery<{ code: string }>({
    queryKey: ["/api/organizations/my-org"],
    select: (d: any) => ({ code: d.code }),
    enabled: !!isPrime,
  });
  const canSelfFulfill = isPrime && orgInfo?.code === "FEF55758";

  // Pending orders: fetch all at once (typically few)
  const { data: pendingOrders = [], isLoading: pendingLoading } = useQuery<OrderWithUser[]>({
    queryKey: ["/api/orders", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/orders?status=pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending orders");
      return res.json();
    },
  });

  // All orders: paginated via infinite query, search is server-side
  const {
    data: allOrdersData,
    isLoading: allOrdersLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<PaginatedOrdersResponse>({
    queryKey: ["/api/orders/paginated", search],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const url = new URL("/api/orders", window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(PAGE_LIMIT));
      if (search.trim()) url.searchParams.set("search", search.trim());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length + 1;
    },
  });

  const allOrders = allOrdersData?.pages.flatMap(p => p.orders) ?? [];
  const totalCount = allOrdersData?.pages[0]?.total ?? 0;
  const isLoading = pendingLoading || allOrdersLoading;

  // Pending orders are fetched all at once — filter client-side (small list)
  const matchesSearch = (order: OrderWithUser) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (order.user?.fullName ?? "").toLowerCase().includes(q) ||
      (order.description ?? "").toLowerCase().includes(q)
    );
  };

  const filteredPendingOrders = pendingOrders.filter(matchesSearch);
  // allOrders are already filtered server-side
  const filteredAllOrders = allOrders;

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6 animate-in">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground" data-testid="text-admin-orders-title">
          Orders
        </h1>
        <p className="text-muted-foreground mt-1">Review employee orders</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by employee name or item…"
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          className="pl-9"
          data-testid="input-orders-search"
        />
      </div>

      {canSelfFulfill ? (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-6">
          <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm text-green-800">
            <strong>Your org manages its own orders.</strong> Approve or reject pending requests, then mark approved orders as fulfilled once shipped.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-6" data-testid="notice-view-only">
          <Lock className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>View only.</strong> Orders are fulfilled by the Better Bucks team. Track order status here — no action required.
          </p>
        </div>
      )}

      {(pendingOrders.length > 0 && filteredPendingOrders.length > 0) && (
        <Card className="shadow-md mb-6 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Pending Orders
                <Badge variant="secondary" className="ml-2">{filteredPendingOrders.length}</Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {/* Mobile card layout */}
            <div className="sm:hidden space-y-3 px-4">
              {filteredPendingOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-3 space-y-2" data-testid={`row-pending-order-${order.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" title={order.user?.fullName || "Unknown"}>{order.user?.fullName || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words" title={order.description}>{order.description}</p>
                    </div>
                    <p className="font-bold tabular-nums text-primary text-sm shrink-0 whitespace-nowrap">{order.pointsCost.toLocaleString()} bcks</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(order.createdAt), "MMM d")}</span>
                      <Button variant="ghost" size="sm" className="h-9 w-9 sm:w-auto sm:px-3" onClick={() => setSelectedOrder(order)} aria-label={`View order from ${order.user?.fullName || "Unknown"}`} data-testid={`button-view-order-${order.id}`}>
                        <Eye className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">View</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Bucks</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPendingOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-pending-order-desktop-${order.id}`}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{order.user?.fullName || "Unknown"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                      <TableCell className="font-bold tabular-nums text-primary">
                        {order.pointsCost.toLocaleString()} bcks
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.convertedValue || "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)} data-testid={`button-view-order-desktop-${order.id}`}>
                          <Eye className="mr-1 h-4 w-4" />
                          {order.photoUrls.length > 0 ? order.photoUrls.length : ""}
                          {order.itemUrl ? " Link" : ""}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> All Orders
            {totalCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {search.trim()
                  ? `(${totalCount.toLocaleString()} matching)`
                  : `(${allOrders.length.toLocaleString()} of ${totalCount.toLocaleString()} loaded)`}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {allOrders.length === 0 && !search.trim() ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground px-4">No orders yet.</div>
          ) : allOrders.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground px-4" data-testid="text-orders-no-results">
              No orders match your search.
            </div>
          ) : (
            <AllOrdersVirtualList
              orders={filteredAllOrders}
              isPrime={!!isPrime}
              isPublicDemo={isPublicDemo}
              onViewOrder={setSelectedOrder}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
            />
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderPhotoDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} isPrime={isPrime} canSelfFulfill={!!canSelfFulfill} />
      )}

    </AdminLayout>
  );
}

function AllOrdersVirtualList({
  orders,
  isPrime,
  isPublicDemo,
  onViewOrder,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  orders: OrderWithUser[];
  isPrime: boolean;
  isPublicDemo: boolean;
  onViewOrder: (order: OrderWithUser) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const mobileParentRef = useRef<HTMLDivElement>(null);
  const desktopParentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobileEl = mobileParentRef.current;
    const desktopEl = desktopParentRef.current;

    const savedMobile = sessionStorage.getItem(SCROLL_KEY_MOBILE);
    const savedDesktop = sessionStorage.getItem(SCROLL_KEY_DESKTOP);

    if (mobileEl && savedMobile !== null) {
      mobileEl.scrollTop = parseFloat(savedMobile);
    }
    if (desktopEl && savedDesktop !== null) {
      desktopEl.scrollTop = parseFloat(savedDesktop);
    }

    return () => {
      if (mobileParentRef.current) {
        sessionStorage.setItem(SCROLL_KEY_MOBILE, String(mobileParentRef.current.scrollTop));
      }
      if (desktopParentRef.current) {
        sessionStorage.setItem(SCROLL_KEY_DESKTOP, String(desktopParentRef.current.scrollTop));
      }
    };
  }, []);

  const mobileVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: () => 110,
    overscan: 6,
  });

  const desktopVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => desktopParentRef.current,
    estimateSize: () => 53,
    overscan: 10,
  });

  const mobileVirtualItems = mobileVirtualizer.getVirtualItems();
  const desktopVirtualItems = desktopVirtualizer.getVirtualItems();

  const desktopPaddingTop = desktopVirtualItems.length > 0 ? desktopVirtualItems[0].start : 0;
  const desktopPaddingBottom =
    desktopVirtualItems.length > 0
      ? desktopVirtualizer.getTotalSize() - desktopVirtualItems[desktopVirtualItems.length - 1].end
      : 0;

  // Auto-fetch next page when user scrolls near the bottom
  const handleMobileScroll = useCallback(() => {
    const el = mobileParentRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

  const handleDesktopScroll = useCallback(() => {
    const el = desktopParentRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

  useEffect(() => {
    const el = mobileParentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleMobileScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleMobileScroll);
  }, [handleMobileScroll]);

  useEffect(() => {
    const el = desktopParentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleDesktopScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleDesktopScroll);
  }, [handleDesktopScroll]);

  return (
    <>
      {/* Mobile card layout — virtualized */}
      <div
        ref={mobileParentRef}
        className="sm:hidden overflow-y-auto px-4"
        style={{ height: "min(600px, 70vh)" }}
      >
        <div style={{ height: mobileVirtualizer.getTotalSize(), position: "relative" }}>
          {mobileVirtualItems.map((virtualRow) => {
            const order = orders[virtualRow.index];
            return (
              <div
                key={order.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: "12px",
                }}
              >
                <div className="border rounded-lg p-3 space-y-2" data-testid={`row-order-${order.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" title={order.user?.fullName || "Unknown"}>{order.user?.fullName || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words" title={order.description}>{order.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums text-primary text-sm whitespace-nowrap">{order.pointsCost.toLocaleString()} bcks</p>
                      <Badge variant={statusVariant(order.status)} className="capitalize text-xs mt-0.5" data-testid={`badge-status-${order.id}`}>{order.status}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d")}</span>
                      <Button variant="ghost" size="sm" className="h-9 w-9 sm:w-auto sm:px-3" onClick={() => onViewOrder(order)} aria-label={`View order from ${order.user?.fullName || "Unknown"}`} data-testid={`button-view-photos-${order.id}`}>
                        <Eye className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">View</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <SpinningLogo className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Desktop table — virtualized */}
      <div
        ref={desktopParentRef}
        className="hidden sm:block overflow-x-auto overflow-y-auto"
        style={{ height: "min(600px, 70vh)" }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Bucks</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {desktopPaddingTop > 0 && (
              <tr><td style={{ height: desktopPaddingTop }} /></tr>
            )}
            {desktopVirtualItems.map((virtualRow) => {
              const order = orders[virtualRow.index];
              return (
                <TableRow key={order.id} data-testid={`row-order-desktop-${order.id}`}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{order.user?.fullName || "Unknown"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                  <TableCell className="font-bold tabular-nums text-primary">
                    {order.pointsCost.toLocaleString()} bcks
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.convertedValue || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)} className="capitalize" data-testid={`badge-status-desktop-${order.id}`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => onViewOrder(order)} data-testid={`button-view-photos-desktop-${order.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      {order.photoUrls.length > 0 ? order.photoUrls.length : ""}
                      {order.itemUrl ? " Link" : ""}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {desktopPaddingBottom > 0 && (
              <tr><td style={{ height: desktopPaddingBottom }} /></tr>
            )}
            {isFetchingNextPage && (
              <tr>
                <td colSpan={7} className="py-4 text-center">
                  <SpinningLogo className="h-5 w-5 text-muted-foreground inline-block" />
                </td>
              </tr>
            )}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center pt-3 pb-1">
          <Button variant="outline" size="sm" onClick={() => onLoadMore()} data-testid="button-load-more-orders">
            Load more orders
          </Button>
        </div>
      )}
    </>
  );
}

function OrderActionButton({ orderId, action, label, variant = "default" }: { orderId: number; action: string; label: string; variant?: "default" | "destructive" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/pending-count"] });
      toast({ title: "Order Updated", description: `Order has been ${action}.` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Button
      size="sm"
      variant={variant === "destructive" ? "destructive" : "default"}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-label={label}
      className="h-9 w-9 p-0 sm:w-auto sm:px-3"
      data-testid={`button-${action}-order-${orderId}`}
    >
      {mutation.isPending ? (
        <SpinningLogo className="h-4 w-4" />
      ) : action === "approved" ? (
        <><Check className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{label}</span></>
      ) : action === "rejected" ? (
        <><X className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{label}</span></>
      ) : (
        <><Check className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{label}</span></>
      )}
    </Button>
  );
}

function OrderPhotoDialog({ order, onClose, isPrime, canSelfFulfill }: { order: OrderWithUser; onClose: () => void; isPrime: boolean | undefined; canSelfFulfill: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState(order.adminNotes ?? "");
  const [newBucks, setNewBucks] = useState(String(order.pointsCost));
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingBucks, setSavingBucks] = useState(false);
  const [actioning, setActioning] = useState(false);

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders", "pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/orders/paginated"] });
    queryClient.invalidateQueries({ queryKey: ["/api/orders/pending-count"] });
  };

  const handleStatusChange = async (newStatus: "approved" | "rejected") => {
    setActioning(true);
    try {
      const res = await apiRequest("PATCH", `/api/orders/${order.id}/status`, { status: newStatus, adminNotes });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update order");
      }
      invalidateOrders();
      toast({ title: newStatus === "approved" ? "Order approved" : "Order rejected" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleFulfill = async () => {
    setActioning(true);
    try {
      const res = await apiRequest("PATCH", `/api/orders/${order.id}/admin-fulfill`, { adminNotes });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fulfill order");
      }
      invalidateOrders();
      toast({ title: "Order fulfilled", description: "Confirmation email sent to the employee." });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActioning(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: order.status, adminNotes }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save notes");
      queryClient.invalidateQueries({ queryKey: ["/api/orders", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/paginated"] });
      toast({ title: "Notes saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveBucks = async () => {
    const cost = parseInt(newBucks);
    if (!cost || cost <= 0) {
      toast({ title: "Invalid", description: "Enter a valid Bucks amount.", variant: "destructive" });
      return;
    }
    setSavingBucks(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/bucks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCost: cost }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to update Bucks");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/paginated"] });
      toast({ title: "Bucks updated", description: `Order Bucks changed to ${cost.toLocaleString()}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingBucks(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>
            {order.user?.fullName || "Unknown"} — {format(new Date(order.createdAt), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
            <p className="mt-1 text-sm">{order.description}</p>
          </div>

          {order.itemUrl && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Item Link</Label>
              <a
                href={order.itemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1.5 text-sm text-primary underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {order.itemUrl}
              </a>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bucks</Label>
              <p className="mt-1 font-bold tabular-nums text-primary">{order.pointsCost.toLocaleString()} bcks</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
              <div className="mt-1">
                <Badge variant={statusVariant(order.status)} className="capitalize">{order.status}</Badge>
              </div>
            </div>
            {order.convertedValue && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Value</Label>
                <p className="mt-1 text-sm text-muted-foreground">{order.convertedValue}</p>
              </div>
            )}
          </div>

          {order.photoUrls && order.photoUrls.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Photos</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {order.photoUrls.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden border aspect-square hover:opacity-90 transition-opacity">
                    <img src={url} alt={`Order photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {isPrime && order.status !== "rejected" && (
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label htmlFor="admin-notes" className="flex items-center gap-1.5 text-sm font-medium">
                  <Pencil className="h-3.5 w-3.5" /> Admin Notes
                </Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes visible to the employee…"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                  data-testid="input-admin-notes"
                />
                <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={savingNotes} data-testid="button-save-notes">
                  {savingNotes ? <SpinningLogo className="h-4 w-4 mr-1" /> : null}
                  Save Notes
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bucks-adjust" className="flex items-center gap-1.5 text-sm font-medium">
                  <Pencil className="h-3.5 w-3.5" /> Adjust Bucks
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="bucks-adjust"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={newBucks}
                    onChange={e => setNewBucks(e.target.value)}
                    className="w-36"
                    data-testid="input-bucks-adjust"
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveBucks} disabled={savingBucks} data-testid="button-save-bucks">
                    {savingBucks ? <SpinningLogo className="h-4 w-4 mr-1" /> : null}
                    Update Bucks
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Adjusting will update the employee's balance accordingly.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canSelfFulfill && order.status === "pending" && (
            <div className="flex gap-2 sm:mr-auto">
              <Button size="sm" variant="destructive" onClick={() => handleStatusChange("rejected")} disabled={actioning} data-testid={`button-reject-order-${order.id}`}>
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button size="sm" className="bg-primary" onClick={() => handleStatusChange("approved")} disabled={actioning} data-testid={`button-approve-order-${order.id}`}>
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            </div>
          )}
          {canSelfFulfill && order.status === "approved" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 sm:mr-auto" onClick={handleFulfill} disabled={actioning} data-testid={`button-fulfill-order-${order.id}`}>
              <Check className="h-4 w-4 mr-1" /> Mark Fulfilled
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

