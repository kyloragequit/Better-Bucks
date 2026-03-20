import { useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Gift, Undo2, Pencil, Settings, Package } from "lucide-react";
import { useRoleLabels } from "@/hooks/use-role-labels";
import type { CustomItemTransaction } from "@shared/schema";

type ItemUser = { id: number; fullName: string; username: string; role: string; departmentId: number | null; customItemBalance: number };
type ItemTx = CustomItemTransaction & { user: { fullName: string; username: string } };

export default function AdminItemsPage() {
  const { data: currentUser } = useUser();
  const isPrime = currentUser?.role === "prime_admin";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getRoleLabel } = useRoleLabels();

  const { data: config, isLoading: configLoading } = useQuery<{ itemName: string | null }>({
    queryKey: ["/api/admin/custom-items/config"],
  });
  const { data: itemUsers, isLoading: usersLoading } = useQuery<ItemUser[]>({
    queryKey: ["/api/admin/custom-items/users"],
  });
  const { data: transactions, isLoading: txLoading } = useQuery<ItemTx[]>({
    queryKey: ["/api/admin/custom-items/transactions"],
  });

  const itemName = config?.itemName;

  if (configLoading || usersLoading) return <AdminLayout><Loader /></AdminLayout>;

  if (!itemName) {
    return (
      <AdminLayout>
        <div className="mb-8 animate-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Custom Items</h1>
          <p className="text-muted-foreground mt-1">A non-Bucks incentive item your organization can give and redeem</p>
        </div>
        <Card className="shadow-md max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> No Item Configured</CardTitle>
            <CardDescription>
              {isPrime
                ? "The Organization Owner can create a custom item type — like \"Safety Stars\", \"Raffle Tickets\", or any other incentive token."
                : "Your Organization Owner hasn't set up a custom item yet. Ask them to configure one in this section."}
            </CardDescription>
          </CardHeader>
          {isPrime && (
            <CardContent>
              <ConfigureItemCard onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/config"] })} />
            </CardContent>
          )}
        </Card>
      </AdminLayout>
    );
  }

  const employees = (itemUsers ?? []).filter(u => u.role === "employee");
  const admins = (itemUsers ?? []).filter(u => u.role === "admin" || u.role === "prime_admin");
  const myBalance = itemUsers?.find(u => u.id === currentUser?.id)?.customItemBalance ?? 0;

  return (
    <AdminLayout>
      <div className="mb-6 animate-in flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            {itemName}
          </h1>
          <p className="text-muted-foreground mt-1">Give and redeem {itemName} across your team</p>
        </div>
        <div className="flex items-center gap-3">
          {!isPrime && (
            <div className="rounded-lg border bg-card px-4 py-2 text-sm">
              <span className="text-muted-foreground">Your balance: </span>
              <span className="font-bold text-primary tabular-nums">{myBalance.toLocaleString()}</span>
            </div>
          )}
          {isPrime && (
            <ConfigureItemButton currentName={itemName} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/config"] })} />
          )}
        </div>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees" data-testid="tab-items-employees">Employees</TabsTrigger>
          {isPrime && <TabsTrigger value="admins" data-testid="tab-items-admins">Admin Balances</TabsTrigger>}
          <TabsTrigger value="history" data-testid="tab-items-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Employee {itemName} Balances</CardTitle>
              <CardDescription>Give or redeem {itemName} from employee accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No employees yet</p>
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
                    {employees.map(u => (
                      <TableRow key={u.id} data-testid={`row-item-user-${u.id}`}>
                        <TableCell className="font-medium">{u.fullName}</TableCell>
                        <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded">{u.username}</span></TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-primary">{u.customItemBalance.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <ItemActionButton targetUser={u} action="give" itemName={itemName} adminBalance={myBalance} isPrime={isPrime} />
                            <ItemActionButton targetUser={u} action="redeem" itemName={itemName} adminBalance={myBalance} isPrime={isPrime} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isPrime && (
          <TabsContent value="admins">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Administrator {itemName} Balances</CardTitle>
                <CardDescription>
                  Allocate {itemName} to administrators so they can distribute them to employees. Admins draw from their balance when giving to employees.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {admins.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No admins yet</p>
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
                      {admins.map(u => (
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
                              <ItemActionButton targetUser={u} action="give" itemName={itemName} adminBalance={Infinity} isPrime={true} label="Allocate" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="history">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>{itemName} Transaction History</CardTitle>
              <CardDescription>All gives and redeems for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              {txLoading ? <Loader /> : transactions && transactions.length > 0 ? (
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
                    {transactions.map(tx => (
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
                <p className="text-center text-muted-foreground py-8">No transactions yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function ConfigureItemCard({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (itemName: string) => {
      const res = await apiRequest("PATCH", "/api/admin/custom-items/config", { itemName });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Item configured", description: `Custom item "${name}" is now active.` }); onSaved(); },
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
        {mutation.isPending ? "Saving..." : "Create Item"}
      </Button>
    </div>
  );
}

function ConfigureItemButton({ currentName, onSaved }: { currentName: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (itemName: string) => {
      const res = await apiRequest("PATCH", "/api/admin/custom-items/config", { itemName });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Item renamed" }); onSaved(); setOpen(false); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setName(currentName); setOpen(true); }} data-testid="button-configure-item">
        <Settings className="mr-1.5 h-3.5 w-3.5" /> Configure
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Configure Custom Item</DialogTitle>
            <DialogDescription>Change the name of your custom item type.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-item">Item Name</Label>
            <Input id="rename-item" value={name} onChange={e => setName(e.target.value)} placeholder="Safety Stars" data-testid="input-rename-item" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (name.trim()) mutation.mutate(name.trim()); }} disabled={mutation.isPending || !name.trim()} data-testid="button-save-rename">
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ItemActionButton({
  targetUser, action, itemName, adminBalance, isPrime, label,
}: {
  targetUser: ItemUser;
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
      const res = await apiRequest("POST", endpoint, { userId: targetUser.id, amount: parsedAmt, reason: reason.trim() || undefined });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-items/transactions"] });
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
