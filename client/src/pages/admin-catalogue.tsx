import { useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Plus, BookOpen, Tag, X, Check } from "lucide-react";
import { Loader } from "@/components/ui/loader";
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
import type { CatalogueItem } from "@shared/schema";

export default function AdminCataloguePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formBucks, setFormBucks] = useState("");

  const { data: items, isLoading } = useQuery<CatalogueItem[]>({
    queryKey: ["/api/admin/catalogue"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/catalogue", {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        bucksValue: parseInt(formBucks),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogue"] });
      toast({ title: "Item Created", description: `Catalogue item ${formCode.toUpperCase()} added.` });
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      const res = await apiRequest("PATCH", `/api/admin/catalogue/${editingItem.id}`, {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        bucksValue: parseInt(formBucks),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogue"] });
      toast({ title: "Item Updated" });
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/catalogue/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogue"] });
      toast({ title: "Item Deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete item.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormBucks("");
    setShowForm(false);
    setEditingItem(null);
  };

  const startEdit = (item: CatalogueItem) => {
    setEditingItem(item);
    setFormCode(item.code);
    setFormName(item.name);
    setFormBucks(item.bucksValue.toString());
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formCode.trim() || !formName.trim() || !formBucks || parseInt(formBucks) < 1) {
      toast({ title: "Incomplete", description: "Please fill in all fields with valid values.", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" /> Catalogue Maker
            </h1>
            <p className="text-muted-foreground mt-1">
              Create shorthand codes with Bucks values. Use them in Instant Transaction to auto-fill amounts.
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-catalogue-item">
              <Plus className="h-4 w-4 mr-1.5" /> Add Item
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editingItem ? "Edit Catalogue Item" : "New Catalogue Item"}</CardTitle>
              <CardDescription>
                The code is what admins type in Instant Transaction to look up this item.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-code">
                    Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cat-code"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                    placeholder="e.g. PERF10"
                    maxLength={20}
                    className="font-mono uppercase"
                    data-testid="input-catalogue-code"
                  />
                  <p className="text-xs text-muted-foreground">Letters, numbers, - and _ only</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cat-name"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Performance Bonus"
                    maxLength={100}
                    data-testid="input-catalogue-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-bucks">
                    Bucks Value <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cat-bucks"
                    type="number"
                    min={1}
                    value={formBucks}
                    onChange={e => setFormBucks(e.target.value)}
                    placeholder="e.g. 250"
                    data-testid="input-catalogue-bucks"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm} data-testid="button-cancel-catalogue">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-catalogue">
                  {isPending ? "Saving..." : <><Check className="h-4 w-4 mr-1" />{editingItem ? "Save Changes" : "Create"}</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Catalogue Items
            </CardTitle>
            <CardDescription>
              {items?.length ?? 0} item{items?.length !== 1 ? "s" : ""} — use these codes in Instant Transaction to auto-fill Bucks amounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader /></div>
            ) : !items?.length ? (
              <div className="text-center py-12 space-y-2">
                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="font-medium text-muted-foreground">No catalogue items yet</p>
                <p className="text-sm text-muted-foreground">
                  Add items with codes like PERF10, SAFETY5, or BONUS100 and assign Bucks values to them.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    data-testid={`row-catalogue-${item.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-sm px-3 py-1 tracking-wide" data-testid={`text-catalogue-code-${item.id}`}>
                        {item.code}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm" data-testid={`text-catalogue-name-${item.id}`}>{item.name}</p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-catalogue-bucks-${item.id}`}>
                          {item.bucksValue.toLocaleString()} Bucks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(item)}
                        data-testid={`button-edit-catalogue-${item.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            data-testid={`button-delete-catalogue-${item.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{item.code}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the catalogue item "{item.name}" ({item.bucksValue.toLocaleString()} Bucks).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
