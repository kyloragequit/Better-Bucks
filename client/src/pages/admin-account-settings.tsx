import { useState } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { Lock, Mail, Trash2, KeyRound, User, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { PasskeyManager } from "@/components/passkey-manager";
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

export default function AdminAccountSettingsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: devStatus } = useQuery<{ impersonating: boolean }>({
    queryKey: ["/api/developer/status"],
  });
  const isImpersonating = devStatus?.impersonating === true;

  const { data: savedPassword, isLoading: passwordLoading } = useQuery<{ password: string | null }>({
    queryKey: ["/api/user/my-password"],
    enabled: !isImpersonating,
  });

  const displayNameMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/users/${user!.id}/profile`, {
        fullName: displayName,
      });
    },
    onSuccess: () => {
      toast({ title: "Name updated", description: "Your display name has been changed." });
      setDisplayName("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update name.", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${user!.id}/profile`, {
        currentPassword,
        password: newPassword,
        ...(awaitingCode ? { verificationCode } : {}),
      });
      return res.json().catch(() => ({}));
    },
    onSuccess: (body: any) => {
      if (body?.needsEmailVerification) {
        setAwaitingCode(true);
        setCodeSentTo(body.email || "");
        setVerificationCode("");
        toast({ title: "Check your email", description: body.message || "We sent you a confirmation code." });
        return;
      }
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setAwaitingCode(false);
      setCodeSentTo("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/my-password"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update password.", variant: "destructive" });
    },
  });

  const resetEmailMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/forgot-password", { contact: user!.email });
    },
    onSuccess: () => {
      toast({ title: "Reset code sent", description: `A password reset code has been sent to ${user!.email}. Check your inbox.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reset email. Please try again.", variant: "destructive" });
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

  const handleDisplayNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast({ title: "Required", description: "Please enter a display name.", variant: "destructive" });
      return;
    }
    displayNameMutation.mutate();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast({ title: "Required", description: "Please enter your current password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (awaitingCode && verificationCode.trim().length < 4) {
      toast({ title: "Code required", description: "Enter the confirmation code from your email.", variant: "destructive" });
      return;
    }
    passwordMutation.mutate();
  };

  const handleCancelPasswordChange = () => {
    setAwaitingCode(false);
    setVerificationCode("");
    setCodeSentTo("");
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
    <AdminLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">My Profile</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Display Name
            </CardTitle>
            <CardDescription>
              Currently: <span className="font-medium text-foreground">{user?.fullName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDisplayNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">New Display Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  data-testid="input-display-name"
                />
              </div>
              <Button
                type="submit"
                disabled={displayNameMutation.isPending || !displayName.trim()}
                className="w-full"
                data-testid="button-update-display-name"
              >
                {displayNameMutation.isPending ? <SpinningLogo className="h-4 w-4 mr-2" /> : null}
                Update Name
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
                : "Add an email address to your account — lets you sign in with email too"}
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

        {!isImpersonating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5" />
                Current Password
              </CardTitle>
              <CardDescription>View your saved password</CardDescription>
            </CardHeader>
            <CardContent>
              {passwordLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <SpinningLogo className="h-4 w-4" /> Loading...
                </div>
              ) : savedPassword?.password ? (
                <div className="space-y-2">
                  <Label>Your Password</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={savedPassword.password}
                      readOnly
                      className="font-mono"
                      data-testid="input-view-password"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      data-testid="button-toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last changed: {user?.passwordLastChanged
                      ? new Date(user.passwordLastChanged).toLocaleDateString()
                      : "Unknown"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-saved-password">
                  No saved password on file. Change your password below to save it.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  disabled={awaitingCode}
                  data-testid="input-current-password"
                />
                <p className="text-xs text-muted-foreground">
                  Never set a password? Enter your organization's universal PIN here instead.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  disabled={awaitingCode}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={awaitingCode}
                  data-testid="input-confirm-password"
                />
              </div>
              {awaitingCode && (
                <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <Label htmlFor="verification-code">Email Confirmation Code</Label>
                  <p className="text-xs text-muted-foreground">
                    We sent a 6-digit code to <strong>{codeSentTo}</strong>. Enter it below to finish changing your password.
                  </p>
                  <Input
                    id="verification-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    autoFocus
                    data-testid="input-password-verification-code"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword || (awaitingCode && verificationCode.length < 4)}
                  className="flex-1"
                  data-testid="button-change-password"
                >
                  {passwordMutation.isPending ? <SpinningLogo className="h-4 w-4 mr-2" /> : null}
                  {awaitingCode ? "Confirm & Update" : "Change Password"}
                </Button>
                {awaitingCode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelPasswordChange}
                    data-testid="button-cancel-password-change"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Forgot your current password?</p>
              {user?.email ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-reset-password-email"
                  disabled={resetEmailMutation.isPending}
                  onClick={() => resetEmailMutation.mutate()}
                >
                  {resetEmailMutation.isPending ? <SpinningLogo className="h-4 w-4 mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send Reset Code to {user.email}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="text-no-email-reset">
                  Add an email address to your account to enable password reset via email.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" />
              Passkeys
            </CardTitle>
            <CardDescription>Sign in faster using biometrics or your device PIN — no password required</CardDescription>
          </CardHeader>
          <CardContent>
            <PasskeyManager />
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
    </AdminLayout>
  );
}
