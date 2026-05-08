import { useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogoBackground } from "@/components/logo-background";
import { AppLogo } from "@/components/app-logo";
import { ArrowLeft, Mail, Phone, Send, CheckCircle, KeyRound, Building2, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useScrollIntoViewOnFocus } from "@/hooks/use-scroll-into-view-on-focus";

type Method = "email" | "phone" | "siteid";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scrollOnFocus = useScrollIntoViewOnFocus();
  const [method, setMethod] = useState<Method>("email");
  const [contact, setContact] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);

  // Site ID flow state
  const [siteId, setSiteId] = useState(localStorage.getItem("bb_last_site_id") || "");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [siteIdSuccess, setSiteIdSuccess] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { contact: contact.trim() });
      setSent(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleSiteIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId.trim() || !username.trim() || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Make sure both password fields are the same.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password-via-site-id", {
        siteId: siteId.trim().toLowerCase(),
        username: username.trim(),
        newPassword,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not set password.");
      }
      localStorage.setItem("bb_last_site_id", siteId.trim().toLowerCase());
      setSiteIdSuccess(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message || "Something went wrong.", variant: "destructive" });
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
          onClick={() => setLocation("/login")}
          data-testid="button-back-login"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>

        <div className="flex justify-center mb-2">
          <AppLogo size="md" />
        </div>

        <Card className="shadow-xl border-muted">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-xl font-bold">Reset Your Password</CardTitle>
            <CardDescription>
              {siteIdSuccess
                ? "Your new password is ready to use."
                : sent
                  ? "Check your contact method for the reset code."
                  : method === "siteid"
                    ? "Set a new password using your workplace Site ID."
                    : "Enter the email or phone number associated with your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Success: Site ID reset completed */}
            {siteIdSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Password set successfully. You can now log in with your new password.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-siteid-go-login"
                >
                  Go to Login
                </Button>
              </div>
            ) : sent ? (
              <div className="py-2 space-y-4">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-3">
                    <CheckCircle className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    If an account with that {method} exists, a 6-digit reset code has been sent. Check your inbox — it expires in 1 hour.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => setLocation(`/reset-password?contact=${encodeURIComponent(contact.trim())}`)}
                  data-testid="button-enter-code"
                >
                  Enter Reset Code
                </Button>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 space-y-1.5" data-testid="notice-email-fallback">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Didn't receive it?
                  </div>
                  <ul className="text-xs text-amber-900 space-y-1 pl-1">
                    <li>• Check your spam or junk folder.</li>
                    <li>• Some corporate mail systems (e.g. DHL) block automated emails — ask your administrator to look up your reset code directly.</li>
                    <li>• If your email isn't on file, your admin can add it to your profile first.</li>
                  </ul>
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-800 underline underline-offset-2 mt-1"
                    onClick={() => { setSent(false); setMethod("siteid"); }}
                    data-testid="button-try-siteid"
                  >
                    Try Site ID instead →
                  </button>
                </div>
                <button
                  type="button"
                  className="block w-full text-center text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => setSent(false)}
                >
                  Try a different contact
                </button>
              </div>
            ) : (
              <>
                {/* Method tabs */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Button
                    type="button"
                    variant={method === "email" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setMethod("email"); setContact(""); }}
                    data-testid="button-method-email"
                  >
                    <Mail className="mr-1 h-3.5 w-3.5" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={method === "phone" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setMethod("phone"); setContact(""); }}
                    data-testid="button-method-phone"
                  >
                    <Phone className="mr-1 h-3.5 w-3.5" />
                    Phone
                  </Button>
                  <Button
                    type="button"
                    variant={method === "siteid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setMethod("siteid"); }}
                    data-testid="button-method-siteid"
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" />
                    Site ID
                  </Button>
                </div>

                {method === "siteid" ? (
                  <form onFocusCapture={scrollOnFocus} onSubmit={handleSiteIdSubmit} className="space-y-4">
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Only works if you've never set your own password. If you've changed your password before, use Email or Phone above.
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site-id">Workplace Site ID</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="site-id"
                          className="pl-9"
                          placeholder="e.g. acme-warehouse"
                          value={siteId}
                          onChange={(e) => setSiteId(e.target.value.toLowerCase())}
                          required
                          autoCapitalize="none"
                          autoComplete="off"
                          data-testid="input-siteid"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username-input">Employee Code</Label>
                      <Input
                        id="username-input"
                        placeholder="Your employee code"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                        data-testid="input-siteid-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siteid-new-password">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="siteid-new-password"
                          type={showPassword ? "text" : "password"}
                          className="pl-9 pr-9"
                          placeholder="At least 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          data-testid="input-siteid-new-password"
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
                      <Label htmlFor="siteid-confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="siteid-confirm-password"
                          type={showPassword ? "text" : "password"}
                          className="pl-9"
                          placeholder="Repeat your new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          data-testid="input-siteid-confirm-password"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isPending || !siteId.trim() || !username.trim() || !newPassword}
                      data-testid="button-siteid-reset"
                    >
                      {isPending ? "Setting password..." : <><KeyRound className="mr-2 h-4 w-4" /> Set New Password</>}
                    </Button>
                  </form>
                ) : (
                  <form onFocusCapture={scrollOnFocus} onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-input">
                        {method === "email" ? "Email Address" : "Phone Number"}
                      </Label>
                      <Input
                        id="contact-input"
                        type={method === "email" ? "email" : "tel"}
                        placeholder={method === "email" ? "you@example.com" : "+1 (555) 000-0000"}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        required
                        autoComplete={method === "email" ? "email" : "tel"}
                        data-testid="input-contact"
                      />
                      {method === "email" && (
                        <p className="text-xs text-muted-foreground">
                          Use the email address your administrator has on file for you. Corporate mail filters may delay or block the code — if it doesn't arrive, use <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setMethod("siteid")}>Site ID</button> instead.
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isPending || !contact.trim()}
                      data-testid="button-send-code"
                    >
                      {isPending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Reset Code
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <SiteFooter absolute />
    </div>
  );
}
