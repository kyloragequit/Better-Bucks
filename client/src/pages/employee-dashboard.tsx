import { useUser } from "@/hooks/use-auth";
import { useUserDetails } from "@/hooks/use-users";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, History, CreditCard } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import Barcode from "react-barcode";
import { format } from "date-fns";

export default function EmployeeDashboard() {
  const { data: authUser } = useUser();
  // Fetch full details including transactions
  const { data: userDetails, isLoading } = useUserDetails(authUser?.id || 0);

  if (isLoading) return <EmployeeLayout><Loader /></EmployeeLayout>;
  if (!userDetails) return null;

  return (
    <EmployeeLayout>
      <div className="mb-8 animate-in">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Welcome, {userDetails.fullName.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">Here is an overview of your rewards and activity.</p>
      </div>

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
              <span className="text-2xl text-muted-foreground ml-2 font-normal">pts</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-md">
              Use your points to redeem rewards or make purchases at authorized locations using your barcode.
            </p>
          </CardContent>
        </Card>

        {/* Barcode Card */}
        <Card className="shadow-lg border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-foreground font-bold">
              <CreditCard className="h-5 w-5" /> Your ID
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-4 pb-8">
            <div className="bg-white p-3 rounded-lg border shadow-sm">
              <Barcode value={userDetails.barcode} width={1.8} height={70} fontSize={16} />
            </div>
            <p className="mt-4 text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {userDetails.username}
            </p>
          </CardContent>
        </Card>
      </div>

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
