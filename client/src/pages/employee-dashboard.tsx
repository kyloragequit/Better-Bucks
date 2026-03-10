import { useState } from "react";
import { useUser } from "@/hooks/use-auth";
import { useUserDetails, useUpdateProfile } from "@/hooks/use-users";
import { useQuery } from "@tanstack/react-query";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Wallet, History, CreditCard, Mail, Store, Heart, ExternalLink, BookOpen, Target, Timer, Hash, Coins } from "lucide-react";
import type { StoreItem, Wishlist, Goal } from "@shared/schema";
import { Link } from "wouter";
import { Loader } from "@/components/ui/loader";
import { QRCodeSVG } from "qrcode.react";
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
      <div className="mb-8 animate-in flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome, {userDetails.fullName.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">Here is an overview of your rewards and activity.</p>
        </div>
        <button
          onClick={restartTutorial}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 mt-1 px-3 py-1.5 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5"
          data-testid="button-replay-tutorial"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Take the tour again
        </button>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Balance Card - Main Focus */}
        <Card className="md:col-span-2 shadow-lg border-primary/20 bg-gradient-to-br from-primary/10 via-white to-white overflow-hidden relative">
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
              Use your Bucks to redeem rewards or make purchases at authorized locations using your QR code.
            </p>
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <Card className="shadow-lg border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-foreground font-bold">
              <CreditCard className="h-5 w-5" /> Your ID
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-4 pb-8">
            <div className="bg-white p-4 rounded-lg border shadow-sm" data-testid="qr-code-container">
              <QRCodeSVG
                value={JSON.stringify({ id: userDetails.id, username: userDetails.username, barcode: userDetails.barcode })}
                size={140}
                level="M"
                fgColor="#162A4A"
              />
            </div>
            <p className="mt-4 text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {userDetails.username}
            </p>
          </CardContent>
        </Card>
      </div>

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
              <Link href="/store" className="text-xs text-primary underline">Go to Store</Link>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userDetails.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
              {userDetails.transactions
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10) // Show only last 10
                .map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground w-[200px]">
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
