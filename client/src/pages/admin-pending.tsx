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
  const { mutate: rejectAdmin, isPending: isRejecting } = useRejectAdmin();
  const { toast } = useToast();

  const handleApprove = (id: number, name: string) => {
    approveAdmin(id, {
      onSuccess: () => {
        toast({
          title: "Admin Verified",
          description: `${name} has been verified and can now log in.`,
        });
      }
    });
  };

  const handleReject = (id: number, name: string) => {
    rejectAdmin(id, {
      onSuccess: () => {
        toast({
          title: "Admin Rejected",
          description: `${name}'s request has been removed.`,
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
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button
                        onClick={() => handleReject(admin.id, admin.fullName)}
                        disabled={isRejecting || isApproving}
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                      >
                        {isRejecting ? "Rejecting..." : "Reject"}
                      </Button>
                      <Button
                        onClick={() => handleApprove(admin.id, admin.fullName)}
                        disabled={isApproving || isRejecting}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApproving ? "Verifying..." : "Verify"}
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
    queryKey: ["/api/users/pending-admins"],
    queryFn: async () => {
      const res = await fetch("/api/users/pending-admins", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending admins");
      return res.json();
    },
  });
}

function useApproveAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to verify admin");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending-admins"] });
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

function useRejectAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}/reject`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to reject admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending-admins"] });
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
