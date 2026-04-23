import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader } from "@/components/ui/loader";
import { format } from "date-fns";
import { Gift, Undo2, Settings, Package, Users, Plus, Search, Trash2 } from "lucide-react";
import { useRoleLabels } from "@/hooks/use-role-labels";
import type { CustomItem, CustomItemTransaction, Department } from "@shared/schema";

type ItemUser = { id: number; fullName: string; username: string; role: string; departmentId: number | null; customItemBalance: number };
type ItemTx = CustomItemTransaction & { user: { fullName: string; username: string } };

export default function AdminItemsPage() {
  const { data: currentUser } = useUser();
  const isPrime = currentUser?.role === "prime_admin";
  const queryClient = useQueryClient();
  const { getRoleLabel } = useRoleLabels();

  const { data: items, isLoading: itemsLoading } = useQuery<CustomItem[]>({
    queryKey: ["/api/admin/custom-items/items"],
  });

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkGiveOpen, setBulkGiveOpen] = useState(false);

  // Auto-select first item when items load (or when selected disappears)
  useEffect(() => {
    if (!items || items.length === 0) {
      if (selectedItemId !== null) setSelectedItemId(null);
      return;
    }
    if (selectedItemId === null || !items.find(i => i.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  const selectedItem = items?.find(i => i.id === selectedItemId) ?? null;

  const { data: itemUsers, isLoading: usersLoading } = useQuery<ItemUser[]>({
    queryKey: ["/api/admin/custom-items/users", selectedItemId],
    enabled: !!selectedItemId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/custom-items/users?itemId=${selectedItemId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const { data: transactions, isLoading: txLoading } = useQuery<ItemTx[]>({
    queryKey: ["/api/admin/custom-items/transactions", selectedItemId],
    enabled: !!selectedItemId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/custom-items/transactions?itemId=${selectedItemId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  if (itemsLoading) return <AdminLayout><Loader /></AdminLayout>;

  // No items yet — show create UI
  if (!items || items.length === 0) {
    return (
      <AdminLayout>
        <div className="mb-8 animate-in">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Custom Items</h1>
          <p className="text-muted-foreground mt-1">Non-Bucks incentive items your organization can give and redeem</p>
        </div>
        <Card className="shadow-md max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> No Items Configured</CardTitle>
            <CardDescription>
              {isPrime
                ? "Create one or more custom item types — like \"Safety Stars\", \"Raffle Tickets\", or any other incentive token."
                : "Your Organization Owner hasn't set up any custom items yet. Ask them to add some in this section."}
            </CardDescription>
          </CardHeader>
          {isPrime && (
            <CardContent>
              <CreateItemForm onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/items"] })} />
            </CardContent>
          )}
        </Card>
      </AdminLayout>
    );
  }

  if (!selectedItem || usersLoading) return <AdminLayout><Loader /></AdminLayout>;

  const employees = (itemUsers ?? []).filter(u => u.role === "employee");
  const admins = (itemUsers ?? []).filter(u => u.role === "admin" || u.role === "prime_admin");
  const myBalance = itemUsers?.find(u => u.id === currentUser?.id)?.customItemBalance ?? 0;
  const itemName = selectedItem.name;

  return (
    <AdminLayout>
      <div className="mb-6 animate-in flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Custom Items
          </h1>
          <p className="text-muted-foreground mt-1">Give and redeem custom items across your team</p>
        </div>
        <div className="flex items-center gap-3">
          {!isPrime && (
            <div className="rounded-lg border bg-card px-4 py-2 text-sm">
              <span className="text-muted-foreground">Your {itemName}: </span>
              <span className="font-bold text-primary tabular-nums">{myBalance.toLocaleString()}</span>
            </div>
          )}
          {isPrime && (
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} data-testid="button-new-item">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Item
            </Button>
          )}
        </div>
      </div>

      {/* Item type selector */}
      <Card className="shadow-sm mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 grid gap-1.5">
              <Label>Active item type</Label>
              <Select value={String(selectedItemId)} onValueChange={(v) => setSelectedItemId(Number(v))}>
                <SelectTrigger data-testid="select-active-item">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map(it => (
                    <SelectItem key={it.id} value={String(it.id)} data-testid={`item-option-${it.id}`}>
                      <span className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" /> {it.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">All actions below apply to <span className="font-medium text-foreground">{itemName}</span></p>
            </div>
            {isPrime && (
              <ConfigureItemButton
                item={selectedItem}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/items"] })}
                onDeleted={() => {
                  setSelectedItemId(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/items"] });
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees" data-testid="tab-items-employees">Employees</TabsTrigger>
          {isPrime && <TabsTrigger value="admins" data-testid="tab-items-admins">Admin Balances</TabsTrigger>}
          <TabsTrigger value="history" data-testid="tab-items-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeeBalancesCard
            itemName={itemName}
            customItemId={selectedItem.id}
            employees={employees}
            departments={departments ?? []}
            adminBalance={myBalance}
            isPrime={isPrime}
            onBulkGive={() => setBulkGiveOpen(true)}
          />
        </TabsContent>

        {isPrime && (
          <TabsContent value="admins">
            <AdminBalancesCard
              itemName={itemName}
              customItemId={selectedItem.id}
              admins={admins}
              getRoleLabel={getRoleLabel}
            />
          </TabsContent>
        )}

        <TabsContent value="history">
          <HistoryCard itemName={itemName} transactions={transactions} loading={txLoading} />
        </TabsContent>
      </Tabs>

      <CreateItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(newItem) => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/items"] });
          setSelectedItemId(newItem.id);
        }}
      />

      <BulkGiveDialog
        open={bulkGiveOpen}
        onOpenChange={setBulkGiveOpen}
        employees={employees}
        departments={departments ?? []}
        itemName={itemName}
        customItemId={selectedItem.id}
        adminBalance={myBalance}
        isPrime={isPrime}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/users", selectedItemId] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/transactions", selectedItemId] });
        }}
      />
    </AdminLayout>
  );
}

// ── Employee balances tab ─────────────────────────────────────────────────────

function EmployeeBalancesCard({
  itemName, customItemId, employees, departments, adminBalance, isPrime, onBulkGive,
}: {
  itemName: string;
  customItemId: number;
  employees: ItemUser[];
  departments: Department[];
  adminBalance: number;
  isPrime: boolean;
  onBulkGive: () => void;
}) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(u => {
      if (deptFilter !== "all" && u.departmentId !== Number(deptFilter)) return false;
      if (!q) return true;
      return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });
  }, [employees, search, deptFilter]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Employee {itemName} Balances</CardTitle>
            <CardDescription>Give or redeem {itemName} from employee accounts</CardDescription>
          </div>
          <Button size="sm" onClick={onBulkGive} data-testid="button-bulk-give-items">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Bulk Give
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-items-employees"
            />
          </div>
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger data-testid="select-items-dept-filter">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {employees.length === 0 ? "No employees yet" : "No employees match your search"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">{itemName} Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id} data-testid={`row-item-user-${u.id}`}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded">{u.username}</span></TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-primary">{u.customItemBalance.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ItemActionButton targetUser={u} customItemId={customItemId} action="give" itemName={itemName} adminBalance={adminBalance} isPrime={isPrime} />
                      <ItemActionButton targetUser={u} customItemId={customItemId} action="redeem" itemName={itemName} adminBalance={adminBalance} isPrime={isPrime} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Admin balances tab ────────────────────────────────────────────────────────

function AdminBalancesCard({
  itemName, customItemId, admins, getRoleLabel,
}: {
  itemName: string;
  customItemId: number;
  admins: ItemUser[];
  getRoleLabel: (r: string) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(u => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [admins, search]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Administrator {itemName} Balances</CardTitle>
        <CardDescription>
          Allocate {itemName} to administrators so they can distribute them to employees. Admins draw from their balance when giving to employees.
        </CardDescription>
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 translate-y-1 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search admins..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-items-admins"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{admins.length === 0 ? "No admins yet" : "No admins match your search"}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">{itemName} Balance</TableHead>
                <TableHead className="text-right">Allocate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id} data-testid={`row-item-admin-${u.id}`}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "prime_admin" ? "default" : "secondary"}>
                      {getRoleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-primary">{u.customItemBalance.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {u.role !== "prime_admin" && (
                      <ItemActionButton targetUser={u} customItemId={customItemId} action="give" itemName={itemName} adminBalance={Infinity} isPrime={true} label="Allocate" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryCard({ itemName, transactions, loading }: { itemName: string; transactions: ItemTx[] | undefined; loading: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!transactions) return [];
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t =>
      t.user.fullName.toLowerCase().includes(q) ||
      t.user.username.toLowerCase().includes(q) ||
      (t.reason ?? "").toLowerCase().includes(q)
    );
  }, [transactions, search]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>{itemName} Transaction History</CardTitle>
        <CardDescription>All gives and redeems for this item</CardDescription>
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 translate-y-1 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or reason..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-items-history"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader /> : filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">{itemName}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tx => (
                <TableRow key={tx.id} data-testid={`row-item-tx-${tx.id}`}>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(tx.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">{tx.user.fullName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.reason || "—"}</TableCell>
                  <TableCell className={`text-right font-bold tabular-nums ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            {transactions && transactions.length > 0 ? "No transactions match your search" : "No transactions yet"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Item create form (initial empty state) ───────────────────────────────────

function CreateItemForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (itemName: string) => {
      const res = await apiRequest("POST", "/api/admin/custom-items/items", { name: itemName });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Item created", description: `Custom item "${name}" is now active.` }); setName(""); onCreated(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="item-name">Item Name</Label>
        <Input
          id="item-name"
          placeholder="e.g. Safety Stars, Raffle Tickets, Pizza Coins..."
          value={name}
          onChange={e => setName(e.target.value)}
          data-testid="input-item-name"
        />
        <p className="text-xs text-muted-foreground">This is the name employees will see on their account.</p>
      </div>
      <Button onClick={() => { if (name.trim()) mutation.mutate(name.trim()); }} disabled={mutation.isPending || !name.trim()} data-testid="button-save-item-name">
        {mutation.isPending ? "Creating..." : "Create Item"}
      </Button>
    </div>
  );
}

// ── New item dialog (when items already exist) ───────────────────────────────

function CreateItemDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (item: CustomItem) => void;
}) {
  const [name, setName] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (itemName: string) => {
      const res = await apiRequest("POST", "/api/admin/custom-items/items", { name: itemName });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json() as Promise<CustomItem>;
    },
    onSuccess: (item) => {
      toast({ title: "Item created", description: `Custom item "${item.name}" is now active.` });
      onCreated(item);
      setName("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setName(""); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New Custom Item</DialogTitle>
          <DialogDescription>Create another item type your team can give and redeem.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="new-item-name">Item Name</Label>
          <Input
            id="new-item-name"
            placeholder="e.g. Safety Stars, Raffle Tickets..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            data-testid="input-new-item-name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { if (name.trim()) mutation.mutate(name.trim()); }} disabled={mutation.isPending || !name.trim()} data-testid="button-confirm-new-item">
            {mutation.isPending ? "Creating..." : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Configure (rename / delete) item button ──────────────────────────────────

function ConfigureItemButton({
  item, onSaved, onDeleted,
}: {
  item: CustomItem;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setName(item.name); setConfirmDelete(false); }
  }, [open, item.name]);

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await apiRequest("PATCH", `/api/admin/custom-items/items/${item.id}`, { name: newName });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Item renamed" }); onSaved(); setOpen(false); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/admin/custom-items/items/${item.id}`);
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Item deleted" }); onDeleted(); setOpen(false); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="button-configure-item">
        <Settings className="mr-1.5 h-3.5 w-3.5" /> Configure
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Configure {item.name}</DialogTitle>
            <DialogDescription>Rename or delete this item type.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-item">Item Name</Label>
            <Input id="rename-item" value={name} onChange={e => setName(e.target.value)} data-testid="input-rename-item" />
          </div>
          <div className="border-t pt-3 mt-1">
            {confirmDelete ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm font-medium text-destructive">Delete "{item.name}" permanently?</p>
                <p className="text-xs text-muted-foreground">This removes the item, all balances, and all of its transaction history. This cannot be undone.</p>
                <div className="flex gap-2 justify-end pt-1">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-item">
                    {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} data-testid="button-delete-item">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete this item
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => { if (name.trim() && name.trim() !== item.name) renameMutation.mutate(name.trim()); else setOpen(false); }}
              disabled={renameMutation.isPending || !name.trim()}
              data-testid="button-save-rename"
            >
              {renameMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Single Give/Redeem button (per row) ──────────────────────────────────────

function ItemActionButton({
  targetUser, customItemId, action, itemName, adminBalance, isPrime, label,
}: {
  targetUser: ItemUser;
  customItemId: number;
  action: "give" | "redeem";
  itemName: string;
  adminBalance: number;
  isPrime: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const parsedAmt = parseInt(amount) || 0;
  const wouldOverspend = action === "give" && !isPrime && parsedAmt > adminBalance;
  const wouldOverredeem = action === "redeem" && parsedAmt > targetUser.customItemBalance;

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = action === "give" ? "/api/admin/custom-items/give" : "/api/admin/custom-items/redeem";
      const res = await apiRequest("POST", endpoint, { userId: targetUser.id, customItemId, amount: parsedAmt, reason: reason.trim() || undefined });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/users", customItemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/transactions", customItemId] });
      toast({ title: action === "give" ? `${itemName} Given` : `${itemName} Redeemed`, description: `${parsedAmt} ${itemName} ${action === "give" ? "given to" : "redeemed from"} ${targetUser.fullName}.` });
      setOpen(false);
      setAmount("");
      setReason("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isDisabled = parsedAmt < 1 || wouldOverspend || wouldOverredeem || mutation.isPending;

  return (
    <>
      <Button
        size="sm"
        variant={action === "give" ? "default" : "outline"}
        onClick={() => setOpen(true)}
        data-testid={`button-${action}-item-${targetUser.id}`}
      >
        {action === "give" ? <Gift className="mr-1 h-3.5 w-3.5" /> : <Undo2 className="mr-1 h-3.5 w-3.5" />}
        {label ?? (action === "give" ? "Give" : "Redeem")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{action === "give" ? `Give ${itemName}` : `Redeem ${itemName}`}</DialogTitle>
            <DialogDescription>
              {action === "give"
                ? `Add ${itemName} to ${targetUser.fullName}'s account.`
                : `Remove ${itemName} from ${targetUser.fullName}'s account.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">{targetUser.fullName}'s balance</span>
              <span className="font-bold text-primary">{targetUser.customItemBalance.toLocaleString()}</span>
            </div>
            {action === "give" && !isPrime && (
              <div className="flex justify-between text-sm rounded-lg border bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Your balance</span>
                <span className="font-bold text-primary">{adminBalance.toLocaleString()}</span>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                data-testid={`input-${action}-amount`}
              />
              {wouldOverspend && <p className="text-xs text-destructive">Insufficient balance — you only have {adminBalance.toLocaleString()} available.</p>}
              {wouldOverredeem && <p className="text-xs text-destructive">{targetUser.fullName} only has {targetUser.customItemBalance.toLocaleString()} to redeem.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder={action === "give" ? "Great safety record" : "Redeemed at company event"}
                value={reason}
                onChange={e => setReason(e.target.value)}
                data-testid={`input-${action}-reason`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={isDisabled}
              variant={action === "redeem" ? "destructive" : "default"}
              data-testid={`button-confirm-${action}`}
            >
              {mutation.isPending ? "Processing..." : action === "give" ? `Give ${itemName}` : `Redeem ${itemName}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Bulk give dialog ─────────────────────────────────────────────────────────

function BulkGiveDialog({
  open, onOpenChange, employees, departments, itemName, customItemId, adminBalance, isPrime, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: ItemUser[];
  departments: Department[];
  itemName: string;
  customItemId: number;
  adminBalance: number;
  isPrime: boolean;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const reset = () => { setSelectedIds([]); setAmount(""); setReason(""); setDeptFilter("all"); setSearch(""); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(u => {
      if (deptFilter !== "all" && u.departmentId !== Number(deptFilter)) return false;
      if (!q) return true;
      return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });
  }, [employees, search, deptFilter]);

  const allSelected = filtered.length > 0 && filtered.every(u => selectedIds.includes(u.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filtered.some(u => u.id === id)));
    } else {
      const newIds = filtered.map(u => u.id).filter(id => !selectedIds.includes(id));
      setSelectedIds(prev => [...prev, ...newIds]);
    }
  };

  const toggle = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const parsedAmt = parseInt(amount) || 0;
  const totalNeeded = parsedAmt * selectedIds.length;
  const wouldOverspend = !isPrime && parsedAmt > 0 && totalNeeded > adminBalance;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/custom-items/give-bulk", {
        userIds: selectedIds,
        customItemId,
        amount: parsedAmt,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Items Given", description: `${parsedAmt} ${itemName} given to ${selectedIds.length} employee${selectedIds.length !== 1 ? "s" : ""}.` });
      onSuccess();
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canSubmit = selectedIds.length > 0 && parsedAmt >= 1 && !wouldOverspend && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Give {itemName}</DialogTitle>
          <DialogDescription>Select employees, enter a quantity, and give {itemName} to everyone at once.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-[1fr_180px]">
            <div className="grid gap-1.5">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name or code..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-bulk-search"
                />
              </div>
            </div>
            {departments.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger data-testid="select-bulk-dept-filter">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Select Employees ({selectedIds.length} selected)</Label>
              {filtered.length > 0 && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={toggleAll} data-testid="button-bulk-select-all">
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>
            <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  {employees.length === 0 ? "No employees" : "No employees match your filters"}
                </p>
              ) : (
                filtered.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`checkbox-bulk-emp-${u.id}`}>
                    <Checkbox
                      checked={selectedIds.includes(u.id)}
                      onCheckedChange={() => toggle(u.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">Balance: {u.customItemBalance.toLocaleString()}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Amount per Employee</Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 5"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              data-testid="input-bulk-amount"
            />
            {!isPrime && parsedAmt > 0 && selectedIds.length > 0 && (
              <p className={`text-xs ${wouldOverspend ? "text-destructive" : "text-muted-foreground"}`}>
                Total needed: {totalNeeded.toLocaleString()} — Your balance: {adminBalance.toLocaleString()}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Reason <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input
              placeholder="e.g. Monthly safety bonus"
              value={reason}
              onChange={e => setReason(e.target.value)}
              data-testid="input-bulk-reason"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit} data-testid="button-confirm-bulk-give">
            {mutation.isPending ? "Giving..." : `Give to ${selectedIds.length} Employee${selectedIds.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
