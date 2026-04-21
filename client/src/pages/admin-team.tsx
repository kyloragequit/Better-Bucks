import { useState } from "react";
import { Link } from "wouter";
import { useUsers } from "@/hooks/use-users";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, ChevronRight, UserMinus, BadgeDollarSign } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { SpinningLogo } from "@/components/spinning-logo";
import { useToast } from "@/hooks/use-toast";
import { useRoleLabels } from "@/hooks/use-role-labels";
import { useUser } from "@/hooks/use-auth";
import type { Department, TransactionCategory } from "@shared/schema";

export default function AdminTeamPage() {
  const { data: users, isLoading } = useUsers();
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getRoleLabel } = useRoleLabels();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkCreditOpen, setBulkCreditOpen] = useState(false);
  const [bulkCreditSelected, setBulkCreditSelected] = useState<Set<number>>(new Set());

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: categories } = useQuery<TransactionCategory[]>({
    queryKey: [`/api/organizations/${currentUser?.organizationId}/categories`],
    enabled: !!currentUser?.organizationId,
  });

  const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);

  const assignMgrMutation = useMutation({
    mutationFn: async ({ userId, managerId }: { userId: number; managerId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/manager`, { managerId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/manager-employee-counts"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const teamMembers = users?.filter(u => u.managerId === currentUser?.id);

  const filteredTeam = teamMembers?.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.username.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  function handleRemoveFromTeam(userId: number) {
    assignMgrMutation.mutate(
      { userId, managerId: null },
      {
        onSuccess: () => {
          toast({ title: "Removed from Team", description: "Employee has been removed from your team." });
        },
      }
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-team-title">My Team</h1>
          <p className="text-muted-foreground mt-1">
            Employees assigned to you ({teamMembers?.length ?? 0} members)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bulkCreditSelected.size > 0 && (
            <Button variant="default" onClick={() => setBulkCreditOpen(true)} data-testid="button-bulk-credit-team">
              <BadgeDollarSign className="mr-2 h-4 w-4" />
              Give Bucks ({bulkCreditSelected.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => setAddDialogOpen(true)} data-testid="button-add-to-team">
            <UserPlus className="mr-2 h-4 w-4" />
            Add to Team
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            className="pl-9 bg-muted/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-team"
          />
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : filteredTeam?.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-8 text-center text-muted-foreground" data-testid="text-team-empty">
          {teamMembers?.length === 0
            ? "No employees on your team yet. Click \"Add to Team\" to get started."
            : "No team members match your search."}
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {filteredTeam?.map((user) => (
              <div key={user.id} className="bg-card rounded-xl border shadow-sm p-4" data-testid={`card-team-member-${user.id}`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={bulkCreditSelected.has(user.id)}
                    onCheckedChange={() => {
                      setBulkCreditSelected(prev => {
                        const next = new Set(prev);
                        next.has(user.id) ? next.delete(user.id) : next.add(user.id);
                        return next;
                      });
                    }}
                    data-testid={`checkbox-team-select-mobile-${user.id}`}
                  />
                <Link href={`/admin/employees/${user.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 active:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{user.fullName}</p>
                        <Badge variant="outline" className="text-xs shrink-0">{getRoleLabel(user.role)}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{user.username}</span>
                        {user.departmentId && deptMap.get(user.departmentId) && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground truncate">{deptMap.get(user.departmentId)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary tabular-nums text-sm">{user.balance.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">bcks</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
                </div>
                <div className="mt-2 pt-2 border-t flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7"
                    onClick={() => handleRemoveFromTeam(user.id)}
                    disabled={assignMgrMutation.isPending}
                    data-testid={`button-remove-team-mobile-${user.id}`}
                  >
                    <UserMinus className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredTeam && filteredTeam.length > 0 && filteredTeam.every(u => bulkCreditSelected.has(u.id))}
                      onCheckedChange={(checked) => {
                        setBulkCreditSelected(prev => {
                          const next = new Set(prev);
                          filteredTeam?.forEach(u => checked ? next.add(u.id) : next.delete(u.id));
                          return next;
                        });
                      }}
                      data-testid="checkbox-team-select-all"
                    />
                  </TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam?.map((user) => (
                  <TableRow key={user.id} className="group hover:bg-muted/20 transition-colors" data-testid={`row-team-member-${user.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={bulkCreditSelected.has(user.id)}
                        onCheckedChange={() => {
                          setBulkCreditSelected(prev => {
                            const next = new Set(prev);
                            next.has(user.id) ? next.delete(user.id) : next.add(user.id);
                            return next;
                          });
                        }}
                        data-testid={`checkbox-team-select-${user.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {user.username}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getRoleLabel(user.role)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.departmentId ? deptMap.get(user.departmentId) || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary tabular-nums">
                      {user.balance.toLocaleString()} bcks
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.preventDefault(); handleRemoveFromTeam(user.id); }}
                          disabled={assignMgrMutation.isPending}
                          data-testid={`button-remove-team-${user.id}`}
                        >
                          <UserMinus className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                        <Link href={`/admin/employees/${user.id}`}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Details <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {currentUser && (
        <BulkCreditDialog
          open={bulkCreditOpen}
          onOpenChange={(v) => { if (!v) setBulkCreditOpen(false); }}
          selectedUserIds={Array.from(bulkCreditSelected)}
          users={teamMembers ?? []}
          categories={categories ?? []}
          currentUser={currentUser}
          onComplete={() => {
            setBulkCreditOpen(false);
            setBulkCreditSelected(new Set());
          }}
        />
      )}

      {currentUser && (
        <AddToTeamDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          users={users ?? []}
          currentUserId={currentUser.id}
          onAdd={async (userIds) => {
            const results = await Promise.allSettled(
              userIds.map(uid =>
                apiRequest("PATCH", `/api/users/${uid}/manager`, { managerId: currentUser.id }).then(r => r.json())
              )
            );
            const succeeded = results.filter(r => r.status === "fulfilled").length;
            const failed = results.filter(r => r.status === "rejected").length;
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/org/manager-employee-counts"] });
            if (failed === 0) {
              toast({ title: "Team Updated", description: `${succeeded} employee${succeeded > 1 ? "s" : ""} added to your team.` });
            } else {
              toast({ title: "Partial Update", description: `${succeeded} added, ${failed} failed.`, variant: "destructive" });
            }
            setAddDialogOpen(false);
          }}
        />
      )}
    </AdminLayout>
  );
}

function AddToTeamDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: { id: number; fullName: string; username: string; role: string; managerId: number | null; departmentId: number | null }[];
  currentUserId: number;
  onAdd: (userIds: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { getRoleLabel } = useRoleLabels();

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);

  const availableUsers = users.filter(u =>
    u.id !== currentUserId &&
    u.managerId !== currentUserId
  );

  const filteredAvailable = availableUsers.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  function handleToggle(userId: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    onAdd(Array.from(selected));
    setSelected(new Set());
    setSearch("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setSelected(new Set());
      setSearch("");
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-add-to-team">
        <DialogHeader>
          <DialogTitle>Add Members to Your Team</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-add-team"
          />
        </div>
        <ScrollArea className="h-[320px] border rounded-md">
          {filteredAvailable.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {availableUsers.length === 0
                ? "Everyone is already on your team."
                : "No matches found."}
            </div>
          ) : (
            <div className="divide-y">
              {filteredAvailable.map(user => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  data-testid={`option-add-team-${user.id}`}
                >
                  <Checkbox
                    checked={selected.has(user.id)}
                    onCheckedChange={() => handleToggle(user.id)}
                    data-testid={`checkbox-add-team-${user.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.fullName}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{user.username}</span>
                      {user.managerId && user.managerId !== currentUserId && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Has manager</Badge>
                      )}
                      {user.departmentId && deptMap.get(user.departmentId) && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground">{deptMap.get(user.departmentId)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-add-team">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selected.size === 0} data-testid="button-confirm-add-team">
            <UserPlus className="mr-2 h-4 w-4" />
            Add {selected.size > 0 ? `${selected.size} ` : ""}to Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkCreditDialog({
  open,
  onOpenChange,
  selectedUserIds,
  users,
  categories,
  currentUser,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: number[];
  users: { id: number; fullName: string }[];
  categories: TransactionCategory[];
  currentUser: { id: number; role: string; balance: number; organizationId: number | null };
  onComplete: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
  const parsedAmount = parseInt(amount) || 0;
  const totalCost = parsedAmount * selectedUsers.length;
  const isPrime = currentUser.role === "prime_admin";
  const hasCategory = categoryId && categoryId !== "none";

  const bulkCreditMutation = useMutation({
    mutationFn: async () => {
      const selectedCat = categories.find(c => String(c.id) === categoryId);
      const res = await apiRequest("POST", "/api/users/bulk-credit", {
        userIds: selectedUserIds,
        amount: parsedAmount,
        reason: selectedCat?.name ?? "Bulk credit",
        ...(hasCategory ? { categoryId: parseInt(categoryId) } : {}),
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Bucks Credited", description: `${parsedAmount.toLocaleString()} bucks given to ${data.credited} team member${data.credited > 1 ? "s" : ""}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setAmount("");
      setCategoryId("");
      onComplete();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  function handleSubmit() {
    if (parsedAmount <= 0) {
      toast({ title: "Invalid", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    if (!hasCategory) {
      toast({ title: "Missing Category", description: "Please select a category.", variant: "destructive" });
      return;
    }
    if (!isPrime && currentUser.balance < totalCost) {
      toast({ title: "Insufficient Balance", description: `You need ${totalCost.toLocaleString()} bucks but only have ${currentUser.balance.toLocaleString()}.`, variant: "destructive" });
      return;
    }
    bulkCreditMutation.mutate();
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setAmount("");
      setCategoryId("");
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-bulk-credit-team">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5" />
            Give Bucks to {selectedUsers.length} Team Member{selectedUsers.length > 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Selected employees:</p>
            <p className="text-muted-foreground">{selectedUsers.map(u => u.fullName).join(", ")}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-amount">Amount per person</Label>
            <Input
              id="bulk-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50"
              data-testid="input-bulk-credit-amount"
            />
            {parsedAmount > 0 && selectedUsers.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Total: {totalCost.toLocaleString()} bucks ({parsedAmount.toLocaleString()} × {selectedUsers.length})
              </p>
            )}
            {!isPrime && parsedAmount > 0 && (
              <p className={`text-xs ${totalCost > currentUser.balance ? "text-destructive" : "text-muted-foreground"}`}>
                Your balance: {currentUser.balance.toLocaleString()} bucks
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="bulk-category" data-testid="select-bulk-credit-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.length > 0 ? categories.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </span>
                  </SelectItem>
                )) : (
                  <SelectItem value="none" disabled>No categories set up</SelectItem>
                )}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">Ask your Organization Owner to set up categories in Settings.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-bulk-credit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bulkCreditMutation.isPending || parsedAmount <= 0}
            data-testid="button-confirm-bulk-credit"
          >
            {bulkCreditMutation.isPending ? (
              <SpinningLogo className="mr-2 h-4 w-4" />
            ) : (
              <BadgeDollarSign className="mr-2 h-4 w-4" />
            )}
            {bulkCreditMutation.isPending ? "Sending..." : `Give ${parsedAmount > 0 ? parsedAmount.toLocaleString() + " " : ""}Bucks`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
