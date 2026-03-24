import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, ShieldCheck, X } from "lucide-react";

export function TwoFaPrompt() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const shouldShow =
    !!user &&
    !!user.termsAcceptedAt &&
    !user.email &&
    !user.phone &&
    !user.twoFaPromptDismissed;

  const dismissMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/users/dismiss-2fa-prompt"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (body: { email?: string; phone?: string }) =>
      apiRequest("PATCH", "/api/users/contact-info", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Contact info saved", description: "You can now receive notifications and account recovery messages." });
    },
    onError: (err: any) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (method === "email") {
      saveMutation.mutate({ email });
    } else {
      saveMutation.mutate({ phone });
    }
  };

  const handleSkip = () => {
    dismissMutation.mutate();
  };

  const isLoading = saveMutation.isPending || dismissMutation.isPending;

  if (!shouldShow) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Add a recovery contact</DialogTitle>
          </div>
          <DialogDescription>
            Add an email or phone number so you can recover your account and receive important notifications. This is optional — you can always add one later in your settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mt-1">
          <Button
            type="button"
            variant={method === "email" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMethod("email")}
            data-testid="button-2fa-email"
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email
          </Button>
          <Button
            type="button"
            variant={method === "phone" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMethod("phone")}
            data-testid="button-2fa-phone"
          >
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Phone
          </Button>
        </div>

        {method === "email" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="2fa-email">Email address</Label>
            <Input
              id="2fa-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-2fa-email"
            />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="2fa-phone">Phone number</Label>
            <Input
              id="2fa-phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-2fa-phone"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 mt-1">
          <Button
            onClick={handleSave}
            disabled={isLoading || (method === "email" ? !email.trim() : !phone.trim())}
            data-testid="button-2fa-save"
          >
            {saveMutation.isPending ? "Saving..." : "Save contact info"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleSkip}
            disabled={isLoading}
            data-testid="button-2fa-skip"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
