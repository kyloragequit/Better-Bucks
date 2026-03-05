import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DemoUser = { id: number; fullName: string; username: string; role: string };
type DemoStatus = {
  inDemo: boolean;
  originalUserId: number | null;
  originalUser?: { id: number; fullName: string; role: string };
  currentUserId?: number;
  users: DemoUser[];
};

function roleLabel(role: string) {
  if (role === "prime_admin") return "Organization Owner";
  if (role === "admin") return "Administrator";
  if (role === "employee") return "Employee";
  return role;
}

export function DemoBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: demo } = useQuery<DemoStatus>({
    queryKey: ["/api/demo/status"],
    refetchInterval: 0,
  });

  const switchMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/demo/switch/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Switch failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo/status"] });
      if (user.role === "employee") {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/admin/dashboard";
      }
    },
    onError: (e: Error) => {
      toast({ title: "Switch failed", description: e.message, variant: "destructive" });
    },
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/demo/exit", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Exit failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo/status"] });
      window.location.href = "/admin/dashboard";
    },
    onError: (e: Error) => {
      toast({ title: "Exit failed", description: e.message, variant: "destructive" });
    },
  });

  if (!demo?.inDemo) return null;

  const allUsers: DemoUser[] = [
    ...(demo.originalUser
      ? [{ id: demo.originalUser.id, fullName: `${demo.originalUser.fullName} (you)`, username: "", role: demo.originalUser.role }]
      : []),
    ...demo.users,
  ];

  const admins = allUsers.filter(u => u.role === "prime_admin" || u.role === "admin");
  const employees = allUsers.filter(u => u.role === "employee");
  const currentId = String(demo.currentUserId ?? "");

  return (
    <div
      className="w-full px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm"
      style={{ background: "#4E9F3D" }}
      data-testid="div-demo-banner"
    >
      <Eye className="h-4 w-4 text-white shrink-0" />
      <span className="text-white font-medium whitespace-nowrap">Demo Mode</span>
      <span className="text-white/80 whitespace-nowrap hidden sm:inline">— viewing as:</span>

      <Select
        value={currentId}
        onValueChange={(val) => switchMutation.mutate(Number(val))}
        disabled={switchMutation.isPending || exitMutation.isPending}
      >
        <SelectTrigger
          className="h-7 w-52 bg-white/15 border-white/30 text-white text-xs"
          data-testid="select-demo-user"
        >
          <SelectValue placeholder="Select account…" />
        </SelectTrigger>
        <SelectContent>
          {admins.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Admins</SelectLabel>
              {admins.map(u => (
                <SelectItem key={u.id} value={String(u.id)} data-testid={`option-demo-user-${u.id}`}>
                  {u.fullName}
                  <span className="ml-1 text-muted-foreground text-xs">· {roleLabel(u.role)}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {employees.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Employees</SelectLabel>
              {employees.map(u => (
                <SelectItem key={u.id} value={String(u.id)} data-testid={`option-demo-user-${u.id}`}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        className="h-7 border-white/40 bg-white/10 text-white hover:bg-white hover:text-green-700 text-xs font-semibold shrink-0"
        onClick={() => exitMutation.mutate()}
        disabled={exitMutation.isPending || switchMutation.isPending}
        data-testid="button-demo-exit"
      >
        <LogOut className="mr-1 h-3 w-3" />
        {exitMutation.isPending ? "Exiting…" : "Exit Demo"}
      </Button>
    </div>
  );
}
