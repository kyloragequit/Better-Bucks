import { useEffect, useRef, useState } from "react";
import { SpinningLogo } from "@/components/spinning-logo";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Mail, RotateCw } from "lucide-react";

export default function ChangePasswordPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState("");
  const [autoSendError, setAutoSendError] = useState("");
  // useRef survives StrictMode double-mount; setState would let the second mount
  // re-fire the email send.
  const autoSentRef = useRef(false);

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/send-password-change-code");
      return res.json();
    },
    onSuccess: (body: any) => {
      setCodeSentTo(body?.email || "");
      setAutoSendError("");
    },
    onError: (err: any) => {
      setAutoSendError(err?.message || "Couldn't send the confirmation code.");
    },
  });

  // Auto-fire the code email as soon as the page loads, but only for users who
  // are actually being forced to change AND have an email on file.
  useEffect(() => {
    if (!user || autoSentRef.current) return;
    if (!user.mustChangePassword) return;
    if (!user.email) {
      setAutoSendError("Add a recovery email in your account before you can change your password here.");
      return;
    }
    autoSentRef.current = true;
    sendCodeMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Side-effecty navigation belongs in an effect, not the render path.
  useEffect(() => {
    if (!isLoading && (!user || !user.mustChangePassword)) {
      setLocation("/");
    }
  }, [isLoading, user, setLocation]);

  const updateMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}/profile`, {
        password: newPassword,
        verificationCode,
      });
      return res.json();
    },
    onSuccess: (body: any) => {
      // If the server still wants verification (e.g. our token expired), let the user
      // try again with the freshly-resent code instead of silently dropping their input.
      if (body?.needsEmailVerification) {
        setCodeSentTo(body.email || codeSentTo);
        toast({ title: "Code refreshed", description: body.message || "We sent a new code — enter it below." });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Password updated", description: "Your new password is now active." });
      const dest = (user?.role === "admin" || user?.role === "prime_admin") ? "/admin/dashboard" : "/dashboard";
      setLocation(dest);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return null;
  if (!user || !user.mustChangePassword) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (verificationCode.trim().length < 4) {
      toast({ title: "Code required", description: "Enter the 6-digit code we sent to your email.", variant: "destructive" });
      return;
    }
    updateMutation.mutate(password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4 relative">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Change Password</CardTitle>
          <CardDescription className="text-center">
            You must change your password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="mb-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
            data-testid="banner-code-status"
          >
            <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {sendCodeMutation.isPending && !codeSentTo ? (
                <p>Sending a confirmation code to your email...</p>
              ) : autoSendError ? (
                <p className="text-destructive">{autoSendError}</p>
              ) : codeSentTo ? (
                <p>
                  We sent a 6-digit code to <strong className="break-all">{codeSentTo}</strong>. Enter it below to confirm the change.
                </p>
              ) : (
                <p>Preparing your confirmation code...</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => sendCodeMutation.mutate()}
              disabled={sendCodeMutation.isPending}
              data-testid="button-resend-code"
            >
              <RotateCw className={`h-3.5 w-3.5 ${sendCodeMutation.isPending ? "animate-spin" : ""}`} />
              <span className="ml-1 text-xs">Resend</span>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
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
                autoComplete="new-password"
                required
                data-testid="input-confirm-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verification-code">Email Confirmation Code</Label>
              <Input
                id="verification-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
                data-testid="input-verification-code"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending || !password || !confirmPassword || verificationCode.length < 4}
              data-testid="button-update-password"
            >
              {updateMutation.isPending ? <SpinningLogo className="mr-2 h-4 w-4" /> : null}
              Confirm & Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
      <SiteFooter absolute />
    </div>
  );
}
