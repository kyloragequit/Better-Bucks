import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogoBackground } from "@/components/logo-background";
import { AppLogo } from "@/components/app-logo";
import { ArrowLeft, Mail, Phone, Send, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
              {sent
                ? "Check your contact method for the reset code."
                : "Enter the email or phone number associated with your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  If an account with that {method} exists, a 6-digit reset code has been sent. It expires in 1 hour.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setLocation(`/reset-password?contact=${encodeURIComponent(contact.trim())}`)}
                  data-testid="button-enter-code"
                >
                  Enter Reset Code
                </Button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => setSent(false)}
                >
                  Try a different contact
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={method === "email" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => { setMethod("email"); setContact(""); }}
                    data-testid="button-method-email"
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={method === "phone" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => { setMethod("phone"); setContact(""); }}
                    data-testid="button-method-phone"
                  >
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    Phone
                  </Button>
                </div>

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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
