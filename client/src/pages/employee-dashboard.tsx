import { useState } from "react";
import { useUser } from "@/hooks/use-auth";
import { PasskeyFirstTimePrompt } from "@/components/passkey-manager";
import { TopRewardedLeaderboard } from "@/components/top-rewarded-leaderboard";
import { useUserDetails, useUpdateProfile } from "@/hooks/use-users";
import { useQuery } from "@tanstack/react-query";
import { EmployeeLayout } from "@/components/layout-employee";
import { WalletPassCard } from "@/components/wallet-pass-card";
import { MobileWalletPrompt } from "@/components/mobile-wallet-prompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Wallet, History, Mail, Store, Heart, ExternalLink, BookOpen, Target, Timer, Hash, Coins, Gift } from "lucide-react";
import type { StoreItem, Wishlist, Goal } from "@shared/schema";
import { Link } from "wouter";
import { Loader } from "@/components/ui/loader";
import { differenceInDays, differenceInMinutes, format, formatDistanceToNow } from "date-fns";
import { useTutorial } from "@/hooks/use-tutorial";

export default function EmployeeDashboard() {
  const { data: authUser } = useUser();
  const { data: userDetails, isLoading } = useUserDetails(authUser?.id || 0);
  const { restartTutorial } = useTutorial();
  const { data: shops } = useQuery<{ id: number; name: string; url: string; pointsPerDollar: number }[]>({
    queryKey: ["/api/shop-websites"],
    enabled: !!authUser,
  });
  const { data: wishlist } = useQuery<(Wishlist & { storeItem: StoreItem })[]>({
    queryKey: ["/api/wishlist"],
    enabled: !!authUser,
  });
  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
    enabled: !!authUser,
  });

  if (isLoading) return <EmployeeLayout><Loader /></EmployeeLayout>;
  if (!userDetails) return null;

  return (
    <EmployeeLayout>
      <MobileWalletPrompt />
      <div className="mb-8 animate-in flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome, {userDetails.fullName.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">Here is an overview of your rewards and activity.</p>
        </div>
        <button
          type="button"
          onClick={restartTutorial}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 mt-1 px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5"
          data-testid="button-replay-tutorial"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Take the tour again
        </button>
      </div>

      {authUser && <PasskeyFirstTimePrompt userId={authUser.id} />}

      <TopRewardedLeaderboard />

      {/* Active Goals */}
      {goals.filter(g => g.status === "active").length > 0 && (
        <Card className="shadow-md border-border/60 mb-8" data-testid="section-goals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Team Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {goals.filter(g => g.status === "active").map(goal => {
              const isTime = goal.type === "time";
              const isQty = goal.type === "quantity";
              const isHrMin = goal.durationUnit === "hours_minutes";
              const totalMins = isHrMin
                ? (goal.targetHours ?? 0) * 60 + (goal.targetMinutes ?? 0)
                : (goal.targetDays ?? 0) * 24 * 60;
              const elapsedMins = differenceInMinutes(new Date(), new Date(goal.startDate));
              const elapsedDays = differenceInDays(new Date(), new Date(goal.startDate));
              const formatMins = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; if (h === 0) return `${min}m`; if (min === 0) return `${h}h`; return `${h}h ${min}m`; };
              const progress = isQty && goal.targetQuantity
                ? Math.min(100, Math.round((goal.currentQuantity / goal.targetQuantity) * 100))
                : isTime && totalMins > 0
                ? Math.min(100, Math.round((elapsedMins / totalMins) * 100))
                : 0;
              const remainingDays = !isHrMin && isTime && goal.targetDays ? goal.targetDays - elapsedDays : null;
              const remainingMins = isHrMin && isTime && totalMins > 0 ? totalMins - elapsedMins : null;
              return (
                <div key={goal.id} data-testid={`goal-item-${goal.id}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {isTime ? <Timer className="h-4 w-4 text-primary shrink-0" /> : <Hash className="h-4 w-4 text-primary shrink-0" />}
                      <span>{goal.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Coins className="h-3 w-3" />
                      <span>{goal.bucksReward} bcks</span>
                    </div>
                  </div>
                  <Progress value={progress} className="h-2 mb-1.5" data-testid={`goal-progress-${goal.id}`} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    {isQty && goal.targetQuantity && (
                      <span>{goal.currentQuantity.toLocaleString()} / {goal.targetQuantity.toLocaleString()}</span>
                    )}
                    {isTime && !isHrMin && goal.targetDays && (
                      <span>{elapsedDays} of {goal.targetDays} days</span>
                    )}
                    {isTime && isHrMin && totalMins > 0 && (
                      <span>{formatMins(elapsedMins)} of {formatMins(totalMins)}</span>
                    )}
                    <span>
                      {isTime && remainingDays !== null && remainingDays > 0
                        ? `${remainingDays} days remaining`
                        : isTime && remainingMins !== null && remainingMins > 0
                        ? `${formatMins(remainingMins)} remaining`
                        : `${progress}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="mb-8">
        {/* Balance Card - Main Focus */}
        <Card className="shadow-lg border-primary/20 bg-gradient-to-br from-primary/10 via-white to-white overflow-hidden relative" data-testid="card-balance">
          <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-primary font-bold">
              <Wallet className="h-5 w-5" /> Your Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl md:text-6xl font-bold font-display text-foreground tracking-tight">
              {userDetails.balance.toLocaleString()}
              <span className="text-2xl text-muted-foreground ml-2 font-normal">bcks</span>
            </div>
            {shops && shops.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {shops.filter(s => s.pointsPerDollar > 0).map((shop) => (
                  <div key={shop.id} className="flex items-center gap-2 text-sm" data-testid={`text-shop-value-${shop.id}`}>
                    <Store className="h-3.5 w-3.5 text-secondary shrink-0" />
                    <span className="text-muted-foreground">{shop.name}:</span>
                    <span className="font-semibold text-secondary">
                      ${(userDetails.balance / shop.pointsPerDollar).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({shop.pointsPerDollar} bcks = $1)
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              Use your Bucks to redeem rewards or make purchases at authorized locations.
            </p>
            <p className="mt-2 text-xs font-mono text-muted-foreground bg-muted inline-block px-2 py-1 rounded" data-testid="text-employee-code">
              ID: {userDetails.username}
            </p>
          </CardContent>
        </Card>
      </div>

      <WalletPassCard />

      {/* Items I've been given */}
      {userDetails.customItems && userDetails.customItems.length > 0 && (
        <Card className="shadow-md border-border/60 mb-8" data-testid="section-my-items">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> My Items
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Items you've received from your team. Show these on your account when redeeming.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {userDetails.customItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-white p-4 flex flex-col items-center text-center"
                  data-testid={`my-item-${item.id}`}
                >
                  <Gift className="h-8 w-8 text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground" data-testid={`my-item-name-${item.id}`}>
                    {item.name}
                  </p>
                  <p className="text-2xl font-bold font-display text-primary mt-1" data-testid={`my-item-balance-${item.id}`}>
                    {item.balance.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email for Updates */}
      <EmailUpdateSection userId={userDetails.id} currentEmail={userDetails.email} />

      {/* Wishlist */}
      {wishlist && wishlist.length > 0 && (
        <Card className="shadow-md border-border/60 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" /> My Wishlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {wishlist.map((entry) => (
                <div key={entry.id} className="group rounded-lg border overflow-hidden" data-testid={`wishlist-item-${entry.storeItemId}`}>
                  <a href={entry.storeItem.url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={entry.storeItem.imageUrl}
                      alt={entry.storeItem.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/200x200?text=?"; }}
                    />
                  </a>
                  <div className="p-2">
                    <p className="text-xs font-semibold leading-snug line-clamp-2" data-testid={`wishlist-item-name-${entry.storeItemId}`}>{entry.storeItem.name}</p>
                    <p className="text-xs text-primary font-bold mt-0.5">{entry.storeItem.price.toLocaleString()} Bucks</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <Link href="/store" className="inline-flex items-center justify-end min-h-11 sm:min-h-0 px-2 -mr-2 text-xs text-primary underline" data-testid="link-go-to-store">Go to Store</Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card className="shadow-md border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {userDetails.transactions.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground px-4">
              No transactions yet.
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-2 px-4">
                {userDetails.transactions
                  .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 py-3 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{tx.reason}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(tx.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <span className={`font-bold tabular-nums text-sm shrink-0 ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
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
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userDetails.transactions
                      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 10)
                      .map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tx.reason}</span>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {tx.amount > 0 ? "Credit" : "Debit"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
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

function EmailUpdateSection({ userId, currentEmail }: { userId: number; currentEmail: string | null }) {
  const [email, setEmail] = useState(currentEmail || "");
  const [isEditing, setIsEditing] = useState(false);
  const { mutate: updateProfile, isPending } = useUpdateProfile();

  const handleSave = () => {
    updateProfile({ id: userId, email: email || undefined }, {
      onSuccess: () => setIsEditing(false),
    });
  };

  return (
    <Card className="shadow-md border-border/60 mb-8">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email for Updates
        </CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-email">
            {currentEmail ? "Change" : "Add Email"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid="input-employee-email"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending} data-testid="button-save-email">
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => { setIsEditing(false); setEmail(currentEmail || ""); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="text-current-email">
            {currentEmail ? (
              <>Notifications will be sent to <span className="font-medium text-foreground">{currentEmail}</span></>
            ) : (
              "No email set. Add an email to receive notifications when your balance changes."
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
