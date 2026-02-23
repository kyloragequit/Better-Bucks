import { useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Package, Check, X, Eye, Loader2, ExternalLink } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
        <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-admin-orders-title">
          Orders
        </h1>
        <p className="text-muted-foreground mt-1">Review and manage employee orders</p>
      </div>

      {pendingOrders.length > 0 && (
        <Card className="shadow-md mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pending Orders
              <Badge variant="secondary" className="ml-2">{pendingOrders.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`row-pending-order-${order.id}`}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{order.user?.fullName || "Unknown"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                    <TableCell className="font-bold tabular-nums text-primary">
                      {order.pointsCost.toLocaleString()} pts
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.convertedValue || "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)} data-testid={`button-view-order-${order.id}`}>
                        <Eye className="mr-1 h-4 w-4" />
                        {order.photoUrls.length > 0 ? order.photoUrls.length : ""}
                        {order.itemUrl ? " Link" : ""}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <OrderActionButton orderId={order.id} action="approved" label="Approve" />
                        <OrderActionButton orderId={order.id} action="rejected" label="Reject" variant="destructive" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> All Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!orders || orders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
              {orders?.map((order) => (
                <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{order.user?.fullName || "Unknown"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                  <TableCell className="font-bold tabular-nums text-primary">
                    {order.pointsCost.toLocaleString()} pts
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.convertedValue || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)} className="capitalize" data-testid={`badge-status-${order.id}`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)} data-testid={`button-view-photos-${order.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      {order.photoUrls.length > 0 ? order.photoUrls.length : ""}
                      {order.itemUrl ? " Link" : ""}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <OrderActionButton orderId={order.id} action="approved" label="Approve" />
                        <OrderActionButton orderId={order.id} action="rejected" label="Reject" variant="destructive" />
                      </div>
                    )}
                    {order.status === "approved" && (
                      <OrderActionButton orderId={order.id} action="completed" label="Complete" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderPhotoDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
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
        <Loader2 className="h-4 w-4 animate-spin" />
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

function OrderPhotoDialog({ order, onClose }: { order: OrderWithUser; onClose: () => void }) {
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
          <div className="text-sm">
            <span className="font-medium">Points:</span> {order.pointsCost.toLocaleString()}
          </div>
          {order.convertedValue && (
            <div className="text-sm">
              <span className="font-medium">USD Value:</span> {order.convertedValue}
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
