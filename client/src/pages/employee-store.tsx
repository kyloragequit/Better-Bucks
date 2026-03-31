import { useState } from "react";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, ExternalLink, Coins, Heart, X, RefreshCw, Globe, Ruler, Palette, Plus, Minus, Search, BookOpen } from "lucide-react";
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
  const [search, setSearch] = useState("");

  const wishlistedIds = new Set(wishlist?.map(w => w.storeItemId) ?? []);

  const filteredItems = items?.filter(item =>
    !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const itemsWithImages = filteredItems?.filter(item => !!item.imageUrl) ?? [];
  const itemsWithoutImages = filteredItems?.filter(item => !item.imageUrl) ?? [];

  return (
    <EmployeeLayout>
      <div className="mb-6 animate-in">
        <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-store-title">
          Shop
        </h1>
        <p className="text-muted-foreground mt-1">Browse items and spend your Bucks. Heart an item to save it to your wishlist.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 shrink-0">
          <Coins className="h-4 w-4" />
          <span className="font-semibold text-sm" data-testid="text-store-balance">
            {(userDetails?.balance || 0).toLocaleString()} Bucks available
          </span>
        </div>
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-store-search"
          />
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
      ) : filteredItems?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No items match your search</p>
          <p className="text-sm mt-1">Try a different keyword.</p>
        </div>
      ) : (
        <>
          {itemsWithImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {itemsWithImages.map((item) => (
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
          {itemsWithoutImages.length > 0 && (
            <div className={itemsWithImages.length > 0 ? "mt-10" : ""}>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold" data-testid="text-catalogue-heading">Catalogue</h2>
              </div>
              <div className="flex flex-col gap-2">
                {itemsWithoutImages.map((item) => (
                  <CatalogueItemRow
                    key={item.id}
                    item={item}
                    balance={userDetails?.balance || 0}
                    isWishlisted={wishlistedIds.has(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
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

function CatalogueItemRow({ item, balance, isWishlisted }: {
  item: StoreItem;
  balance: number;
  isWishlisted: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | number> = { quantity };
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
      setQuantity(1);
      toast({ title: "Order Submitted!", description: `Your request for ${quantity > 1 ? `${quantity}x ` : ""}${item.name} has been sent for approval.` });
    },
    onError: async () => {
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

  const totalCost = item.price * quantity;
  const canAfford = balance >= totalCost;
  const canSubmit = (!item.requiresSize || selectedSize.trim()) && (!item.requiresColor || selectedColor.trim());

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors"
        data-testid={`row-catalogue-item-${item.id}`}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" data-testid={`text-catalogue-item-name-${item.id}`}>{item.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary" className="font-bold text-primary bg-primary/10 text-xs" data-testid={`text-catalogue-item-price-${item.id}`}>
              {item.price.toLocaleString()} Bucks
            </Badge>
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
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            title="View item"
            data-testid={`link-catalogue-item-url-${item.id}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          className={`p-1.5 rounded-full transition-colors shrink-0 ${
            isWishlisted ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
          }`}
          onClick={() => wishlistMutation.mutate()}
          disabled={wishlistMutation.isPending}
          data-testid={`button-catalogue-wishlist-${item.id}`}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`} />
        </button>
        <Button
          size="sm"
          onClick={() => { setSelectedSize(""); setSelectedColor(""); setQuantity(1); setConfirmOpen(true); }}
          data-testid={`button-catalogue-purchase-${item.id}`}
          className="shrink-0"
        >
          <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
          Purchase
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{canAfford ? "Confirm Purchase" : "Insufficient Bucks"}</DialogTitle>
            <DialogDescription>
              {canAfford
                ? `Your request will be sent for admin approval.`
                : `You do not have enough Bucks. You need ${totalCost.toLocaleString()} Bucks but only have ${balance.toLocaleString()}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} data-testid="button-cat-quantity-decrease">
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center font-semibold tabular-nums" data-testid="text-cat-quantity">{quantity}</span>
                <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setQuantity(q => q + 1)} data-testid="button-cat-quantity-increase">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {quantity > 1 ? `Total (${quantity} × ${item.price.toLocaleString()})` : "Cost"}
              </span>
              <span className={`font-bold ${canAfford ? "text-primary" : "text-destructive"}`}>
                {totalCost.toLocaleString()} Bucks
              </span>
            </div>
            {canAfford && (item.requiresSize || item.requiresColor) && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Order Options</p>
                {item.requiresSize && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-order-size" className="flex items-center gap-1.5">
                      <Ruler className="h-3.5 w-3.5 text-violet-600" /> Size <span className="text-destructive">*</span>
                    </Label>
                    <Input id="cat-order-size" value={selectedSize} onChange={e => setSelectedSize(e.target.value)} placeholder="e.g. Medium, L, XL, 10.5..." data-testid="input-cat-order-size" />
                  </div>
                )}
                {item.requiresColor && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-order-color" className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-pink-600" /> Color <span className="text-destructive">*</span>
                    </Label>
                    <Input id="cat-order-color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)} placeholder="e.g. Black, Navy Blue, Red..." data-testid="input-cat-order-color" />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            {canAfford && (
              <Button onClick={() => purchaseMutation.mutate()} disabled={purchaseMutation.isPending || !canSubmit} data-testid="button-cat-confirm-purchase">
                {purchaseMutation.isPending ? "Processing..." : `Purchase ${quantity > 1 ? `${quantity}x ` : ""}for ${totalCost.toLocaleString()} Bucks`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  const [quantity, setQuantity] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | number> = { quantity };
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
      setQuantity(1);
      toast({ title: "Order Submitted!", description: `Your request for ${quantity > 1 ? `${quantity}x ` : ""}${item.name} has been sent for approval.` });
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

  const totalCost = item.price * quantity;
  const canAfford = balance >= totalCost;
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
            onClick={() => { setSelectedSize(""); setSelectedColor(""); setQuantity(1); setConfirmOpen(true); }}
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
                ? `Your request will be sent for admin approval.`
                : `You do not have enough Bucks. You need ${totalCost.toLocaleString()} Bucks but only have ${balance.toLocaleString()}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  data-testid="button-quantity-decrease"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center font-semibold tabular-nums" data-testid="text-quantity">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setQuantity(q => q + 1)}
                  data-testid="button-quantity-increase"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {quantity > 1 ? `Total (${quantity} × ${item.price.toLocaleString()})` : "Cost"}
              </span>
              <span className={`font-bold ${canAfford ? "text-primary" : "text-destructive"}`} data-testid="text-confirm-cost">
                {totalCost.toLocaleString()} Bucks
              </span>
            </div>

            {canAfford && (item.requiresSize || item.requiresColor) && (
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
                {purchaseMutation.isPending ? "Processing..." : `Purchase ${quantity > 1 ? `${quantity}x ` : ""}for ${totalCost.toLocaleString()} Bucks`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
