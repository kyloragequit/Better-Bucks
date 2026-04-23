import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, KeyRound, Power, Eye } from "lucide-react";

type Merchant = { id: number; name: string; email: string; status: "active" | "disabled"; createdAt: string };
type Tx = { id: number; bucksAmount: number; createdAt: string; employee?: { id: number; fullName: string; email: string } | null };

export default function AdminMerchantsPage() {
  const { toast } = useToast();
  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({ queryKey: ["/api/admin/merchants"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [pwdMerchant, setPwdMerchant] = useState<Merchant | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const [txMerchant, setTxMerchant] = useState<Merchant | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/merchants", { name, email, password }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to create");
      return r.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      setCreateOpen(false); setName(""); setEmail(""); setPassword("");
      toast({ title: "Merchant created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/admin/merchants/${vars.id}`, vars.data).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to update");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      setPwdMerchant(null); setNewPwd("");
      toast({ title: "Updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/merchants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      toast({ title: "Merchant deleted" });
    },
  });

  const { data: txs = [] } = useQuery<Tx[]>({
    queryKey: ["/api/admin/merchants", txMerchant?.id, "transactions"],
    queryFn: () => fetch(`/api/admin/merchants/${txMerchant!.id}/transactions`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!txMerchant,
  });

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Merchants</h1>
            <p className="text-sm text-muted-foreground">Locations where members can scan their Better Bucks pass.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-merchant"><Plus className="h-4 w-4 mr-2" /> Add merchant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add merchant</DialogTitle>
                <DialogDescription>The merchant will sign in at /merchant/login.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
                <div className="space-y-2">
                  <Label htmlFor="m-name">Name</Label>
                  <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-merchant-create-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-email">Email</Label>
                  <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-merchant-create-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-pwd">Password</Label>
                  <Input id="m-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required data-testid="input-merchant-create-password" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending} data-testid="button-submit-merchant">{createMut.isPending ? "Creating…" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All merchants</CardTitle>
            <CardDescription>{merchants.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : merchants.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-merchants">No merchants yet. Click "Add merchant" to create one.</div>
            ) : (
              <ul className="divide-y">
                {merchants.map((m) => (
                  <li key={m.id} className="py-3 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-merchant-${m.id}`}>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Badge variant={m.status === "active" ? "default" : "secondary"} data-testid={`badge-status-${m.id}`}>{m.status}</Badge>
                      <Button size="sm" variant="outline" className="h-9 w-9 sm:w-auto sm:px-3" onClick={() => setTxMerchant(m)} aria-label={`Transactions for ${m.name}`} data-testid={`button-tx-${m.id}`}>
                        <Eye className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Transactions</span>
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 w-9 sm:w-auto sm:px-3" onClick={() => setPwdMerchant(m)} aria-label={`Reset password for ${m.name}`} data-testid={`button-pwd-${m.id}`}>
                        <KeyRound className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Reset password</span>
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 w-9 sm:w-auto sm:px-3" onClick={() => updateMut.mutate({ id: m.id, data: { status: m.status === "active" ? "disabled" : "active" } })} aria-label={m.status === "active" ? `Disable ${m.name}` : `Enable ${m.name}`} data-testid={`button-toggle-${m.id}`}>
                        <Power className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{m.status === "active" ? "Disable" : "Enable"}</span>
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9 w-9" onClick={() => { if (confirm(`Delete merchant "${m.name}"?`)) deleteMut.mutate(m.id); }} aria-label={`Delete ${m.name}`} data-testid={`button-delete-${m.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!pwdMerchant} onOpenChange={(o) => { if (!o) { setPwdMerchant(null); setNewPwd(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {pwdMerchant?.name}.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (pwdMerchant) updateMut.mutate({ id: pwdMerchant.id, data: { password: newPwd } }); }}>
            <div className="space-y-2">
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} minLength={6} required data-testid="input-merchant-new-password" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMut.isPending} data-testid="button-submit-password">{updateMut.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!txMerchant} onOpenChange={(o) => { if (!o) setTxMerchant(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{txMerchant?.name} — transactions</DialogTitle>
            <DialogDescription>Last 200 redemptions</DialogDescription>
          </DialogHeader>
          {txs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</div>
          ) : (
            <ul className="divide-y max-h-96 overflow-y-auto">
              {txs.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{t.employee?.fullName || `Member #${t.employee?.id ?? "?"}`}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="font-semibold">−{t.bucksAmount}</div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
