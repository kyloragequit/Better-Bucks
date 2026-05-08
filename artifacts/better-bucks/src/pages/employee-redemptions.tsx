import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store, ArrowLeft, AlertTriangle, TrendingDown, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Redemption = {
  id: number;
  bucksAmount: number;
  createdAt: string;
  merchant: { id: number; name: string } | null;
};

type RedemptionsResponse = {
  summary: { monthTotal: number; allTimeTotal: number };
  redemptions: Redemption[];
};

type Dispute = {
  id: number;
  transactionId: number;
  status: "pending" | "refunded" | "dismissed";
};

export default function EmployeeRedemptionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<RedemptionsResponse>({
    queryKey: ["/api/wallet/redemptions"],
  });

  const redemptions = data?.redemptions ?? [];
  const summary = data?.summary;
  const monthName = format(new Date(), "MMMM");

  const { data: disputes = [] } = useQuery<Dispute[]>({
    queryKey: ["/api/wallet/my-disputes"],
    queryFn: () =>
      fetch("/api/wallet/my-disputes", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
  });

  const disputeByTx = new Map(disputes.map((d) => [d.transactionId, d]));

  const [disputeTarget, setDisputeTarget] = useState<Redemption | null>(null);
  const [reason, setReason] = useState("");

  const disputeMut = useMutation({
    mutationFn: (r: Redemption) =>
      apiRequest("POST", `/api/wallet/redemptions/${r.id}/dispute`, { reason }).then(
        async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed");
          return res.json();
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wallet/my-disputes"] });
      setDisputeTarget(null);
      setReason("");
      toast({ title: "Dispute submitted", description: "An admin will review your dispute shortly." });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openDispute(r: Redemption) {
    setReason("");
    setDisputeTarget(r);
  }

  function statusBadge(d: Dispute) {
    if (d.status === "pending") return <Badge variant="secondary" className="text-xs">Disputed</Badge>;
    if (d.status === "refunded") return <Badge variant="default" className="bg-green-600 text-xs">Refunded</Badge>;
    return <Badge variant="outline" className="text-xs text-muted-foreground">Dismissed</Badge>;
  }

  return (
    <EmployeeLayout>
      <div className="mb-6 animate-in">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-3"
          data-testid="link-back-to-dashboard"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1 className="text-3xl font-display font-bold text-foreground">In-store purchases</h1>
        <p className="text-muted-foreground mt-1">
          Every time a merchant scans your wallet pass, the redemption appears here. If you don&apos;t
          recognize a charge, use "Dispute" to flag it.
        </p>
      </div>

      {/* Summary cards */}
      {!isLoading && summary !== undefined && (
        <div className="grid grid-cols-2 gap-4 mb-6" data-testid="section-redemption-summary">
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Calendar className="h-3.5 w-3.5" />
                {monthName} spending
              </div>
              <p className="text-2xl font-display font-bold tabular-nums text-foreground" data-testid="text-month-total">
                {summary.monthTotal.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1">bcks</span>
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <TrendingDown className="h-3.5 w-3.5" />
                All-time spent
              </div>
              <p className="text-2xl font-display font-bold tabular-nums text-foreground" data-testid="text-alltime-total">
                {summary.allTimeTotal.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1">bcks</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-md border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> All merchant redemptions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="py-8"><Loader /></div>
          ) : redemptions.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground px-4" data-testid="text-no-redemptions">
              No in-store purchases yet.
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-2 px-4">
                {redemptions.map((r) => {
                  const existingDispute = disputeByTx.get(r.id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 py-3 border-b last:border-0"
                      data-testid={`redemption-row-${r.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate" data-testid={`text-merchant-${r.id}`}>
                          {r.merchant?.name ?? "Unknown merchant"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(r.createdAt), "MMM d, yyyy h:mm a")}
                        </p>
                        {existingDispute && (
                          <div className="mt-1">{statusBadge(existingDispute)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold tabular-nums text-sm text-red-600" data-testid={`text-amount-${r.id}`}>
                          -{r.bucksAmount.toLocaleString()}
                        </span>
                        {!existingDispute && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => openDispute(r)}
                            data-testid={`button-dispute-${r.id}`}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Dispute
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((r) => {
                      const existingDispute = disputeByTx.get(r.id);
                      return (
                        <TableRow key={r.id} data-testid={`redemption-row-${r.id}`}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(r.createdAt), "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-merchant-${r.id}`}>
                            {r.merchant?.name ?? "Unknown merchant"}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-red-600" data-testid={`text-amount-${r.id}`}>
                            -{r.bucksAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {existingDispute ? (
                              statusBadge(existingDispute)
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openDispute(r)}
                                data-testid={`button-dispute-${r.id}`}
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Dispute
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!disputeTarget} onOpenChange={(o) => { if (!o) { setDisputeTarget(null); setReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Dispute this charge
            </DialogTitle>
            <DialogDescription>
              Describe why you don&apos;t recognize this charge from{" "}
              <span className="font-medium">{disputeTarget?.merchant?.name ?? "this merchant"}</span>{" "}
              for{" "}
              <span className="font-medium">{disputeTarget?.bucksAmount.toLocaleString()} Bucks</span>.
              An admin will review it and refund or dismiss the dispute.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (disputeTarget) disputeMut.mutate(disputeTarget);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="dispute-reason">Reason</Label>
              <Textarea
                id="dispute-reason"
                placeholder="e.g. I didn't make this purchase and wasn't near this location."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                minLength={5}
                maxLength={1000}
                data-testid="input-dispute-reason"
              />
              <p className="text-xs text-muted-foreground">{reason.length}/1000</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDisputeTarget(null); setReason(""); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={disputeMut.isPending || reason.trim().length < 5} data-testid="button-submit-dispute">
                {disputeMut.isPending ? "Submitting…" : "Submit dispute"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </EmployeeLayout>
  );
}
