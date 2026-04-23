import { useState } from "react";
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
import { Package, Check, X, Eye, ExternalLink, Lock, Pencil } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Order, User } from "@shared/schema";

type OrderWithUser = Order & { user: User };

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
  const { data: orders, isLoading } = useQuery<OrderWithUser[]>({
    queryKey: ["/api/orders"],
  });
  const [selectedOrder, setSelectedOrder] = useState<OrderWithUser | null>(null);

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;

  const pendingOrders = orders?.filter(o => o.status === "pending") || [];
  const otherOrders = orders?.filter(o => o.status !== "pending") || [];

  return (
    <AdminLayout>
      <div className="mb-8 animate-in">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground" data-testid="text-admin-orders-title">
          Orders
        </h1>
        <p className="text-muted-foreground mt-1">Review and manage employee orders</p>
      </div>

      {!isPrime && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6" data-testid="notice-view-only">
          <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>View only.</strong> Only the Organization Owner can approve, reject, or complete orders. Contact your Organization Owner to action any pending orders.
          </p>
        </div>
      )}

      {pendingOrders.length > 0 && (
        <Card className="shadow-md mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pending Orders
              <Badge variant="secondary" className="ml-2">{pendingOrders.length}</Badge>
            </CardTitle>
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
              {pendingOrders.map((order) => (
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
                  {pendingOrders.map((order) => (
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
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {(!orders || orders.length === 0) ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground px-4">No orders yet.</div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3 px-4">
                {orders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-3 space-y-2" data-testid={`row-order-${order.id}`}>
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
                        <Button variant="ghost" size="sm" className="h-9 w-9 sm:w-auto sm:px-3" onClick={() => setSelectedOrder(order)} aria-label={`View order from ${order.user?.fullName || "Unknown"}`} data-testid={`button-view-photos-${order.id}`}>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
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
                          <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)} data-testid={`button-view-photos-desktop-${order.id}`}>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderPhotoDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} isPrime={isPrime} />
      )}
    </AdminLayout>
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
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
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
      data-testid={`button-${action}-order-${orderId}`}
    >
      {mutation.isPending ? (
        <SpinningLogo className="h-4 w-4" />
      ) : action === "approved" ? (
        <><Check className="mr-1 h-4 w-4" /> {label}</>
      ) : action === "rejected" ? (
        <><X className="mr-1 h-4 w-4" /> {label}</>
      ) : (
        label
      )}
    </Button>
  );
}

function OrderPhotoDialog({ order, onClose, isPrime }: { order: OrderWithUser; onClose: () => void; isPrime: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingBucks, setEditingBucks] = useState(false);
  const [newBucks, setNewBucks] = useState(order.pointsCost.toString());

  const adjustBucksMutation = useMutation({
    mutationFn: async (newCost: number) => {
      const res = await apiRequest("PATCH", `/api/orders/${order.id}/bucks`, { newCost });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to adjust Bucks");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Bucks Adjusted", description: `Order #${order.id} Bucks updated.` });
      setEditingBucks(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSaveBucks = () => {
    const parsed = parseInt(newBucks);
    if (isNaN(parsed) || parsed < 1) {
      toast({ title: "Invalid amount", description: "Bucks must be at least 1.", variant: "destructive" });
      return;
    }
    if (parsed === order.pointsCost) { setEditingBucks(false); return; }
    adjustBucksMutation.mutate(parsed);
  };

  const canAdjustBucks = isPrime && order.status !== "rejected";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order #{order.id} - Details</DialogTitle>
          <DialogDescription>
            Submitted by {order.user?.fullName} on {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium">Description:</span> {order.description}
          </div>
          <div className="text-sm flex items-center gap-2">
            <span className="font-medium">Bucks:</span>
            {editingBucks ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={newBucks}
                  onChange={(e) => setNewBucks(e.target.value)}
                  className="min-h-7 w-auto min-w-20 text-sm"
                  autoFocus
                  data-testid="input-adjust-bucks"
                />
                <Button size="sm" className="min-h-7 px-2 text-xs" onClick={handleSaveBucks} disabled={adjustBucksMutation.isPending} data-testid="button-save-bucks">
                  {adjustBucksMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="min-h-7 px-2 text-xs" onClick={() => { setEditingBucks(false); setNewBucks(order.pointsCost.toString()); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <span className="flex items-center gap-1.5">
                {order.pointsCost.toLocaleString()}
                {canAdjustBucks && (
                  <button
                    type="button"
                    onClick={() => setEditingBucks(true)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-5 sm:min-w-5 text-muted-foreground hover:text-primary transition-colors"
                    title="Adjust Bucks"
                    aria-label="Adjust Bucks"
                    data-testid="button-edit-bucks"
                  >
                    <Pencil className="h-4 w-4 sm:h-3 sm:w-3" />
                  </button>
                )}
              </span>
            )}
          </div>
          {canAdjustBucks && !editingBucks && (
            <p className="text-xs text-muted-foreground -mt-1">
              Adjusting Bucks will refund or charge the difference to the employee's balance.
            </p>
          )}
          {order.convertedValue && (
            <div className="text-sm">
              <span className="font-medium">USD Value:</span> {order.convertedValue}
            </div>
          )}
          {(order.quantity ?? 1) > 1 && (
            <div className="text-sm">
              <span className="font-medium">Quantity:</span> {order.quantity}
            </div>
          )}
          {order.selectedSize && (
            <div className="text-sm">
              <span className="font-medium">Size:</span> {order.selectedSize}
            </div>
          )}
          {order.selectedColor && (
            <div className="text-sm">
              <span className="font-medium">Color:</span> {order.selectedColor}
            </div>
          )}
          {order.itemUrl && (
            <div className="text-sm">
              <span className="font-medium">Item Link:</span>{" "}
              <a
                href={order.itemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
                data-testid="link-order-item-url"
              >
                {order.itemUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {order.photoUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {order.photoUrls.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden border aspect-square">
                  <img src={url} alt={`Order photo ${idx + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {order.photoUrls.length === 0 && !order.itemUrl && (
            <p className="text-sm text-muted-foreground">No photos or links attached</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
