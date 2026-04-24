import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ScanLine, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type MerchantMe = { id: number; email: string; name: string; orgId: number };
type MerchantTx = { id: number; bucksAmount: number; createdAt: string; employee?: { id: number; fullName: string; email: string } | null };

type LastResult =
  | { kind: "ok"; employeeName: string; deducted: number; newBalance: number }
  | { kind: "err"; message: string };

export default function MerchantScannerPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me, isLoading } = useQuery<MerchantMe>({ queryKey: ["/api/merchant/me"], retry: false });

  const [amount, setAmount] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const containerId = "merchant-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isLoading && !me) setLocation("/merchant/login");
  }, [isLoading, me, setLocation]);

  const { data: txs = [] } = useQuery<MerchantTx[]>({
    queryKey: ["/api/merchant/transactions"],
    enabled: !!me,
    refetchInterval: 10000,
  });

  const redeemMut = useMutation({
    mutationFn: (vars: { token: string; amount: number }) =>
      apiRequest("POST", "/api/merchant/redeem", vars).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ message: "Redemption failed" }));
          throw new Error(err.message || "Redemption failed");
        }
        return r.json();
      }),
    onSuccess: (data: any) => {
      setLastResult({ kind: "ok", employeeName: data.employee?.fullName || "Member", deducted: data.deducted, newBalance: data.newBalance });
      setLastToken(null);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/transactions"] });
    },
    onError: (e: Error) => {
      setLastResult({ kind: "err", message: e.message });
      setLastToken(null);
    },
  });

  const logoutMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/merchant/logout", {}),
    onSuccess: () => { queryClient.removeQueries({ queryKey: ["/api/merchant/me"] }); setLocation("/merchant/login"); },
  });

  async function startScan() {
    setLastResult(null);
    setLastToken(null);
    setScanning(true);
    try {
      const inst = new Html5Qrcode(containerId, false);
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          setLastToken(decoded);
          stopScan();
        },
        () => {},
      );
    } catch (e: any) {
      setScanning(false);
      toast({ title: "Camera error", description: e?.message || "Could not start the camera. Make sure you've granted camera permission.", variant: "destructive" });
    }
  }

  async function stopScan() {
    setScanning(false);
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
  }

  useEffect(() => () => { void stopScan(); }, []);

  function submitRedeem() {
    if (!lastToken) { toast({ title: "Scan first", description: "Scan a member's QR code before redeeming.", variant: "destructive" }); return; }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) { toast({ title: "Enter a whole number", description: "Bucks amount must be a positive whole number.", variant: "destructive" }); return; }
    redeemMut.mutate({ token: lastToken, amount: n });
  }

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (!me) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-primary text-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <div className="text-xs text-white/60">Merchant</div>
            <div className="font-semibold truncate" data-testid="text-merchant-name" title={me.name}>{me.name}</div>
          </div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 shrink-0" onClick={() => logoutMut.mutate()} data-testid="button-merchant-logout">
            <LogOut className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Sign out</span><span className="sm:hidden">Out</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Scan a member's pass</CardTitle>
            <CardDescription>Open the member's Better Bucks pass in Apple Wallet, then scan the QR code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id={containerId} className="w-full aspect-square max-w-sm mx-auto bg-black rounded-lg overflow-hidden" data-testid="region-scanner" />
            <div className="flex gap-2 justify-center">
              {!scanning ? (
                <Button onClick={startScan} data-testid="button-start-scan">
                  <ScanLine className="h-4 w-4 mr-2" /> Start camera
                </Button>
              ) : (
                <Button variant="outline" onClick={stopScan} data-testid="button-stop-scan">Stop camera</Button>
              )}
            </div>

            {lastToken && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="text-sm text-muted-foreground">QR captured. Enter the Bucks amount to redeem:</div>
                <div className="space-y-2">
                  <Label htmlFor="amt">Bucks amount</Label>
                  <Input id="amt" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 50" data-testid="input-redeem-amount" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={submitRedeem} disabled={redeemMut.isPending} data-testid="button-confirm-redeem">
                    {redeemMut.isPending ? "Processing…" : "Redeem"}
                  </Button>
                  <Button variant="outline" onClick={() => { setLastToken(null); setAmount(""); }} data-testid="button-cancel-redeem">Cancel</Button>
                </div>
              </div>
            )}

            {lastResult?.kind === "ok" && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3" data-testid="result-success">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-green-800">Redeemed {lastResult.deducted} Bucks</div>
                  <div className="text-green-700">{lastResult.employeeName} — new balance: <strong>{lastResult.newBalance}</strong></div>
                </div>
              </div>
            )}
            {lastResult?.kind === "err" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3" data-testid="result-error">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">{lastResult.message}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent redemptions</CardTitle>
              <CardDescription>Your last 100 transactions</CardDescription>
            </div>
            <Button variant="ghost" size="icon" aria-label="Refresh transactions" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/merchant/transactions"] })} data-testid="button-refresh-tx">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {txs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-transactions">No redemptions yet.</div>
            ) : (
              <ul className="divide-y">
                {txs.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-2 text-sm" data-testid={`row-tx-${t.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate" title={t.employee?.fullName || `Member #${t.employee?.id ?? "?"}`}>{t.employee?.fullName || `Member #${t.employee?.id ?? "?"}`}</div>
                      <div className="text-xs text-muted-foreground truncate">{new Date(t.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="font-semibold tabular-nums whitespace-nowrap shrink-0">−{t.bucksAmount.toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
