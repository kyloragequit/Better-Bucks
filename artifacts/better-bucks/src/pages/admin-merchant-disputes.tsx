import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout-admin";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

type DisputeTransaction = {
  id: number;
  bucksAmount: number;
  createdAt: string;
  merchant: { id: number; name: string } | null;
};

type Dispute = {
  id: number;
  status: "pending" | "refunded" | "dismissed";
  reason: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  employee: { id: number; fullName: string; email: string | null } | null;
  transaction: DisputeTransaction | null;
};

function statusBadge(status: Dispute["status"]) {
  if (status === "pending") return <Badge variant="secondary" className="capitalize">Pending</Badge>;
  if (status === "refunded") return <Badge className="bg-green-600 capitalize">Refunded</Badge>;
  return <Badge variant="outline" className="capitalize text-muted-foreground">Dismissed</Badge>;
}

export default function AdminMerchantDisputesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    queryKey: ["/api/admin/merchant-disputes"],
  });

  const [selected, setSelected] = useState<Dispute | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [action, setAction] = useState<"refunded" | "dismissed" | null>(null);

  const resolveMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "refunded" | "dismissed" }) =>
      apiRequest("PATCH", `/api/admin/merchant-disputes/${id}`, {
        status,
        adminNotes: adminNotes.trim() || undefined,
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed");
        return r.json();
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/merchant-disputes"] });
      setSelected(null);
      setAdminNotes("");
      setAction(null);
      toast({
        title: vars.status === "refunded" ? "Bucks refunded" : "Dispute dismissed",
        description:
          vars.status === "refunded"
            ? "The employee's Bucks have been credited back."
            : "The dispute has been dismissed.",
      });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openResolve(d: Dispute, a: "refunded" | "dismissed") {
    setSelected(d);
    setAdminNotes("");
    setAction(a);
  }

  const pending = disputes.filter((d) => d.status === "pending");
  const resolved = disputes.filter((d) => d.status !== "pending");

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Merchant Disputes
          </h1>
          <p className="text-sm text-muted-foreground">
            Review charges that employees have flagged as unrecognized.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Pending review
            </CardTitle>
            <CardDescription>
              {pending.length === 0
                ? "No pending disputes"
                : `${pending.length} dispute${pending.length !== 1 ? "s" : ""} awaiting review`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader />
            ) : pending.length === 0 ? (
              <div
                className="text-sm text-muted-foreground py-6 text-center"
                data-testid="text-no-pending-disputes"
              >
                All caught up — no pending disputes.
              </div>
            ) : (
              <ul className="divide-y">
                {pending.map((d) => (
                  <li
                    key={d.id}
                    className="py-4 space-y-2"
                    data-testid={`row-dispute-${d.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {statusBadge(d.status)}
                          <span className="font-medium text-sm">
                            {d.employee?.fullName ?? `Employee #${d.employee?.id ?? "?"}`}
                          </span>
                          {d.employee?.email && (
                            <span className="text-xs text-muted-foreground">
                              ({d.employee.email})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dispute filed {format(new Date(d.createdAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => openResolve(d, "refunded")}
                          data-testid={`button-refund-${d.id}`}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Refund Bucks
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => openResolve(d, "dismissed")}
                          data-testid={`button-dismiss-${d.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>

                    {d.transaction && (
                      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">
                            {d.transaction.merchant?.name ?? "Unknown merchant"}
                          </span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {format(new Date(d.transaction.createdAt), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                        <span className="font-semibold text-red-600 tabular-nums">
                          -{d.transaction.bucksAmount.toLocaleString()} Bucks
                        </span>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Reason: </span>
                      {d.reason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {resolved.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolved disputes</CardTitle>
              <CardDescription>{resolved.length} resolved</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {resolved.map((d) => (
                  <li
                    key={d.id}
                    className="py-3 space-y-1 opacity-75"
                    data-testid={`row-resolved-dispute-${d.id}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(d.status)}
                      <span className="text-sm font-medium">
                        {d.employee?.fullName ?? `Employee #${d.employee?.id ?? "?"}`}
                      </span>
                      {d.transaction && (
                        <span className="text-xs text-muted-foreground">
                          —{" "}
                          {d.transaction.merchant?.name ?? "Unknown merchant"}{" "}
                          {d.transaction.bucksAmount.toLocaleString()} Bucks
                        </span>
                      )}
                    </div>
                    {d.adminNotes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Admin notes: </span>
                        {d.adminNotes}
                      </p>
                    )}
                    {d.resolvedAt && (
                      <p className="text-xs text-muted-foreground">
                        Resolved {format(new Date(d.resolvedAt), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={!!selected && !!action}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setAdminNotes("");
            setAction(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "refunded" ? "Refund Bucks" : "Dismiss dispute"}
            </DialogTitle>
            <DialogDescription>
              {action === "refunded"
                ? `This will credit back ${selected?.transaction?.bucksAmount.toLocaleString() ?? "the"} Bucks to ${selected?.employee?.fullName ?? "the employee"}.`
                : `This will dismiss the dispute from ${selected?.employee?.fullName ?? "the employee"} without issuing a refund.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="admin-notes">Admin notes (optional)</Label>
            <Textarea
              id="admin-notes"
              placeholder="Add any internal notes about this decision…"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              data-testid="input-admin-notes"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setAdminNotes("");
                setAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={action === "refunded" ? "default" : "destructive"}
              disabled={resolveMut.isPending}
              onClick={() => {
                if (selected && action) resolveMut.mutate({ id: selected.id, status: action });
              }}
              data-testid="button-confirm-resolve"
            >
              {resolveMut.isPending
                ? "Processing…"
                : action === "refunded"
                ? "Confirm refund"
                : "Dismiss dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
