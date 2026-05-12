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
import { Package, Check, X, Eye, ExternalLink, Lock, Pencil, ShoppingCart, Download, Send, Mail, Search } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useDebounce } from "@/hooks/use-debounce";
import type { Order, User } from "@shared/schema";

type OrderWithUser = Order & { user: User };

type ShoppingListVariant = { size: string; color: string; qty: number; employees: string[] };
type ShoppingListItem = { name: string; variants: ShoppingListVariant[] };
type ShoppingListData = { items: ShoppingListItem[]; generatedAt: string; totalOrders: number };

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
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 150);

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
        <p className="text-muted-foreground mt-1">Review and manage employee orders</p>
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

      {!isPrime && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6" data-testid="notice-view-only">
          <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>View only.</strong> Only the Organization Owner can approve, reject, or complete orders. Contact your Organization Owner to action any pending orders.
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
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowShoppingList(true)}
                data-testid="button-open-shopping-list"
              >
                <ShoppingCart className="h-4 w-4" />
                Shopping List
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 mt-1">
              <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Remember:</strong> after approving an order, you must visit your <strong className="text-foreground">store website</strong> to place the physical order on behalf of the employee. The Bucks are deducted here, but the item ships from the store.
              </p>
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
                    {isPrime && !isPublicDemo && (
                      <div className="flex gap-1.5">
                        <OrderActionButton orderId={order.id} action="approved" label="Approve" />
                        <OrderActionButton orderId={order.id} action="rejected" label="Reject" variant="destructive" />
                      </div>
                    )}
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        {isPrime && !isPublicDemo && (
                          <div className="flex justify-end gap-2">
                            <OrderActionButton orderId={order.id} action="approved" label="Approve" />
                            <OrderActionButton orderId={order.id} action="rejected" label="Reject" variant="destructive" />
                          </div>
                        )}
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
        <OrderPhotoDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} isPrime={isPrime} />
      )}

      {showShoppingList && (
        <ShoppingListDialog onClose={() => setShowShoppingList(false)} />
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
                    <div className="flex gap-1.5">
                      {isPrime && !isPublicDemo && order.status === "pending" && (
                        <>
                          <OrderActionButton orderId={order.id} action="approved" label="Approve" />
                          <OrderActionButton orderId={order.id} action="rejected" label="Reject" variant="destructive" />
                        </>
                      )}
                      {isPrime && !isPublicDemo && order.status === "approved" && (
                        <OrderActionButton orderId={order.id} action="completed" label="Complete" />
                      )}
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
              <TableHead className="text-right">Actions</TableHead>
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
                  <TableCell className="text-right">
                    {isPrime && !isPublicDemo && order.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <OrderActionButton orderId={order.id} action="approved" label="Approve" />
                        <OrderActionButton orderId={order.id} action="rejected" label="Reject" variant="destructive" />
                      </div>
                    )}
                    {isPrime && !isPublicDemo && order.status === "approved" && (
                      <OrderActionButton orderId={order.id} action="completed" label="Complete" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {desktopPaddingBottom > 0 && (
              <tr><td style={{ height: desktopPaddingBottom }} /></tr>
            )}
            {isFetchingNextPage && (
              <tr>
                <td colSpan={8} className="py-4 text-center">
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

function OrderPhotoDialog({ order, onClose, isPrime }: { order: OrderWithUser; onClose: () => void; isPrime: boolean | undefined }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState(order.adminNotes ?? "");
  const [newBucks, setNewBucks] = useState(String(order.pointsCost));
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingBucks, setSavingBucks] = useState(false);

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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShoppingListDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data, isLoading } = useQuery<ShoppingListData>({
    queryKey: ["/api/orders/shopping-list"],
  });

  const totalQty = data?.items.reduce((sum, item) => sum + item.variants.reduce((s, v) => s + v.qty, 0), 0) ?? 0;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/api/orders/shopping-list/csv";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast({ title: "Email required", description: "Please enter an email address.", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const res = await apiRequest("POST", "/api/orders/shopping-list/send", { email: emailTo.trim() });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to send email");
      }
      toast({ title: "Sent!", description: `Shopping list emailed to ${emailTo.trim()}.` });
      setEmailTo("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Shopping List
          </DialogTitle>
          <DialogDescription>
            Compiled from all pending orders — {data?.totalOrders ?? "…"} order{data?.totalOrders !== 1 ? "s" : ""}, {totalQty} total item{totalQty !== 1 ? "s" : ""}
            {data?.generatedAt && (
              <span className="ml-1 text-xs text-muted-foreground">
                · generated {format(new Date(data.generatedAt), "MMM d, h:mm a")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Preview table */}
        <div className="rounded-lg border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-24"><Loader /></div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">No pending orders to compile.</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">Size</TableHead>
                  <TableHead className="font-semibold">Color</TableHead>
                  <TableHead className="font-semibold text-center">Qty</TableHead>
                  <TableHead className="font-semibold">Ordered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) =>
                  item.variants.map((variant, vIdx) => (
                    <TableRow key={`${item.name}-${vIdx}`}>
                      {vIdx === 0 && (
                        <TableCell rowSpan={item.variants.length} className="font-medium align-top py-3">
                          {item.name}
                        </TableCell>
                      )}
                      <TableCell className="py-3 text-sm">{variant.size || "—"}</TableCell>
                      <TableCell className="py-3 text-sm">{variant.color || "—"}</TableCell>
                      <TableCell className="py-3 text-center font-bold tabular-nums">{variant.qty}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{variant.employees.join(", ")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button variant="outline" className="w-full flex items-center gap-2" onClick={handleDownload} data-testid="button-download-csv">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Send to email…"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              data-testid="input-email-shopping-list"
            />
            <Button
              variant="outline"
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="shrink-0 flex items-center gap-2"
              data-testid="button-send-email-shopping-list"
            >
              {sendingEmail ? <SpinningLogo className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
