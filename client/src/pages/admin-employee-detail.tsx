import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useUserDetails, useUpdateBalance, useUpdateRole } from "@/hooks/use-users";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Wallet, TrendingUp, TrendingDown, History, Shield } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import Barcode from "react-barcode";
import { format } from "date-fns";

export default function AdminEmployeeDetailPage() {
  const [, params] = useRoute("/admin/employees/:id");
  const id = params ? parseInt(params.id) : 0;
  const { data: user, isLoading, error } = useUserDetails(id);

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;
  if (error || !user) return <AdminLayout><div className="p-8 text-center text-destructive">User not found</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link href="/admin/employees" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Employees
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-display font-bold">{user.fullName}</h1>
          <Badge variant={user.role === 'admin' ? "default" : "secondary"} className="capitalize">
            {user.role}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Barcode Card */}
        <Card className="md:col-span-1 shadow-md border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg">Employee ID</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-2 pb-6">
             <div className="overflow-hidden rounded bg-white p-2 border">
               <Barcode value={user.barcode} width={1.5} height={60} fontSize={14} />
             </div>
             <p className="mt-4 text-sm text-muted-foreground font-mono">Code: {user.username}</p>
          </CardContent>
        </Card>

        {/* Balance Card */}
        <Card className="md:col-span-2 shadow-md bg-gradient-to-br from-white to-primary/5 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Current Balance</CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display text-primary mb-4">
              {user.balance.toLocaleString()} pts
            </div>
            <div className="flex gap-2">
              <AdjustBalanceDialog userId={user.id} currentBalance={user.balance} />
              <ChangeRoleDialog userId={user.id} currentRole={user.role} fullName={user.fullName} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">Transaction History</h2>
        </div>
        
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
              {user.transactions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    {tx.amount > 0 ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Credit</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Debit</Badge>
                    )}
                  </TableCell>
                  <TableCell>{tx.reason}</TableCell>
                  <TableCell className={`text-right font-medium ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

function AdjustBalanceDialog({ userId, currentBalance }: { userId: number; currentBalance: number }) {
  const [open, setOpen] = useState(false);
  const { mutate: updateBalance, isPending } = useUpdateBalance();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    
    const finalAmount = type === "credit" ? numAmount : -numAmount;

    updateBalance({ id: userId, amount: finalAmount, reason }, {
      onSuccess: () => {
        setOpen(false);
        setAmount("");
        setReason("");
        setType("credit");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Adjust Balance</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Employee Balance</DialogTitle>
          <DialogDescription>
            Add or remove points from this employee's account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Button 
              type="button" 
              variant={type === "credit" ? "default" : "outline"}
              className={type === "credit" ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={() => setType("credit")}
            >
              <TrendingUp className="mr-2 h-4 w-4" /> Credit (Add)
            </Button>
            <Button 
              type="button"
              variant={type === "debit" ? "destructive" : "outline"}
              onClick={() => setType("debit")}
            >
              <TrendingDown className="mr-2 h-4 w-4" /> Debit (Remove)
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input 
              id="amount" 
              type="number" 
              min="1"
              required
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)} 
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Input 
              id="reason" 
              required
              placeholder={type === "credit" ? "Performance Bonus" : "Cafeteria Purchase"}
              value={reason}
              onChange={(e) => setReason(e.target.value)} 
            />
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating..." : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleDialog({ userId, currentRole, fullName }: { userId: number; currentRole: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const { mutate: updateRole, isPending } = useUpdateRole();
  const newRole = currentRole === "admin" ? "employee" : "admin";

  const handleSubmit = () => {
    updateRole({ id: userId, role: newRole as "admin" | "employee" }, {
      onSuccess: () => {
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Shield className="mr-2 h-4 w-4" />Change Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Change {fullName}'s role from {currentRole} to {newRole}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            This action will change the user's access level and permissions.
          </p>
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium">Current Role: <span className="capitalize">{currentRole}</span></p>
            <p className="text-sm font-medium">New Role: <span className="capitalize text-primary">{newRole}</span></p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Updating..." : "Confirm Role Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
