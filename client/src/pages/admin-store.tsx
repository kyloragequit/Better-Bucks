import { useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingBag, Plus, Pencil, Trash2, ExternalLink, Upload, ImageIcon, Link2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { StoreItem } from "@shared/schema";

export default function AdminStorePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery<StoreItem[]>({ queryKey: ["/api/store-items"] });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setName(""); setPrice(""); setUrl(""); setImageUrl("");
    setShowAddForm(false); setEditingItem(null);
  };

  const openEdit = (item: StoreItem) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(String(item.price));
    setUrl(item.url);
    setImageUrl(item.imageUrl);
    setShowAddForm(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const urls: string[] = await res.json();
      setImageUrl(urls[0]);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload image.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/store-items", { name, price, url, imageUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      toast({ title: "Item added to store" });
      resetForm();
    },
    onError: () => toast({ title: "Error", description: "Could not add item.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/store-items/${editingItem!.id}`, { name, price, url, imageUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      toast({ title: "Item updated" });
      resetForm();
    },
    onError: () => toast({ title: "Error", description: "Could not update item.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/store-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      toast({ title: "Item removed from store" });
    },
    onError: () => toast({ title: "Error", description: "Could not delete item.", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !url || !imageUrl) {
      toast({ title: "Missing fields", description: "All fields are required.", variant: "destructive" });
      return;
    }
    if (editingItem) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-admin-store-title">Employee Store</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Add items that employees can browse and purchase with their Bucks.
            </p>
          </div>
          {!showAddForm && !editingItem && (
            <Button onClick={() => setShowAddForm(true)} data-testid="button-add-store-item">
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          )}
        </div>

        {(showAddForm || editingItem) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{editingItem ? "Edit Item" : "New Store Item"}</CardTitle>
              <CardDescription>Fill in the details for the item employees can purchase.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="si-name">Item Name</Label>
                  <Input id="si-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Company T-Shirt" data-testid="input-store-item-name" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="si-price">Price (Bucks)</Label>
                  <Input id="si-price" type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 500" data-testid="input-store-item-price" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="si-url">Item URL</Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="si-url" className="pl-9" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/item" data-testid="input-store-item-url" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Preview Image</Label>
                  <div className="flex items-start gap-4">
                    {imageUrl ? (
                      <img src={imageUrl} alt="preview" className="h-20 w-20 object-cover rounded-lg border flex-shrink-0" />
                    ) : (
                      <div className="h-20 w-20 bg-muted rounded-lg border flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <label className="cursor-pointer block">
                        <Button type="button" variant="outline" size="sm" disabled={uploading} className="pointer-events-none w-full" data-testid="button-upload-image">
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          {uploading ? "Uploading..." : "Upload Image"}
                        </Button>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                      <p className="text-xs text-muted-foreground">Or paste an image URL below</p>
                      <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="text-sm" data-testid="input-store-item-image-url" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isSubmitting} data-testid="button-save-store-item">
                    {isSubmitting ? "Saving..." : editingItem ? "Save Changes" : "Add to Store"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" />
              Store Items ({items?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !items || items.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No items yet</p>
                <p className="text-sm mt-1">Click "Add Item" to add your first store item.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 border rounded-lg p-3" data-testid={`store-item-row-${item.id}`}>
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 object-cover rounded-md border flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/64x64?text=?"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" data-testid={`text-store-item-name-${item.id}`}>{item.name}</p>
                      <p className="text-primary text-sm font-bold mt-0.5" data-testid={`text-store-item-price-${item.id}`}>{item.price.toLocaleString()} Bucks</p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 mt-0.5 w-fit"
                      >
                        <ExternalLink className="h-3 w-3" /> View item
                      </a>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openEdit(item)}
                          data-testid={`button-edit-store-item-${item.id}`}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/30" data-testid={`button-delete-store-item-${item.id}`}>
                              <Trash2 className="h-3 w-3 mr-1" /> Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Store Item</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove "{item.name}" from the store? Employees will no longer be able to purchase it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
