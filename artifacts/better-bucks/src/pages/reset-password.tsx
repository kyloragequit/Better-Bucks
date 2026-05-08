import { useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogoBackground } from "@/components/logo-background";
import { AppLogo } from "@/components/app-logo";
import { ArrowLeft, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";

export default function ResetPasswordPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();

  const params = new URLSearchParams(window.location.search);
  const prefillContact = params.get("contact") || "";

  const [contact, setContact] = useState(prefillContact);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        contact: contact.trim(),
        code: code.trim(),
        newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message || "Invalid or expired code.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <LogoBackground />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <Button
          variant="ghost"
          onClick={() => setLocation("/forgot-password")}
          data-testid="button-back-forgot"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex justify-center mb-2">
          <AppLogo size="md" />
        </div>

        <Card className="shadow-xl border-muted">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-xl font-bold">Enter Reset Code</CardTitle>
            <CardDescription>
              {success
                ? "Your password has been reset successfully."
                : "Enter the 6-digit code we sent you, then choose a new password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Password reset successfully. You can now log in with your new password.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-go-login"
                >
                  Go to Login
                </Button>
              </div>
            ) : (
              <form onFocusCapture={scrollOnFocus} onSubmit={handleSubmit} className="space-y-4">
                {!prefillContact && (
                  <div className="space-y-2">
                    <Label htmlFor="reset-contact">Email or Phone</Label>
                    <Input
                      id="reset-contact"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="The email or phone you submitted"
                      required
                      autoComplete="email"
                      data-testid="input-reset-contact"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-code">6-Digit Reset Code</Label>
                  <Input
                    id="reset-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    className="text-center text-2xl tracking-widest font-mono"
                    data-testid="input-reset-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      className="pl-9 pr-9"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      autoComplete="new-password"
                      data-testid="input-new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      required
                      autoComplete="new-password"
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending || code.length < 6 || !newPassword}
                  data-testid="button-reset-submit"
                >
                  {isPending ? "Resetting..." : "Reset Password"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive a code?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setLocation("/forgot-password")}
                  >
                    Request a new one
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <SiteFooter absolute />
    </div>
  );
}
