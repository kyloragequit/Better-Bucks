import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader } from "@/components/ui/loader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, LinkIcon, Power, PowerOff, Plus } from "lucide-react";

type InviteLink = {
  id: number;
  token: string;
  organizationId: number;
  createdByUserId: number;
  roleToAssign: "employee" | "admin";
  expiresAt: string;
  isActive: boolean;
  signupCount: number;
  createdAt: string;
};

function buildJoinUrl(token: string) {
  return `${window.location.origin}/join/${token}`;
}

export default function AdminInviteLinksPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const isPrime = user?.role === "prime_admin";

  const [roleToAssign, setRoleToAssign] = useState<"employee" | "admin">("employee");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);

  const { data: links = [], isLoading } = useQuery<InviteLink[]>({
    queryKey: ["/api/invite-links"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invite-links", { roleToAssign, expiresInDays });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create invite link.");
      }
      return res.json();
    },
    onSuccess: (link: InviteLink) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invite-links"] });
      navigator.clipboard.writeText(buildJoinUrl(link.token)).catch(() => {});
      toast({ title: "Invite link created", description: "Link copied to your clipboard." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/invite-links/${id}`, { isActive });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update invite link.");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/invite-links"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copy = (token: string) => {
    const url = buildJoinUrl(token);
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Copied", description: "Invite link copied to clipboard." }),
      () => toast({ title: "Copy failed", description: url, variant: "destructive" }),
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Reusable Invite Links</h1>
          <p className="text-muted-foreground mt-1">
            Create a single link your whole team can use to join. Anyone with the link can sign up until it expires or is deactivated.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Create new invite link</CardTitle>
            <CardDescription>
              {isPrime
                ? "As an organization admin you can grant either Manager or Employee access."
                : "Managers can create links that grant Employee access."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="grid gap-2">
              <Label>Role granted</Label>
              <Select value={roleToAssign} onValueChange={(v) => setRoleToAssign(v as any)} disabled={!isPrime}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  {isPrime ? <SelectItem value="admin">Manager</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expires">Expires in (days)</Label>
              <Input
                id="expires"
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value || "30"))}
                data-testid="input-expires-days"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-[#4E9F3D] hover:bg-[#3F8531] text-white"
              data-testid="button-create-link"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Creating..." : "Create link"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your invite links</CardTitle>
            <CardDescription>Share these URLs with new team members.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader />
            ) : links.length === 0 ? (
              <p className="text-muted-foreground text-sm" data-testid="text-empty">No invite links yet. Create one above.</p>
            ) : (
              <div className="space-y-3">
                {links.map((l) => {
                  const url = buildJoinUrl(l.token);
                  const expired = new Date(l.expiresAt) < new Date();
                  const status = !l.isActive ? "Deactivated" : expired ? "Expired" : "Active";
                  const statusVariant: "default" | "secondary" | "destructive" =
                    status === "Active" ? "default" : status === "Expired" ? "secondary" : "destructive";
                  return (
                    <div
                      key={l.id}
                      className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                      data-testid={`row-link-${l.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={statusVariant} data-testid={`status-link-${l.id}`}>{status}</Badge>
                          <Badge variant="outline">{l.roleToAssign === "admin" ? "Manager" : "Employee"}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {l.signupCount} signup{l.signupCount === 1 ? "" : "s"} · expires {new Date(l.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                        <code className="text-xs sm:text-sm break-all bg-muted px-2 py-1 rounded inline-block max-w-full" data-testid={`text-url-${l.id}`}>
                          {url}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => copy(l.token)} data-testid={`button-copy-${l.id}`}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                        {l.isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleMutation.mutate({ id: l.id, isActive: false })}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-deactivate-${l.id}`}
                          >
                            <PowerOff className="h-4 w-4 mr-1" /> Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleMutation.mutate({ id: l.id, isActive: true })}
                            disabled={toggleMutation.isPending || expired}
                            data-testid={`button-activate-${l.id}`}
                          >
                            <Power className="h-4 w-4 mr-1" /> Activate
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
