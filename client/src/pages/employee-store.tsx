import { useState } from "react";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, ExternalLink, Coins, Heart, X, RefreshCw, Globe, Ruler, Palette } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useUserDetails } from "@/hooks/use-users";
import type { StoreItem, Wishlist } from "@shared/schema";

export default function EmployeeStorePage() {
  const { data: authUser } = useUser();
  const { data: userDetails } = useUserDetails(authUser?.id || 0);
  const { data: items, isLoading } = useQuery<StoreItem[]>({
    queryKey: ["/api/store-items"],
  });
  const { data: wishlist } = useQuery<(Wishlist & { storeItem: StoreItem })[]>({
    queryKey: ["/api/wishlist"],
    enabled: !!authUser,
  });

  const [browsingItem, setBrowsingItem] = useState<StoreItem | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const wishlistedIds = new Set(wishlist?.map(w => w.storeItemId) ?? []);

  return (
    <EmployeeLayout>
      <div className="mb-8 animate-in">
        <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-store-title">
          Shop
        </h1>
        <p className="text-muted-foreground mt-1">Browse items and spend your Bucks. Heart an item to save it to your wishlist.</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5">
          <Coins className="h-4 w-4" />
          <span className="font-semibold text-sm" data-testid="text-store-balance">
            {(userDetails?.balance || 0).toLocaleString()} Bucks available
          </span>
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : !items || items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No items in the store yet</p>
          <p className="text-sm mt-1">Check back later — your admin will be adding items soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <StoreItemCard
              key={item.id}
              item={item}
              balance={userDetails?.balance || 0}
              isWishlisted={wishlistedIds.has(item.id)}
              onBrowse={() => setBrowsingItem(item)}
            />
          ))}
        </div>
      )}

      {/* Embedded browser dialog */}
      <Dialog open={!!browsingItem} onOpenChange={(open) => { if (!open) setBrowsingItem(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium truncate flex-1" data-testid="text-browse-item-name">
              {browsingItem?.name}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setIframeKey(k => k + 1)}
              data-testid="button-refresh-embed"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <a
              href={browsingItem?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              data-testid="button-open-external"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setBrowsingItem(null)}
              data-testid="button-close-browse"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 relative bg-white">
            {browsingItem && (
              <iframe
                key={iframeKey}
                src={browsingItem.url}
                className="absolute inset-0 w-full h-full border-0"
                title={browsingItem.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                data-testid="iframe-item-embed"
              />
            )}
          </div>
          <div className="px-4 py-2 border-t bg-muted/20 shrink-0 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Some websites may block embedding. Use "open in new tab" if the page doesn't load.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </EmployeeLayout>
  );
}

function StoreItemCard({ item, balance, isWishlisted, onBrowse }: {
  item: StoreItem;
  balance: number;
  isWishlisted: boolean;
  onBrowse: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (selectedSize) body.selectedSize = selectedSize;
      if (selectedColor) body.selectedColor = selectedColor;
      const res = await apiRequest("POST", `/api/store-items/${item.id}/purchase`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      setConfirmOpen(false);
      setSelectedSize("");
      setSelectedColor("");
      toast({ title: "Order Submitted!", description: `Your request for ${item.name} has been sent for approval.` });
    },
    onError: async (err: any) => {
      setConfirmOpen(false);
      toast({ title: "Purchase Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (isWishlisted) {
        await apiRequest("DELETE", `/api/wishlist/${item.id}`);
      } else {
        const res = await apiRequest("POST", `/api/wishlist/${item.id}`);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      toast({
        title: isWishlisted ? "Removed from wishlist" : "Added to wishlist",
        description: isWishlisted ? `${item.name} was removed from your wishlist.` : `${item.name} was saved to your wishlist.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update wishlist.", variant: "destructive" });
    },
  });

  const canAfford = balance >= item.price;
  const canSubmit = (!item.requiresSize || selectedSize.trim()) && (!item.requiresColor || selectedColor.trim());

  return (
    <>
      <Card className="group overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`card-store-item-${item.id}`}>
        <div className="relative">
          <button
            type="button"
            className="block relative aspect-square overflow-hidden bg-gray-100 w-full"
            onClick={onBrowse}
            data-testid={`button-browse-item-${item.id}`}
          >
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "https://placehold.co/400x400?text=No+Image";
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Globe className="h-6 w-6 text-white drop-shadow" />
            </div>
          </button>
          <button
            className={`absolute top-2 right-2 p-1.5 rounded-full shadow transition-colors ${
              isWishlisted
                ? "bg-red-500 text-white"
                : "bg-white/90 text-muted-foreground hover:text-red-500"
            }`}
            onClick={() => wishlistMutation.mutate()}
            disabled={wishlistMutation.isPending}
            data-testid={`button-wishlist-${item.id}`}
            title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`} />
          </button>
        </div>
        <CardContent className="p-3 space-y-2">
          <p className="font-semibold text-sm leading-snug line-clamp-2" data-testid={`text-item-name-${item.id}`}>
            {item.name}
          </p>
          {(item.requiresSize || item.requiresColor) && (
            <div className="flex flex-wrap gap-1">
              {item.requiresSize && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-violet-50 text-violet-700 rounded-full px-1.5 py-0.5 border border-violet-200">
                  <Ruler className="h-2.5 w-2.5" /> Size
                </span>
              )}
              {item.requiresColor && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-pink-50 text-pink-700 rounded-full px-1.5 py-0.5 border border-pink-200">
                  <Palette className="h-2.5 w-2.5" /> Color
                </span>
              )}
            </div>
          )}
          <Badge variant="secondary" className="font-bold text-primary bg-primary/10" data-testid={`text-item-price-${item.id}`}>
            {item.price.toLocaleString()} Bucks
          </Badge>
          <Button
            size="sm"
            className="w-full mt-1"
            onClick={() => { setSelectedSize(""); setSelectedColor(""); setConfirmOpen(true); }}
            data-testid={`button-purchase-${item.id}`}
          >
            <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
            Purchase
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle data-testid="text-confirm-title">
              {canAfford ? "Confirm Purchase" : "Insufficient Bucks"}
            </DialogTitle>
            <DialogDescription data-testid="text-confirm-description">
              {canAfford
                ? `Purchase "${item.name}" for ${item.price.toLocaleString()} Bucks? Your request will be sent for admin approval.`
                : `You do not have enough Bucks for this. You need ${item.price.toLocaleString()} Bucks but only have ${balance.toLocaleString()}.`}
            </DialogDescription>
          </DialogHeader>

          {canAfford && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">Cost</span>
                <span className="font-bold text-primary" data-testid="text-confirm-cost">{item.price.toLocaleString()} Bucks</span>
              </div>

              {(item.requiresSize || item.requiresColor) && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Order Options</p>
                  {item.requiresSize && (
                    <div className="space-y-1.5">
                      <Label htmlFor="order-size" className="flex items-center gap-1.5">
                        <Ruler className="h-3.5 w-3.5 text-violet-600" />
                        Size <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="order-size"
                        value={selectedSize}
                        onChange={e => setSelectedSize(e.target.value)}
                        placeholder="e.g. Medium, L, XL, 10.5..."
                        data-testid="input-order-size"
                      />
                    </div>
                  )}
                  {item.requiresColor && (
                    <div className="space-y-1.5">
                      <Label htmlFor="order-color" className="flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-pink-600" />
                        Color <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="order-color"
                        value={selectedColor}
                        onChange={e => setSelectedColor(e.target.value)}
                        placeholder="e.g. Black, Navy Blue, Red..."
                        data-testid="input-order-color"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid="button-cancel-purchase">
              Cancel
            </Button>
            {canAfford && (
              <Button
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending || !canSubmit}
                data-testid="button-confirm-purchase"
              >
                {purchaseMutation.isPending ? "Processing..." : `Purchase for ${item.price.toLocaleString()} Bucks`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
