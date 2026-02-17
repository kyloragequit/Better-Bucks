import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AppLogo } from "@/components/app-logo";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CreditCard, Users, Award, ShoppingCart, Shield, Check } from "lucide-react";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");

  const params = new URLSearchParams(window.location.search);
  const cancelled = params.get("cancelled");

  const { mutate: startCheckout, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations/signup", {
        organizationName: orgName,
        email,
      });
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startCheckout();
  };

  const features = [
    { icon: Users, label: "Unlimited employees and admins" },
    { icon: Award, label: "Points-based reward system" },
    { icon: ShoppingCart, label: "Order management with photo uploads" },
    { icon: Shield, label: "Role-based access control" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full bg-[#D40511] opacity-20" />
        <div className="absolute top-[20%] right-[15%] w-24 h-24 rounded-full bg-[#D40511] opacity-10" />
        <div className="absolute bottom-[15%] left-[20%] w-16 h-16 rounded-full bg-[#D40511] opacity-15" />
        <div className="absolute top-[60%] right-[10%] w-8 h-8 rounded-full bg-[#D40511] opacity-25" />
        <div className="absolute bottom-[10%] right-[30%] w-20 h-20 rounded-full bg-[#D40511] opacity-10" />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6">
        <Button
          variant="ghost"
          className="mb-2"
          onClick={() => setLocation("/")}
          data-testid="button-back-landing"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="shadow-2xl shadow-black/10 border-muted bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-2">
              <AppLogo size="lg" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-signup-title">
              Employee Incentive Portal
            </CardTitle>
            <CardDescription className="text-base">
              Everything you need to manage employee rewards and recognition
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-3">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-gray-700">{feature.label}</span>
                </div>
              ))}
            </div>

            <div className="rounded-md bg-primary/5 p-4 text-center border border-primary/10">
              <div className="text-3xl font-bold text-gray-900">$50</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>

            {cancelled && (
              <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                Payment was cancelled. You can try again below.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Corporation"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  data-testid="input-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Billing Email</Label>
                <Input
                  id="org-email"
                  type="email"
                  placeholder="billing@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-org-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full text-base py-6 font-semibold shadow-lg shadow-primary/25 transition-all duration-300"
                disabled={isPending}
                data-testid="button-subscribe"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Subscribe - $50/month
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
