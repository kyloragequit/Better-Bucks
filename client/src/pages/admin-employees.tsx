import { useState } from "react";
import { Link } from "wouter";
import { useUsers, useCreateUser } from "@/hooks/use-users";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, UserPlus, ChevronRight } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import type { InsertUser } from "@shared/schema";

export default function AdminEmployeesPage() {
  const { data: users, isLoading } = useUsers();
  const [search, setSearch] = useState("");

  const filteredUsers = users?.filter(user => 
    user.fullName.toLowerCase().includes(search.toLowerCase()) ||
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage employee accounts and balances</p>
        </div>
        <CreateEmployeeDialog />
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or code..." 
            className="pl-9 max-w-md bg-muted/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              )}
              {filteredUsers?.map((user) => (
                <TableRow key={user.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {user.username}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{user.role}</TableCell>
                  <TableCell className="text-right font-bold text-primary tabular-nums">
                    {user.balance.toLocaleString()} pts
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/employees/${user.id}`}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Details <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}

function CreateEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const { mutate: createUser, isPending } = useCreateUser();
  const [formData, setFormData] = useState<InsertUser>({
    fullName: "",
    username: "",
    password: "",
    role: "employee",
    barcode: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default barcode to username if empty
    const payload = { ...formData, barcode: formData.barcode || formData.username };
    createUser(payload, {
      onSuccess: () => {
        setOpen(false);
        setFormData({ fullName: "", username: "", password: "", role: "employee", barcode: "" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20">
          <UserPlus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Create a new employee account. They will use the code to login.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              required
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Employee Code (Username)</Label>
            <Input 
              id="code" 
              required
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="barcode">Barcode (Optional)</Label>
            <Input 
              id="barcode" 
              placeholder="Defaults to Employee Code"
              value={formData.barcode}
              onChange={(e) => setFormData({...formData, barcode: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(val: "admin" | "employee") => setFormData({...formData, role: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
