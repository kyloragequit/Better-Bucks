import { useState } from "react";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, ExternalLink, Coins, Heart } from "lucide-react";
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
            />
          ))}
        </div>
      )}
    </EmployeeLayout>
  );
}

function StoreItemCard({ item, balance, isWishlisted }: { item: StoreItem; balance: number; isWishlisted: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/store-items/${item.id}/purchase`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      setConfirmOpen(false);
      toast({ title: "Order Submitted!", description: `Your request for ${item.name} has been sent for approval.` });
    },
    onError: () => {
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

  return (
    <>
      <Card className="group overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`card-store-item-${item.id}`}>
        <div className="relative">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative aspect-square overflow-hidden bg-gray-100"
            data-testid={`link-store-item-${item.id}`}
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
              <ExternalLink className="h-6 w-6 text-white drop-shadow" />
            </div>
          </a>
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
          <Badge variant="secondary" className="font-bold text-primary bg-primary/10" data-testid={`text-item-price-${item.id}`}>
            {item.price.toLocaleString()} Bucks
          </Badge>
          <Button
            size="sm"
            className="w-full mt-1"
            onClick={() => setConfirmOpen(true)}
            data-testid={`button-purchase-${item.id}`}
          >
            <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
            Purchase
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[380px]">
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
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">Cost</span>
              <span className="font-bold text-primary" data-testid="text-confirm-cost">{item.price.toLocaleString()} Bucks</span>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid="button-cancel-purchase">
              Cancel
            </Button>
            {canAfford && (
              <Button
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending}
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
