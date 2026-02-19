import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, RefreshCw } from "lucide-react";
import type { User } from "@shared/schema";

interface VerifyEmailPageProps {
  user: User;
}

export default function VerifyEmailPage({ user }: VerifyEmailPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const isPhoneVerification = !user.email && !!user.phone;
  const contactInfo = isPhoneVerification ? user.phone : user.email;
  const contactLabel = isPhoneVerification ? "Phone" : "Email";

  const { mutate: verify, isPending: isVerifying } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/verify-email", { code });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: `${contactLabel} Verified!`, description: `Your ${contactLabel.toLowerCase()} has been verified successfully.` });
      if (user.role === "employee") {
        setLocation("/dashboard");
      } else {
        setLocation("/admin/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    },
  });

  const { mutate: resend, isPending: isResending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/resend-verification", {});
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Code Sent", description: `A new verification code has been sent to your ${contactLabel.toLowerCase()}.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({ title: "Error", description: "Please enter the 6-digit code", variant: "destructive" });
      return;
    }
    verify();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-[#F7C1E7] opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-[#F7C1E7] opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-[#F7C1E7] opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-[#F7C1E7] opacity-25" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-2">
              <AppLogo size="lg" />
            </div>
            <div className="mx-auto w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mb-2">
              {isPhoneVerification ? <Phone className="h-8 w-8 text-pink-500" /> : <Mail className="h-8 w-8 text-pink-500" />}
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-verify-title">
              Verify Your {contactLabel}
            </CardTitle>
            <CardDescription>
              We sent a 6-digit code to <strong>{contactInfo}</strong>. Enter it below to verify your account.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter 6-digit code"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(val);
                  }}
                  maxLength={6}
                  required
                  data-testid="input-verification-code"
                />
              </div>

              <Button
                type="submit"
                className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25"
                disabled={isVerifying || code.length !== 6}
                data-testid="button-verify-email"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  `Verify ${contactLabel}`
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => resend()}
                  disabled={isResending}
                  data-testid="button-resend-code"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Resend Code
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
