import { useState, useEffect, useRef } from "react";
import { usePublicDemo } from "@/hooks/use-demo";
import { SpinningLogo } from "@/components/spinning-logo";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Camera, QrCode, Search, ArrowLeft, Plus, Minus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { User, TransactionCategory } from "@shared/schema";
import { useUser } from "@/hooks/use-auth";

type ScannedUser = {
  id: number;
  fullName: string;
  username: string;
  balance: number;
  role: string;
  departmentId: number | null;
};

export default function AdminInstantTransactionPage() {
  const isPublicDemo = usePublicDemo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useUser();
  const [mode, setMode] = useState<"scan" | "manual" | "transaction">("scan");
  const [scannedUser, setScannedUser] = useState<ScannedUser | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [txType, setTxType] = useState<"credit" | "debit">("credit");
  const [categoryId, setCategoryId] = useState<string>("");
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const { data: allUsers } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const { data: categories } = useQuery<TransactionCategory[]>({
    queryKey: [`/api/organizations/${currentUser?.organizationId}/categories`],
    enabled: !!currentUser?.organizationId,
  });

  const suggestions = manualCode.trim().length >= 1
    ? (allUsers ?? []).filter(u =>
        u.fullName.toLowerCase().includes(manualCode.toLowerCase()) ||
        u.username.toLowerCase().includes(manualCode.toLowerCase()) ||
        u.barcode?.toLowerCase().includes(manualCode.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const lookupMutation = useMutation({
    mutationFn: async (identifier: string) => {
      const res = await apiRequest("GET", `/api/users/scan/${encodeURIComponent(identifier)}`);
      return await res.json() as ScannedUser;
    },
    onSuccess: (user) => {
      setScannedUser(user);
      setMode("transaction");
      stopScanner();
    },
    onError: (e: Error) => {
      const msg = e.message.replace(/^\d+:\s*/, "");
      toast({ title: "Not Found", description: msg || "No team member found with that code.", variant: "destructive" });
    },
  });

  const transactionMutation = useMutation({
    mutationFn: async (data: { userId: number; amount: number; reason: string; categoryId?: number }) => {
      const res = await apiRequest("POST", `/api/users/${data.userId}/balance`, {
        amount: data.amount,
        reason: data.reason,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      });
      return await res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      const bcks = Math.abs(vars.amount).toLocaleString();
      toast({ title: "Transaction Complete", description: `Successfully ${vars.amount > 0 ? "credited" : "debited"} ${bcks} Bucks.` });
      setScannedUser(null);
      setAmount("");
      setReason("");
      setCategoryId("");
      setMode("scan");
    },
    onError: (e: Error) => {
      const msg = e.message.replace(/^\d+:\s*/, "");
      toast({ title: "Transaction Failed", description: msg, variant: "destructive" });
    },
  });

  const startScanner = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!containerRef.current) return;

      const scanner = new Html5Qrcode("qr-scanner-container");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.id || data.username) {
              lookupMutation.mutate(data.id?.toString() || data.username);
            }
          } catch {
            lookupMutation.mutate(decodedText);
          }
        },
        () => {}
      );
    } catch (err: any) {
      toast({ title: "Camera Error", description: "Could not access camera. Please use manual lookup.", variant: "destructive" });
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleManualLookup = () => {
    if (!manualCode.trim()) return;
    setShowSuggestions(false);
    lookupMutation.mutate(manualCode.trim());
  };

  const selectSuggestion = (user: User) => {
    setShowSuggestions(false);
    setManualDialogOpen(false);
    setManualCode(user.fullName);
    setScannedUser({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      balance: user.balance,
      role: user.role,
      departmentId: user.departmentId ?? null,
    });
    setMode("transaction");
  };

  const parsedAmount = parseInt(amount) || 0;
  const isPrime = currentUser?.role === "prime_admin";
  const adminBalance = currentUser?.balance ?? 0;
  const wouldOverspend = txType === "credit" && !isPrime && parsedAmount > adminBalance;

  const handleSubmitTransaction = () => {
    if (!scannedUser || !amount || parseInt(amount) <= 0) {
      toast({ title: "Invalid", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    if (txType === "credit") {
      if (!categoryId || categoryId === "none") {
        toast({ title: "Missing Category", description: "Please select a category.", variant: "destructive" });
        return;
      }
      if (wouldOverspend) {
        toast({ title: "Insufficient Balance", description: `You need ${parsedAmount.toLocaleString()} bucks but only have ${adminBalance.toLocaleString()}.`, variant: "destructive" });
        return;
      }
      const selectedCat = categories?.find(c => String(c.id) === categoryId);
      const catName = selectedCat?.name ?? "Instant credit";
      transactionMutation.mutate({
        userId: scannedUser.id,
        amount: parseInt(amount),
        reason: catName,
        categoryId: parseInt(categoryId),
      });
    } else {
      transactionMutation.mutate({
        userId: scannedUser.id,
        amount: -parseInt(amount),
        reason: reason || "Instant debit",
      });
    }
  };

  const resetToScan = () => {
    setScannedUser(null);
    setAmount("");
    setReason("");
    setCategoryId("");
    setTxType("credit");
    setMode("scan");
  };

  return (
    <AdminLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-instant-tx-title">Instant Transaction</h1>
          <p className="text-muted-foreground mt-1">Scan a QR code or look up a team member to credit or debit Bucks instantly</p>
        </div>

        {mode === "transaction" && scannedUser ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={resetToScan} data-testid="button-back-to-scan">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Scanner
            </Button>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Team Member Found</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-bold" data-testid="text-scanned-name">{scannedUser.fullName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Code</span>
                  <span className="font-mono text-sm" data-testid="text-scanned-code">{scannedUser.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="font-bold text-primary" data-testid="text-scanned-balance">{scannedUser.balance.toLocaleString()} bcks</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transaction Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isPrime && (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm" data-testid="admin-balance-display">
                    <span className="text-muted-foreground">Your Bucks balance</span>
                    <span className="font-bold text-primary tabular-nums">{adminBalance.toLocaleString()} bcks</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant={txType === "credit" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setTxType("credit")}
                    data-testid="button-tx-credit"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Credit
                  </Button>
                  <Button
                    variant={txType === "debit" ? "destructive" : "outline"}
                    className="flex-1"
                    onClick={() => setTxType("debit")}
                    data-testid="button-tx-debit"
                  >
                    <Minus className="mr-1 h-4 w-4" /> Debit
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tx-amount">Amount (Bucks)</Label>
                  <Input
                    id="tx-amount"
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter Bucks amount"
                    data-testid="input-tx-amount"
                  />
                  {wouldOverspend && (
                    <p className="text-xs text-destructive" data-testid="text-insufficient-balance">
                      Insufficient balance — you only have {adminBalance.toLocaleString()} bcks available.
                    </p>
                  )}
                </div>
                {txType === "credit" ? (
                  <div className="space-y-1">
                    <Label htmlFor="tx-category">Category</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger id="tx-category" data-testid="select-tx-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories && categories.length > 0 ? categories.map(cat => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            <span className="flex items-center gap-2">
                              <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </span>
                          </SelectItem>
                        )) : (
                          <SelectItem value="none" disabled>No categories set up</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {(!categories || categories.length === 0) && (
                      <p className="text-xs text-muted-foreground">Ask your Organization Owner to set up categories in Settings.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="tx-reason">Reason (optional)</Label>
                    <Textarea
                      id="tx-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Cafeteria purchase"
                      rows={2}
                      data-testid="input-tx-reason"
                    />
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={handleSubmitTransaction}
                  disabled={isPublicDemo || transactionMutation.isPending || !amount || parseInt(amount) <= 0 || wouldOverspend}
                  data-testid="button-submit-tx"
                >
                  {transactionMutation.isPending ? (
                    <SpinningLogo className="mr-2 h-4 w-4" />
                  ) : null}
                  {isPublicDemo ? "View Only – Demo Mode" : `${txType === "credit" ? "Credit" : "Debit"} ${amount ? `${parseInt(amount).toLocaleString()} Bucks` : "Bucks"}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Scan QR Code
                </CardTitle>
                <CardDescription>Point the camera at a team member's QR code</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  id="qr-scanner-container"
                  ref={containerRef}
                  className="w-full min-h-[280px] bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center"
                  data-testid="qr-scanner-area"
                >
                  {!scanning && (
                    <div className="text-center space-y-3 p-6">
                      <QrCode className="h-16 w-16 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Camera is off. Click below to start scanning.</p>
                    </div>
                  )}
                </div>
                {scanning ? (
                  <Button variant="outline" className="w-full" onClick={stopScanner} data-testid="button-stop-scanner">
                    Stop Scanner
                  </Button>
                ) : (
                  <Button className="w-full" onClick={startScanner} data-testid="button-start-scanner">
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera
                  </Button>
                )}
                {lookupMutation.isPending && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <SpinningLogo className="h-4 w-4" /> Looking up team member...
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              variant="outline"
              className="w-full py-6 text-base"
              onClick={() => {
                setManualDialogOpen(true);
                setManualCode("");
                setShowSuggestions(false);
                setTimeout(() => manualInputRef.current?.focus(), 150);
              }}
              data-testid="button-open-manual-lookup"
            >
              <Search className="mr-2 h-5 w-5" />
              Manual Lookup
            </Button>

            <Dialog open={manualDialogOpen} onOpenChange={(open) => { setManualDialogOpen(open); if (!open) setShowSuggestions(false); }}>
              <DialogContent className="sm:max-w-[440px]" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Manual Lookup
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground -mt-2">Search by name, username, or employee code</p>
                <div ref={suggestionsRef} className="relative">
                  <div className="flex gap-2">
                    <Input
                      ref={manualInputRef}
                      value={manualCode}
                      onChange={(e) => {
                        setManualCode(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Search by name, username, or code..."
                      onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                      data-testid="input-manual-lookup"
                    />
                    <Button
                      onClick={handleManualLookup}
                      disabled={lookupMutation.isPending || !manualCode.trim()}
                      data-testid="button-manual-lookup"
                    >
                      {lookupMutation.isPending ? <SpinningLogo className="h-4 w-4" /> : "Look Up"}
                    </Button>
                  </div>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="mt-2 bg-background border rounded-lg shadow-lg overflow-hidden max-h-[280px] overflow-y-auto">
                      {suggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b last:border-b-0"
                          onClick={() => selectSuggestion(u)}
                          data-testid={`suggestion-${u.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{u.fullName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{u.username}</p>
                          </div>
                          <span className="text-xs font-bold text-primary">{u.balance.toLocaleString()} bcks</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
