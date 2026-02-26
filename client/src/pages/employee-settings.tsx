import { useState } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { Lock, Mail, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function EmployeeSettingsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");

  const passwordMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/users/${user!.id}/profile`, {
        password: newPassword,
      });
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update password.", variant: "destructive" });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/users/${user!.id}/profile`, {
        email: email,
      });
    },
    onSuccess: () => {
      toast({ title: "Email updated", description: "Your email has been updated." });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update email.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/users/${user!.id}`);
    },
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete account.", variant: "destructive" });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    passwordMutation.mutate();
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({ title: "Invalid", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    emailMutation.mutate();
  };

  return (
    <EmployeeLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                type="submit"
                disabled={passwordMutation.isPending || !newPassword || !confirmPassword}
                className="w-full"
                data-testid="button-change-password"
              >
                {passwordMutation.isPending ? <SpinningLogo className="h-4 w-4 mr-2" /> : null}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" />
              {user?.email ? "Update Email" : "Add Email"}
            </CardTitle>
            <CardDescription>
              {user?.email
                ? `Current email: ${user.email}`
                : "Add an email address to your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  data-testid="input-email"
                />
              </div>
              <Button
                type="submit"
                disabled={emailMutation.isPending || !email}
                className="w-full"
                data-testid="button-update-email"
              >
                {emailMutation.isPending ? <SpinningLogo className="h-4 w-4 mr-2" /> : null}
                {user?.email ? "Update Email" : "Add Email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Account
            </CardTitle>
            <CardDescription>Permanently delete your account and all associated data</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" data-testid="button-delete-account">
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Your account, balance, and all transaction history will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-confirm-delete"
                  >
                    {deleteMutation.isPending ? <SpinningLogo className="h-4 w-4 mr-2" /> : null}
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}
