import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Loader } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminPendingPage() {
  const { data: pendingAdmins, isLoading } = usePendingAdmins();
  const { mutate: approveAdmin, isPending: isApproving } = useApproveAdmin();
  const { toast } = useToast();

  const handleApprove = (id: number, name: string) => {
    approveAdmin(id, {
      onSuccess: () => {
        toast({
          title: "Admin Approved",
          description: `${name} has been approved and can now log in.`,
        });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Pending Admin Approvals</h1>
        <p className="text-muted-foreground mt-1">Review and approve new administrator accounts</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pendingAdmins?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">No pending approvals</p>
            <p className="text-muted-foreground">All admin accounts have been verified.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Admin Accounts ({pendingAdmins?.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdmins?.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.fullName}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {admin.username}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => handleApprove(admin.id, admin.fullName)}
                        disabled={isApproving}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApproving ? "Approving..." : "Approve"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}

function usePendingAdmins() {
  return useQuery({
    queryKey: [api.users.getPending.path],
    queryFn: async () => {
      const res = await fetch(api.users.getPending.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending admins");
      return api.users.getPending.responses[200].parse(await res.json());
    },
  });
}

function useApproveAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.users.approvePending.path, { id });
      const res = await fetch(url, {
        method: api.users.approvePending.method,
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to approve admin");
      return api.users.approvePending.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.getPending.path] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
