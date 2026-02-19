import { useState, useRef } from "react";
import { useUser } from "@/hooks/use-auth";
import { useUserDetails } from "@/hooks/use-users";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShoppingCart, ExternalLink, Upload, X, ImageIcon, Loader2, Package, Link2 } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Order } from "@shared/schema";
import { useStoreUrl } from "@/hooks/use-store-url";

function statusVariant(status: string) {
  switch (status) {
    case "pending": return "secondary";
    case "approved": return "default";
    case "rejected": return "destructive";
    case "completed": return "default";
    default: return "secondary";
  }
}

export default function EmployeeOrdersPage() {
  const { data: authUser } = useUser();
  const { data: userDetails } = useUserDetails(authUser?.id || 0);
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });
  const { storeUrl } = useStoreUrl();

  if (isLoading) return <EmployeeLayout><Loader /></EmployeeLayout>;

  return (
    <EmployeeLayout>
      <div className="mb-8 animate-in">
        <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-orders-title">
          Place an Order
        </h1>
        <p className="text-muted-foreground mt-1">Browse items and submit your order with photos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" /> Browse the Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Visit our promo store to find items you'd like to order. Take screenshots of the items, then come back here to submit your order.
            </p>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full" data-testid="link-promo-store">
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Store
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Your Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display text-foreground mb-2">
              {(userDetails?.balance || 0).toLocaleString()}
              <span className="text-xl text-muted-foreground ml-2 font-normal">pts</span>
            </div>
            <CreateOrderDialog balance={userDetails?.balance || 0} />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Your Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!orders || orders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No orders yet. Browse the store and submit your first order!
                  </TableCell>
                </TableRow>
              )}
              {orders?.map((order) => (
                <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{order.description}</TableCell>
                  <TableCell className="font-bold tabular-nums text-primary">
                    {order.pointsCost.toLocaleString()} pts
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)} className="capitalize" data-testid={`badge-status-${order.id}`}>
                      {order.status}
                    </Badge>
                    {order.adminNotes && (
                      <p className="text-xs text-muted-foreground mt-1">{order.adminNotes}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </EmployeeLayout>
  );
}

function CreateOrderDialog({ balance }: { balance: number }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createOrderMutation = useMutation({
    mutationFn: async (data: { description: string; photoUrls: string[]; itemUrl?: string; pointsCost: number }) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Order Submitted", description: "Your order has been sent to the admin for processing." });
      setOpen(false);
      setDescription("");
      setPointsCost("");
      setItemUrl("");
      setPhotos([]);
      setPreviews([]);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 10) {
      toast({ title: "Too many files", description: "Maximum 10 photos per order.", variant: "destructive" });
      return;
    }
    setPhotos(prev => [...prev, ...files]);
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseInt(pointsCost);
    if (!cost || cost <= 0) {
      toast({ title: "Error", description: "Enter a valid point amount.", variant: "destructive" });
      return;
    }
    if (cost > balance) {
      toast({ title: "Error", description: "Not enough points.", variant: "destructive" });
      return;
    }
    if (photos.length === 0 && !itemUrl.trim()) {
      toast({ title: "Error", description: "Please upload at least one photo or paste a link to the item.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let urls: string[] = [];
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach(f => formData.append("photos", f));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
        if (!uploadRes.ok) throw new Error("Failed to upload photos");
        const result = await uploadRes.json();
        urls = result.urls;
      }

      createOrderMutation.mutate({
        description,
        photoUrls: urls,
        itemUrl: itemUrl.trim() || undefined,
        pointsCost: cost,
      });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full mt-2" data-testid="button-new-order">
          <ShoppingCart className="mr-2 h-4 w-4" /> New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Order</DialogTitle>
          <DialogDescription>
            Paste a link to the item and/or upload screenshots, then describe what you'd like to order.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="description">What would you like to order?</Label>
            <Textarea
              id="description"
              required
              placeholder="Describe the item(s) you want..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-order-description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-url">Item Link (optional)</Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="item-url"
                type="url"
                placeholder="https://store.example.com/item"
                className="pl-9"
                value={itemUrl}
                onChange={(e) => setItemUrl(e.target.value)}
                data-testid="input-order-item-url"
              />
            </div>
            <p className="text-xs text-muted-foreground">Paste a direct link to the item from the store</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="points">Points to spend</Label>
            <Input
              id="points"
              type="number"
              min={1}
              max={balance}
              required
              placeholder={`Available: ${balance.toLocaleString()}`}
              value={pointsCost}
              onChange={(e) => setPointsCost(e.target.value)}
              data-testid="input-order-points"
            />
            <p className="text-xs text-muted-foreground">You have {balance.toLocaleString()} points available</p>
          </div>
          <div className="grid gap-2">
            <Label>Photos / Screenshots (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-order-photos"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-photos"
            >
              <Upload className="mr-2 h-4 w-4" /> Upload Photos
            </Button>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative group rounded-md overflow-hidden border aspect-square">
                    <img src={src} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-photo-${idx}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length === 0 && (
              <div className="border-2 border-dashed rounded-md p-6 text-center text-muted-foreground">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No photos added yet</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={uploading || createOrderMutation.isPending} data-testid="button-submit-order">
              {(uploading || createOrderMutation.isPending) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                "Submit Order"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
