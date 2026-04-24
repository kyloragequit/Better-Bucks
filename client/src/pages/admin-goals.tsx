import { useState } from "react";
import { usePublicDemo } from "@/hooks/use-demo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { useUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@/components/ui/loader";
import { Plus, Target, Timer, Hash, Trophy, XCircle, Coins, Pencil, Trash2, ChevronUp, CheckCircle } from "lucide-react";
import type { Goal } from "@shared/schema";
import { differenceInDays, differenceInMinutes, formatDistanceToNow } from "date-fns";

function goalTotalMinutes(goal: Goal): number {
  if (goal.durationUnit === "hours_minutes") {
    return (goal.targetHours ?? 0) * 60 + (goal.targetMinutes ?? 0);
  }
  return (goal.targetDays ?? 0) * 24 * 60;
}

function elapsedMinutes(goal: Goal): number {
  const end = goal.failedAt || goal.completedAt || goal.bucksDistributedAt || new Date();
  return differenceInMinutes(new Date(end), new Date(goal.startDate));
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function goalProgress(goal: Goal): number {
  if (goal.type === "quantity" && goal.targetQuantity) {
    return Math.min(100, Math.round((goal.currentQuantity / goal.targetQuantity) * 100));
  }
  if (goal.type === "time") {
    const total = goalTotalMinutes(goal);
    if (total === 0) return 0;
    return Math.min(100, Math.round((elapsedMinutes(goal) / total) * 100));
  }
  return 0;
}

function StatusBadge({ status }: { status: Goal["status"] }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    pending_distribution: { label: "Goal Met!", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

type GoalFormData = {
  title: string;
  type: "time" | "quantity";
  bucksReward: string;
  targetQuantity: string;
  targetDays: string;
  durationUnit: "days" | "hours_minutes";
  targetHours: string;
  targetMinutes: string;
  endDate: string;
};

const emptyForm: GoalFormData = { title: "", type: "quantity", bucksReward: "", targetQuantity: "", targetDays: "", durationUnit: "days", targetHours: "", targetMinutes: "", endDate: "" };

export default function AdminGoalsPage() {
  const isPublicDemo = usePublicDemo();
  const { data: user } = useUser();
  const isPrimeAdmin = user?.role === "prime_admin" || user?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalFormData>(emptyForm);
  const [incrementGoalId, setIncrementGoalId] = useState<number | null>(null);
  const [incrementAmount, setIncrementAmount] = useState("1");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["/api/admin/goals"],
    enabled: !!user,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/goals"] });

  const createMutation = useMutation({
    mutationFn: (data: GoalFormData) => apiRequest("POST", "/api/admin/goals", data),
    onSuccess: () => { invalidate(); setShowCreate(false); setForm(emptyForm); toast({ title: "Goal created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: { id: number; payload: Partial<GoalFormData> }) => apiRequest("PATCH", `/api/admin/goals/${data.id}`, data.payload),
    onSuccess: () => { invalidate(); setEditGoal(null); setForm(emptyForm); toast({ title: "Goal updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/goals/${id}`),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); toast({ title: "Goal deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const incrementMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => apiRequest("POST", `/api/admin/goals/${id}/increment`, { amount }),
    onSuccess: () => { invalidate(); setIncrementGoalId(null); setIncrementAmount("1"); toast({ title: "Progress added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const failMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/goals/${id}/fail`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Goal marked as failed", description: "Employees will be notified on next login." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/goals/${id}/complete`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Goal marked as complete — ready to distribute Bucks!" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const distributeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/goals/${id}/distribute`, {}),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Bucks distributed!", description: "All employees have received their reward." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openCreate() { setForm(emptyForm); setShowCreate(true); }
  function openEdit(g: Goal) {
    setEditGoal(g);
    setForm({
      title: g.title,
      type: g.type,
      bucksReward: String(g.bucksReward),
      targetQuantity: g.targetQuantity ? String(g.targetQuantity) : "",
      targetDays: g.targetDays ? String(g.targetDays) : "",
      durationUnit: (g.durationUnit ?? "days") as "days" | "hours_minutes",
      targetHours: g.targetHours ? String(g.targetHours) : "",
      targetMinutes: g.targetMinutes ? String(g.targetMinutes) : "",
      endDate: g.endDate ? new Date(g.endDate).toISOString().split("T")[0] : "",
    });
  }

  const activeGoals = goals.filter(g => g.status === "active");
  const pendingGoals = goals.filter(g => g.status === "pending_distribution");
  const completedGoals = goals.filter(g => g.status === "completed");
  const failedGoals = goals.filter(g => g.status === "failed");

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Goals</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isPrimeAdmin
                ? "Create and manage team goals that appear on every employee's dashboard."
                : "Track team goals and add progress to quantity-based goals."}
            </p>
          </div>
        </div>

        {isLoading && <Loader />}

        {/* Pending Distribution — needs action */}
        {pendingGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-green-700 flex items-center gap-2"><Trophy className="h-5 w-5" />Goal Met — Distribute Bucks</h2>
            {pendingGoals.map(g => <GoalCard key={g.id} goal={g} isPrimeAdmin={isPrimeAdmin} onEdit={openEdit} onDelete={setDeleteConfirm} onIncrement={setIncrementGoalId} onFail={id => failMutation.mutate(id)} onComplete={id => completeMutation.mutate(id)} onDistribute={id => distributeMutation.mutate(id)} distributing={distributeMutation.isPending} />)}
          </div>
        )}

        {/* Active */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Active Goals</h2>
          {activeGoals.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {isPrimeAdmin ? "No active goals. Create one above." : "No active goals have been set by the Organization Owner yet."}
            </p>
          )}
          {activeGoals.map(g => <GoalCard key={g.id} goal={g} isPrimeAdmin={isPrimeAdmin} onEdit={openEdit} onDelete={setDeleteConfirm} onIncrement={setIncrementGoalId} onFail={id => failMutation.mutate(id)} onComplete={id => completeMutation.mutate(id)} onDistribute={id => distributeMutation.mutate(id)} distributing={distributeMutation.isPending} />)}
          {isPrimeAdmin && (
            <div className="pt-2">
              <Button onClick={openCreate} data-testid="button-create-goal"><Plus className="mr-2 h-4 w-4" />New Goal</Button>
            </div>
          )}
        </div>

        {/* Completed */}
        {completedGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2"><CheckCircle className="h-5 w-5" />Completed</h2>
            {completedGoals.map(g => <GoalCard key={g.id} goal={g} isPrimeAdmin={isPrimeAdmin} onEdit={openEdit} onDelete={setDeleteConfirm} onIncrement={setIncrementGoalId} onFail={id => failMutation.mutate(id)} onComplete={id => completeMutation.mutate(id)} onDistribute={id => distributeMutation.mutate(id)} distributing={distributeMutation.isPending} />)}
          </div>
        )}

        {/* Failed */}
        {failedGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-destructive flex items-center gap-2"><XCircle className="h-5 w-5" />Failed</h2>
            {failedGoals.map(g => <GoalCard key={g.id} goal={g} isPrimeAdmin={isPrimeAdmin} onEdit={openEdit} onDelete={setDeleteConfirm} onIncrement={setIncrementGoalId} onFail={id => failMutation.mutate(id)} onComplete={id => completeMutation.mutate(id)} onDistribute={id => distributeMutation.mutate(id)} distributing={distributeMutation.isPending} />)}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || !!editGoal} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditGoal(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Days Without an Incident" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-goal-title" />
            </div>
            {!editGoal && (
              <div className="space-y-1.5">
                <Label>Goal Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "time" | "quantity" }))} >
                  <SelectTrigger data-testid="select-goal-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time"><span className="flex items-center gap-2"><Timer className="h-4 w-4" />Time — timer-based goal</span></SelectItem>
                    <SelectItem value="quantity"><span className="flex items-center gap-2"><Hash className="h-4 w-4" />Quantity — reach a target count</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Bucks Reward (per employee)</Label>
              <Input type="number" inputMode="numeric" min="1" placeholder="e.g. 500" value={form.bucksReward} onChange={e => setForm(f => ({ ...f, bucksReward: e.target.value }))} data-testid="input-goal-bucks" />
            </div>
            {form.type === "quantity" && (
              <div className="space-y-1.5">
                <Label>Target Quantity</Label>
                <Input type="number" inputMode="numeric" min="1" placeholder="e.g. 100" value={form.targetQuantity} onChange={e => setForm(f => ({ ...f, targetQuantity: e.target.value }))} data-testid="input-goal-target-qty" />
              </div>
            )}
            {form.type === "time" && (
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${form.durationUnit === "days" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setForm(f => ({ ...f, durationUnit: "days" }))}
                    data-testid="button-unit-days"
                  >
                    Days
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${form.durationUnit === "hours_minutes" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setForm(f => ({ ...f, durationUnit: "hours_minutes" }))}
                    data-testid="button-unit-hours"
                  >
                    Hours &amp; Minutes
                  </button>
                </div>
                {form.durationUnit === "days" ? (
                  <Input type="number" inputMode="numeric" min="1" placeholder="e.g. 30" value={form.targetDays} onChange={e => setForm(f => ({ ...f, targetDays: e.target.value }))} data-testid="input-goal-target-days" />
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Hours</Label>
                      <Input type="number" inputMode="numeric" min="0" placeholder="0" value={form.targetHours} onChange={e => setForm(f => ({ ...f, targetHours: e.target.value }))} data-testid="input-goal-target-hours" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Minutes</Label>
                      <Input type="number" inputMode="numeric" min="0" max="59" placeholder="0" value={form.targetMinutes} onChange={e => setForm(f => ({ ...f, targetMinutes: e.target.value }))} data-testid="input-goal-target-minutes" />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>End Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} data-testid="input-goal-end-date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditGoal(null); }}>Cancel</Button>
            <Button
              disabled={createMutation.isPending || editMutation.isPending}
              onClick={() => {
                if (editGoal) {
                  editMutation.mutate({ id: editGoal.id, payload: form });
                } else {
                  createMutation.mutate(form);
                }
              }}
              data-testid="button-save-goal"
            >
              {(createMutation.isPending || editMutation.isPending) ? "Saving..." : "Save Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Increment Dialog */}
      <Dialog open={incrementGoalId !== null} onOpenChange={open => { if (!open) setIncrementGoalId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Progress</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Amount to add</Label>
            <Input type="number" inputMode="numeric" min="1" value={incrementAmount} onChange={e => setIncrementAmount(e.target.value)} data-testid="input-increment-amount" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncrementGoalId(null)}>Cancel</Button>
            <Button disabled={incrementMutation.isPending} onClick={() => { if (incrementGoalId) incrementMutation.mutate({ id: incrementGoalId, amount: parseInt(incrementAmount) || 1 }); }} data-testid="button-confirm-increment">
              {incrementMutation.isPending ? "Adding..." : "Add Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={open => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Goal?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This will permanently delete the goal and all related notifications.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (deleteConfirm) deleteMutation.mutate(deleteConfirm); }} data-testid="button-confirm-delete-goal">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

interface GoalCardProps {
  goal: Goal;
  isPrimeAdmin: boolean;
  onEdit: (g: Goal) => void;
  onDelete: (id: number) => void;
  onIncrement: (id: number) => void;
  onFail: (id: number) => void;
  onComplete: (id: number) => void;
  onDistribute: (id: number) => void;
  distributing: boolean;
}

function GoalCard({ goal, isPrimeAdmin, onEdit, onDelete, onIncrement, onFail, onComplete, onDistribute, distributing }: GoalCardProps) {
  const isPublicDemo = usePublicDemo();
  const progress = goalProgress(goal);
  const isActive = goal.status === "active";
  const isPending = goal.status === "pending_distribution";
  const isFailed = goal.status === "failed";
  const isCompleted = goal.status === "completed";

  return (
    <Card className={isPending ? "border-green-400 shadow-green-100 shadow-md" : isFailed ? "border-destructive/30 bg-destructive/5" : ""} data-testid={`card-goal-${goal.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {goal.type === "time" ? <Timer className="h-4 w-4 text-primary shrink-0" /> : <Hash className="h-4 w-4 text-primary shrink-0" />}
            <span className="font-semibold truncate">{goal.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={goal.status} />
            {isPrimeAdmin && isActive && !isPublicDemo && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(goal)} data-testid={`button-edit-goal-${goal.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(goal.id)} data-testid={`button-delete-goal-${goal.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
            {isPrimeAdmin && !isActive && !isPublicDemo && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(goal.id)} data-testid={`button-delete-goal-${goal.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {goal.type === "quantity" && goal.targetQuantity && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{goal.currentQuantity.toLocaleString()} / {goal.targetQuantity.toLocaleString()}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" data-testid={`progress-goal-${goal.id}`} />
            </>
          )}
          {goal.type === "time" && goalTotalMinutes(goal) > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                {goal.durationUnit === "hours_minutes" ? (
                  <span>{formatMins(elapsedMinutes(goal))} / {formatMins(goalTotalMinutes(goal))} {isFailed ? "(stopped)" : ""}</span>
                ) : (
                  <span>{differenceInDays(new Date(goal.failedAt || goal.completedAt || goal.bucksDistributedAt || new Date()), new Date(goal.startDate))} / {goal.targetDays} days {isFailed ? "(stopped)" : ""}</span>
                )}
                <span>{progress}%</span>
              </div>
              <Progress value={isFailed ? progress : Math.min(100, progress)} className="h-2" data-testid={`progress-goal-${goal.id}`} />
            </>
          )}

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{goal.bucksReward} bcks per employee</span>
            <span>Started {formatDistanceToNow(new Date(goal.startDate))} ago</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {!isPublicDemo && isActive && goal.type === "quantity" && (
            <Button size="sm" variant="outline" onClick={() => onIncrement(goal.id)} data-testid={`button-add-progress-${goal.id}`}>
              <ChevronUp className="mr-1.5 h-3.5 w-3.5" />Add Progress
            </Button>
          )}
          {!isPublicDemo && isPrimeAdmin && isActive && goal.type === "time" && (
            <>
              <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => onComplete(goal.id)} data-testid={`button-complete-goal-${goal.id}`}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Mark Goal Met
              </Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => onFail(goal.id)} data-testid={`button-fail-goal-${goal.id}`}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Stop Timer (Goal Failed)
              </Button>
            </>
          )}
          {!isPublicDemo && isPrimeAdmin && (isPending || (isCompleted && !goal.bucksDistributedAt)) && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={distributing} onClick={() => onDistribute(goal.id)} data-testid={`button-distribute-${goal.id}`}>
              <Coins className="mr-1.5 h-3.5 w-3.5" />{distributing ? "Distributing..." : `Distribute ${goal.bucksReward} bcks to All Employees`}
            </Button>
          )}
          {isCompleted && goal.bucksDistributedAt && (
            <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Bucks distributed {formatDistanceToNow(new Date(goal.bucksDistributedAt))} ago</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
