import { useQuery } from "@tanstack/react-query";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader } from "@/components/ui/loader";
import { Store, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

type Redemption = {
  id: number;
  bucksAmount: number;
  createdAt: string;
  merchant: { id: number; name: string } | null;
};

export default function EmployeeRedemptionsPage() {
  const { data: redemptions, isLoading } = useQuery<Redemption[]>({
    queryKey: ["/api/wallet/redemptions"],
  });

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
          Every time a merchant scans your wallet pass, the redemption appears here.
        </p>
      </div>

      <Card className="shadow-md border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> All merchant redemptions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="py-8"><Loader /></div>
          ) : !redemptions || redemptions.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground px-4" data-testid="text-no-redemptions">
              No in-store purchases yet.
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-2 px-4">
                {redemptions.map((r) => (
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
                    </div>
                    <span className="font-bold tabular-nums text-sm shrink-0 text-red-600" data-testid={`text-amount-${r.id}`}>
                      -{r.bucksAmount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((r) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </EmployeeLayout>
  );
}
