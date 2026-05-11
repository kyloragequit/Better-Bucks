import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogOut, RefreshCw, ArrowLeft, History } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { FullPageLoader } from "@/components/ui/loader";

type MerchantMe = { id: number; email: string; name: string; orgId: number; mustChangePassword: boolean };
type MerchantTx = { id: number; bucksAmount: number; createdAt: string; employee?: { id: number; fullName: string; email: string } | null };

export default function MerchantOrdersPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: me, isLoading } = useQuery<MerchantMe>({ queryKey: ["/api/merchant/me"], retry: false });

  useEffect(() => {
    if (!isLoading && !me) setLocation("/merchant/login");
    if (!isLoading && me?.mustChangePassword) setLocation("/merchant/change-password");
  }, [isLoading, me, setLocation]);

  const { data: txs = [], isFetching } = useQuery<MerchantTx[]>({
    queryKey: ["/api/merchant/transactions"],
    enabled: !!me,
  });

  const logoutMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/merchant/logout", {}),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/merchant/me"] });
      setLocation("/merchant/login");
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;

    return txs.filter((t) => {
      const name = (t.employee?.fullName ?? "").toLowerCase();
      const email = (t.employee?.email ?? "").toLowerCase();
      if (q && !name.includes(q) && !email.includes(q)) return false;
      const created = new Date(t.createdAt);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }, [txs, search, dateFrom, dateTo]);

  const totalBucks = useMemo(() => filtered.reduce((s, t) => s + t.bucksAmount, 0), [filtered]);

  if (isLoading) return <FullPageLoader />;
  if (!me) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-primary text-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 shrink-0 -ml-2"
              aria-label="Back to scanner"
              onClick={() => setLocation("/merchant/scanner")}
              data-testid="button-back-to-scanner"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="text-xs text-white/60">Merchant</div>
              <div className="font-semibold truncate" title={me.name} data-testid="text-merchant-name">{me.name}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 shrink-0"
            onClick={() => logoutMut.mutate()}
            data-testid="button-merchant-logout"
          >
            <LogOut className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">Out</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-5">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-semibold">Order history</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="search-member">Search member</Label>
              <Input
                id="search-member"
                inputMode="search"
                type="search"
                placeholder="Name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-member"
              />
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium leading-none mb-2">Date range</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date-from">From</Label>
                  <Input
                    id="date-from"
                    type="date"
                    inputMode="none"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    data-testid="input-date-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date-to">To</Label>
                  <Input
                    id="date-to"
                    type="date"
                    inputMode="none"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    data-testid="input-date-to"
                  />
                </div>
              </div>
            </fieldset>

            {(search || dateFrom || dateTo) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">
                {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}
              </CardTitle>
              {filtered.length > 0 && (
                <CardDescription>{totalBucks.toLocaleString()} Bucks redeemed</CardDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh transactions"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/merchant/transactions"] })}
              disabled={isFetching}
              data-testid="button-refresh-tx"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-transactions">
                {txs.length === 0 ? "No redemptions yet." : "No transactions match your filters."}
              </div>
            ) : (
              <ul className="divide-y" data-testid="list-transactions">
                {filtered.map((t) => (
                  <li key={t.id} className="py-3 flex items-start justify-between gap-3" data-testid={`row-tx-${t.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate" title={t.employee?.fullName || `Member #${t.employee?.id ?? "?"}`}>
                        {t.employee?.fullName || `Member #${t.employee?.id ?? "?"}`}
                      </div>
                      {t.employee?.email && (
                        <div className="text-xs text-muted-foreground truncate" title={t.employee.email}>
                          {t.employee.email}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {new Date(t.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="font-semibold tabular-nums whitespace-nowrap shrink-0 text-sm pt-0.5">
                      −{t.bucksAmount.toLocaleString()} Bucks
                    </div>
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
