import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { usePublicDemo } from "@/hooks/use-demo";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";
import { Loader } from "@/components/ui/loader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingBag, Plus, Pencil, Trash2, ExternalLink, Upload, ImageIcon, Link2, Heart, HelpCircle, X, Tag, DollarSign, Image, Star, CheckCircle2, Ruler, Palette, Search } from "lucide-react";
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
import type { StoreItem, User, Wishlist } from "@shared/schema";

const HELP_TIPS = [
  {
    icon: Tag,
    field: "Item Name",
    color: "#162A4A",
    tip: "Use a clear, specific name employees will recognize. Good: \"Sony WH-1000XM5 Headphones\" — not just \"Headphones\". This is exactly what shows up in the store and in order notifications.",
  },
  {
    icon: DollarSign,
    field: "Price (Bucks)",
    color: "#4E9F3D",
    tip: "Set a Bucks price that fits your reward economy. If employees typically earn 500 Bucks/month, price everyday items at 100–300 Bucks and aspirational items at 500–2,000+. You can edit prices anytime without affecting past orders.",
  },
  {
    icon: Link2,
    field: "Item URL",
    color: "#6366f1",
    tip: "Paste the direct product page link — Amazon, Target, any retailer works. This link is only visible to you when you're fulfilling orders, so employees can't see where you're ordering from.",
  },
  {
    icon: Image,
    field: "Preview Image",
    color: "#f59e0b",
    tip: "Upload a photo or paste an image URL. A clear product photo dramatically increases employee engagement — items with images get selected 3× more often. Use the retailer's product image URL if you don't have one handy.",
  },
  {
    icon: Ruler,
    field: "Require Size",
    color: "#8b5cf6",
    tip: "Enable this for items like apparel or shoes where employees need to specify a size (S, M, L, XL, etc.). When enabled, employees must enter their size before submitting an order.",
  },
  {
    icon: Palette,
    field: "Require Color",
    color: "#ec4899",
    tip: "Enable this for items available in multiple colors. When enabled, employees must specify their preferred color before submitting an order, so you know exactly what to order.",
  },
  {
    icon: CheckCircle2,
    field: "Managing Items",
    color: "#10b981",
    tip: "You can edit or delete items at any time. Deleting removes it from the store immediately — employees can no longer select it, but any past orders are not affected. Keep your store fresh by rotating seasonal items.",
  },
  {
    icon: Star,
    field: "Pro Tip",
    color: "#ec4899",
    tip: "Check the Wishlists section at the bottom of this page to see what your employees are hoping for. Adding those items is a guaranteed engagement boost!",
  },
];

function NeedHelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9998] flex justify-end" data-testid="need-help-panel">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ background: "#162A4A" }}>
          <div>
            <p className="text-white font-bold text-base">Store Setup Guide</p>
            <p className="text-white/60 text-xs mt-0.5">Everything you need to know</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            data-testid="button-close-help-panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Here's a walkthrough of every field in the Add Item form and tips to get the most from your store.
          </p>
          {HELP_TIPS.map(({ icon: Icon, field, color, tip }) => (
            <div key={field} className="flex gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${color}15` }}
              >
                <Icon className="h-4.5 w-4.5" style={{ color }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#162A4A" }}>{field}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tip}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pt-4 border-t bg-gray-50 shrink-0 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-xs text-gray-600 text-center">
            Still have questions? Contact your Better Bucks rep.
          </p>
        </div>
      </div>
    </div>
  );
}

type WishlistEntry = Wishlist & { storeItem: StoreItem; user: User };

export default function AdminStorePage() {
  const isPublicDemo = usePublicDemo();
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery<StoreItem[]>({ queryKey: ["/api/store-items"] });
  const { data: wishlists } = useQuery<WishlistEntry[]>({ queryKey: ["/api/admin/wishlists"] });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const filteredItems = useMemo(() =>
    items?.filter(item =>
      item.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    ) ?? [],
    [items, debouncedSearch]
  );

  const [showHelp, setShowHelp] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [requiresSize, setRequiresSize] = useState(false);
  const [requiresColor, setRequiresColor] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setName(""); setPrice(""); setUrl(""); setImageUrl("");
    setRequiresSize(false); setRequiresColor(false);
    setShowAddForm(false); setEditingItem(null);
  };

  const openEdit = (item: StoreItem) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(String(item.price));
    setUrl(item.url);
    setImageUrl(item.imageUrl);
    setRequiresSize(item.requiresSize);
    setRequiresColor(item.requiresColor);
    setShowAddForm(false);
  };

  const uploadFile = async (file: File) => {
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) uploadFile(file);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/store-items", { name, price, url, imageUrl, requiresSize, requiresColor });
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
      const res = await apiRequest("PATCH", `/api/store-items/${editingItem!.id}`, { name, price, url, imageUrl, requiresSize, requiresColor });
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
    if (!name || !price) {
      toast({ title: "Missing fields", description: "Item name and price are required.", variant: "destructive" });
      return;
    }
    if (editingItem) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      {showHelp && <NeedHelpPanel onClose={() => setShowHelp(false)} />}

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold truncate" data-testid="text-admin-store-title">Employee Store</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Add items that employees can browse and purchase with their Bucks.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowHelp(true)}
              className="gap-2"
              data-testid="button-store-help"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Need help?</span>
              <span className="sm:hidden">Help</span>
            </Button>
            {!isPublicDemo && !showAddForm && !editingItem && (
              <Button onClick={() => setShowAddForm(true)} data-testid="button-add-store-item">
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            )}
          </div>
        </div>

        {(showAddForm || editingItem) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{editingItem ? "Edit Item" : "New Store Item"}</CardTitle>
              <CardDescription>Fill in the details for the item employees can purchase.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} onFocusCapture={scrollOnFocus} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="si-name">Item Name</Label>
                  <Input id="si-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Company T-Shirt" data-testid="input-store-item-name" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="si-price">Price (Bucks)</Label>
                  <Input id="si-price" type="number" inputMode="numeric" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 500" data-testid="input-store-item-price" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="si-url">Item URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="si-url" className="pl-9" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/item" data-testid="input-store-item-url" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Preview Image <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                  <div className="flex items-start gap-4" onPaste={handleImagePaste}>
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
                      <p className="text-xs text-muted-foreground">Paste an image with Ctrl+V anywhere here, or enter a URL below</p>
                      <Input
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        onPaste={handleImagePaste}
                        placeholder="https://example.com/image.jpg"
                        className="text-sm"
                        data-testid="input-store-item-image-url"
                      />
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Order Options</p>
                  <p className="text-xs text-muted-foreground">Enable these if employees need to specify size or color when ordering.</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Require Size</p>
                        <p className="text-xs text-muted-foreground">Employees must enter a size (e.g. S, M, L, XL)</p>
                      </div>
                    </div>
                    <Switch
                      checked={requiresSize}
                      onCheckedChange={setRequiresSize}
                      data-testid="switch-requires-size"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Require Color</p>
                        <p className="text-xs text-muted-foreground">Employees must specify a color preference</p>
                      </div>
                    </div>
                    <Switch
                      checked={requiresColor}
                      onCheckedChange={setRequiresColor}
                      data-testid="switch-requires-color"
                    />
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
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search items…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-store-items"
              />
            </div>
            {isLoading ? (
              <div className="py-6"><Loader /></div>
            ) : !items || items.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No items yet</p>
                <p className="text-sm mt-1">Click "Add Item" to add your first store item.</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No items match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
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
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.requiresSize && (
                          <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 rounded-full px-2 py-0.5 border border-violet-200">
                            <Ruler className="h-2.5 w-2.5" /> Size req.
                          </span>
                        )}
                        {item.requiresColor && (
                          <span className="inline-flex items-center gap-1 text-xs bg-pink-50 text-pink-700 rounded-full px-2 py-0.5 border border-pink-200">
                            <Palette className="h-2.5 w-2.5" /> Color req.
                          </span>
                        )}
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 mt-0.5 w-fit"
                      >
                        <ExternalLink className="h-3 w-3" /> View item
                      </a>
                      {!isPublicDemo && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => openEdit(item)}
                            aria-label={`Edit ${item.name}`}
                            data-testid={`button-edit-store-item-${item.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive border-destructive/30" aria-label={`Remove ${item.name}`} data-testid={`button-delete-store-item-${item.id}`}>
                                <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Remove</span>
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wishlists */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            Employee Wishlists
          </CardTitle>
          <CardDescription>Items your employees have saved to their wishlists.</CardDescription>
        </CardHeader>
        <CardContent>
          {!wishlists || wishlists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Heart className="h-8 w-8 mx-auto mb-2 opacity-25" />
              <p className="text-sm">No items have been wishlisted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const grouped = new Map<number, { item: StoreItem; users: User[] }>();
                for (const w of wishlists) {
                  if (!grouped.has(w.storeItemId)) {
                    grouped.set(w.storeItemId, { item: w.storeItem, users: [] });
                  }
                  grouped.get(w.storeItemId)!.users.push(w.user);
                }
                return Array.from(grouped.values()).map(({ item, users }) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3" data-testid={`wishlist-row-${item.id}`}>
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-12 w-12 object-cover rounded-md border flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/48x48?text=?"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.name}</p>
                      <p className="text-xs text-primary font-bold mt-0.5">{item.price.toLocaleString()} Bucks</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {users.map(u => (
                          <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground" data-testid={`wishlist-user-${item.id}-${u.id}`}>
                            <Heart className="h-2.5 w-2.5 text-red-400 fill-red-400" />
                            {u.fullName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-semibold text-muted-foreground">{users.length} wishlisted</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
