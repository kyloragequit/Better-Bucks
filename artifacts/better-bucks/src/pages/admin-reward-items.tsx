import { useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader } from "@/components/ui/loader";
import { Gift, Plus, Pencil, Trash2 } from "lucide-react";

type RewardItem = {
  id: number;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  active: boolean;
  createdAt: string;
};

type FormState = {
  name: string;
  description: string;
  emoji: string;
  color: string;
  active: boolean;
};

const PRESET_EMOJIS = ["🎫", "☕", "🍕", "⏰", "🏆", "🌟", "🎁", "🍔", "🎯", "💪", "🚀", "🎉", "🛑", "🏅", "🍦", "🎈"];
const PRESET_COLORS = [
  { label: "Navy", value: "#1A237E" },
  { label: "Green", value: "#2E7D32" },
  { label: "Red", value: "#B71C1C" },
  { label: "Orange", value: "#E65100" },
  { label: "Purple", value: "#4A148C" },
  { label: "Teal", value: "#006064" },
  { label: "Blue", value: "#1565C0" },
  { label: "Slate", value: "#37474F" },
];

const DEFAULT_FORM: FormState = { name: "", description: "", emoji: "🎫", color: "#1A237E", active: true };

export default function AdminRewardItemsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RewardItem | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<RewardItem | null>(null);

  const { data: items = [], isLoading } = useQuery<RewardItem[]>({
    queryKey: ["/api/admin/reward-items"],
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<FormState>) => {
      if (editing) {
        return apiRequest("PUT", `/api/admin/reward-items/${editing.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/reward-items", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reward-items"] });
      toast({ title: editing ? "Item updated" : "Item created" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Could not save", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/reward-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reward-items"] });
      toast({ title: "Item deleted" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Error", description: "Could not delete", variant: "destructive" }),
  });

  const toggleActive = (item: RewardItem) => {
    saveMut.mutate({ active: !item.active });
    // Optimistic override
    qc.setQueryData<RewardItem[]>(["/api/admin/reward-items"], (prev) =>
      prev?.map((i) => (i.id === item.id ? { ...i, active: !item.active } : i)) ?? []
    );
    // Use the raw API directly for toggle since editing state may differ
    apiRequest("PUT", `/api/admin/reward-items/${item.id}`, { active: !item.active })
      .then(() => qc.invalidateQueries({ queryKey: ["/api/admin/reward-items"] }))
      .catch(() => qc.invalidateQueries({ queryKey: ["/api/admin/reward-items"] }));
  };

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: RewardItem) {
    setEditing(item);
    setForm({ name: item.name, description: item.description ?? "", emoji: item.emoji, color: item.color, active: item.active });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    saveMut.mutate({ ...form, description: form.description || undefined });
  }

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" />
              Reward Items
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Non-monetary perk items (e.g. "15-min break", "Free lunch") that admins hand out to employees via the mobile app.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Item
          </Button>
        </div>

        {/* Info card */}
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> Create item types here, then use the mobile app to send them to employees.
              Employees receive items in their mobile inbox, accept them into their wallet, and can redeem them when they want to use the perk.
              Items have no Bucks value — they're purely non-monetary rewards.
            </p>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Item Types ({items.length})</CardTitle>
            <CardDescription>Manage the reward item types available to your organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No reward items yet</p>
                <p className="text-sm mt-1">Click "New Item" to create your first perk card.</p>
                <Button onClick={openCreate} className="mt-4 gap-2" variant="outline">
                  <Plus className="w-4 h-4" />
                  Create first item
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className={!item.active ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: item.color + "22" }}
                          >
                            {item.emoji}
                          </div>
                          <div>
                            <div className="font-semibold" style={{ color: item.color }}>{item.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs">
                        {item.description || <span className="italic">No description</span>}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.active}
                          onCheckedChange={() => toggleActive(item)}
                          aria-label="Toggle active"
                        />
                        <span className="ml-2 text-sm text-muted-foreground">{item.active ? "Active" : "Inactive"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Reward Item" : "New Reward Item"}</DialogTitle>
            <DialogDescription>
              Define a perk that admins can send to employees on mobile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='e.g. "15-Minute Break"'
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional — what does this perk include?"
                maxLength={300}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-colors ${
                      form.emoji === e
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                    className={`w-8 h-8 rounded-full border-4 transition-transform ${
                      form.color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border-2 p-3 flex items-center gap-3" style={{ borderColor: form.color }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: form.color + "22" }}>
                {form.emoji}
              </div>
              <div>
                <div className="font-bold text-base" style={{ color: form.color }}>{form.name || "Item Name"}</div>
                {form.description && <div className="text-sm text-muted-foreground">{form.description}</div>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label>Active (visible to senders)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving..." : editing ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              This permanently removes the item type. Any cards already sent to employees will still appear in their history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
