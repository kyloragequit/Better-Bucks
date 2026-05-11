import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout-admin";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertOctagon, CheckCircle2, Clock, RefreshCw, RotateCcw } from "lucide-react";

type StripeOrphanRow = {
  id: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: "pending" | "processing" | "resolved" | "failed_permanently";
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type StripeOrphansData = {
  rows: StripeOrphanRow[];
  counts: Record<string, number>;
};

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    iconBg: "bg-yellow-100",
    headerBg: "bg-yellow-50",
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  processing: {
    label: "Processing",
    icon: RefreshCw,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
    headerBg: "bg-blue-50",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  failed_permanently: {
    label: "Permanently Failed",
    icon: AlertOctagon,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    iconBg: "bg-red-100",
    headerBg: "bg-red-50",
    badgeClass: "bg-red-100 text-red-700",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    iconBg: "bg-green-100",
    headerBg: "bg-green-50",
    badgeClass: "bg-green-100 text-green-700",
  },
} as const;

const STATUS_ORDER = ["pending", "processing", "failed_permanently", "resolved"] as const;

export default function AdminStripeOrphansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<StripeOrphansData>({
    queryKey: ["/api/admin/stripe-orphans"],
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/stripe-orphans/${id}/retry`, {});
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Retry failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stripe-orphans"] });
      toast({ title: "Retry triggered", description: "Stripe cleanup was attempted." });
    },
    onError: (e: Error) =>
      toast({ title: "Retry failed", description: e.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/stripe-orphans/${id}`, {});
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to resolve");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stripe-orphans"] });
      toast({ title: "Marked resolved", description: "The record has been marked as resolved." });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isBusy = retryMutation.isPending || resolveMutation.isPending;

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Failed Signup Records
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Stripe objects that could not be automatically cleaned up after a failed signup. Retry or mark resolved once confirmed.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-stripe-orphans"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATUS_ORDER.map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            const count = data?.counts[status] ?? 0;
            return (
              <Card key={status} className={`${config.bg} ${config.border} border`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.iconBg}`}>
                      <Icon className={`h-5 w-5 ${config.text}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${config.text}`}>
                        {isLoading ? "—" : count}
                      </p>
                      <p className={`text-xs font-medium ${config.text} opacity-80`}>
                        {config.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader />
          </div>
        ) : !data?.rows.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="font-medium text-muted-foreground text-sm">No failed signup records found.</p>
              <p className="text-xs text-muted-foreground">All Stripe objects were linked successfully.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {STATUS_ORDER.map((status) => {
              const config = STATUS_CONFIG[status];
              const SectionIcon = config.icon;
              const groupRows = (data?.rows ?? []).filter((r) => r.status === status);
              if (!groupRows.length) return null;
              return (
                <Card key={status} className={`border ${config.border}`} data-testid={`section-stripe-orphans-${status}`}>
                  <CardHeader className={`${config.headerBg} rounded-t-lg py-3 px-4 flex flex-row items-center gap-2`}>
                    <SectionIcon className="h-4 w-4" />
                    <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
                    <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeClass}`}>
                      {groupRows.length} record{groupRows.length !== 1 ? "s" : ""}
                    </span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">ID</TableHead>
                            <TableHead>Customer ID</TableHead>
                            <TableHead>Subscription ID</TableHead>
                            <TableHead className="w-16 text-center">Retries</TableHead>
                            <TableHead>Last Error</TableHead>
                            <TableHead className="whitespace-nowrap">Created</TableHead>
                            {status !== "resolved" && <TableHead className="w-40">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupRows.map((row) => (
                            <TableRow key={row.id} data-testid={`row-stripe-orphan-${row.id}`}>
                              <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {row.stripeCustomerId ?? <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {row.stripeSubscriptionId ?? <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-sm text-center">{row.retryCount}</TableCell>
                              <TableCell
                                className="text-xs text-muted-foreground max-w-48 truncate"
                                title={row.lastError ?? undefined}
                              >
                                {row.lastError ?? <span className="italic">—</span>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(row.createdAt).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </TableCell>
                              {status !== "resolved" && (
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs h-7"
                                      disabled={isBusy}
                                      onClick={() => retryMutation.mutate(row.id)}
                                      data-testid={`button-retry-orphan-${row.id}`}
                                    >
                                      <RotateCcw className="mr-1 h-3 w-3" />
                                      Retry
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-green-300 text-green-700 hover:bg-green-50 text-xs h-7"
                                      disabled={isBusy}
                                      onClick={() => resolveMutation.mutate(row.id)}
                                      data-testid={`button-resolve-orphan-${row.id}`}
                                    >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Resolve
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
