import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PackagePlus, CheckCircle2, ArrowRight, ShoppingBag } from "lucide-react";

interface StoreItem {
  id: number;
  name: string;
  price: number;
  url?: string;
  imageUrl?: string;
}

export default function AdminStoreSetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");

  const { data: storeItems = [] } = useQuery<StoreItem[]>({
    queryKey: ["/api/store-items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/store-items");
      return res.json();
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: { name: string; price: number; url?: string }) => {
      const res = await apiRequest("POST", "/api/store-items", item);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      setName("");
      setPrice("");
      setUrl("");
      toast({ title: "Item added", description: "Your store item has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add item", description: err.message, variant: "destructive" });
    },
  });

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const parsedPrice = parseInt(price, 10);
    if (!name.trim() || isNaN(parsedPrice) || parsedPrice < 1) {
      toast({ title: "Missing fields", description: "Please enter a name and valid price.", variant: "destructive" });
      return;
    }
    addItemMutation.mutate({ name: name.trim(), price: parsedPrice, url: url.trim() || undefined });
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-primary/10 rounded-full p-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your store</h1>
          <p className="text-gray-500 mt-2">
            Add items employees can redeem with their Bucks. You can always add more later from the Store page.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-5 w-5 text-primary" />
              Add a store item
            </CardTitle>
            <CardDescription>
              Price items in Bucks — if employees earn 500 Bucks/month, everyday items work well at 100–300 Bucks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <Label htmlFor="item-name">Item name <span className="text-red-500">*</span></Label>
                <Input
                  id="item-name"
                  placeholder="e.g. Amazon Gift Card $25"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="item-price">Price (Bucks) <span className="text-red-500">*</span></Label>
                <Input
                  id="item-price"
                  type="number"
                  min="1"
                  placeholder="e.g. 250"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="item-url">Product URL <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  id="item-url"
                  type="url"
                  placeholder="https://amazon.com/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={addItemMutation.isPending} className="w-full">
                {addItemMutation.isPending ? "Adding..." : "Add item"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {storeItems.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Items added ({storeItems.length})
            </h2>
            <div className="space-y-2">
              {storeItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 truncate block">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary whitespace-nowrap">{item.price} Bucks</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => setLocation("/admin/dashboard")}
            className="w-full flex items-center justify-center gap-2"
            size="lg"
          >
            Continue to dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
          {storeItems.length === 0 && (
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin/dashboard")}
              className="w-full text-gray-500 text-sm"
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
