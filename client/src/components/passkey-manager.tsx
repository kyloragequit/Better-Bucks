import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTutorial } from "@/hooks/use-tutorial";
import { KeyRound, Trash2, Pencil, Check, X, Plus, Laptop, Smartphone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type PasskeyInfo = {
  id: number;
  name: string;
  deviceType: string | null;
  backedUp: boolean | null;
  createdAt: string;
};

function PasskeyRow({ pk, onDeleted }: { pk: PasskeyInfo; onDeleted: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pk.name);

  const renameMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/passkeys/${pk.id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passkeys"] });
      setEditing(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to rename passkey.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/passkeys/${pk.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passkeys"] });
      onDeleted();
    },
    onError: () => toast({ title: "Error", description: "Failed to delete passkey.", variant: "destructive" }),
  });

  const isMultiDevice = pk.deviceType === "multiDevice";
  const Icon = isMultiDevice ? Smartphone : Laptop;

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") renameMutation.mutate();
                if (e.key === "Escape") { setEditing(false); setName(pk.name); }
              }}
            />
            <button onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending} className="text-primary hover:opacity-70">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => { setEditing(false); setName(pk.name); }} className="text-muted-foreground hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{pk.name}</span>
            {pk.backedUp && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                Synced
              </Badge>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          Added {new Date(pk.createdAt).toLocaleDateString()}
        </p>
      </div>

      {!editing && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Passkey</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove <strong>{pk.name}</strong>? You won't be able to use it to sign in anymore.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

export function PasskeyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const { data: passkeys = [], isLoading } = useQuery<PasskeyInfo[]>({
    queryKey: ["/api/passkeys"],
  });

  async function handleAddPasskey() {
    setRegistering(true);
    try {
      const startRes = await apiRequest("POST", "/api/passkeys/register/start");
      const options = await startRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const finishRes = await apiRequest("POST", "/api/passkeys/register/finish", {
        name: newName || "Passkey",
        ...credential,
      });
      if (!finishRes.ok) {
        const err = await finishRes.json();
        throw new Error(err.message || "Registration failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/passkeys"] });
      setShowNameInput(false);
      setNewName("");
      toast({ title: "Passkey added!", description: "You can now sign in with this passkey." });
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        toast({ title: "Setup failed", description: err.message || "Could not add passkey.", variant: "destructive" });
      }
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Loading passkeys…</div>
      ) : passkeys.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          No passkeys yet. Add one below to sign in with Windows Hello, Face ID, or your phone.
        </div>
      ) : (
        <div>
          {passkeys.map(pk => (
            <PasskeyRow
              key={pk.id}
              pk={pk}
              onDeleted={() => toast({ title: "Passkey removed" })}
            />
          ))}
        </div>
      )}

      {showNameInput ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder='Name this passkey (e.g. "My Phone")'
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleAddPasskey();
              if (e.key === "Escape") { setShowNameInput(false); setNewName(""); }
            }}
          />
          <Button size="sm" onClick={handleAddPasskey} disabled={registering} data-testid="button-confirm-add-passkey">
            {registering ? "Setting up…" : "Add"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNameInput(false); setNewName(""); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setShowNameInput(true)}
          data-testid="button-add-passkey"
        >
          <Plus className="h-4 w-4" />
          Add Passkey
        </Button>
      )}
    </div>
  );
}

export function PasskeyFirstTimePrompt({ userId }: { userId: number }) {
  const storageKey = `passkey_prompt_dismissed_${userId}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(storageKey) === "1");
  // Don't ask the user about passkeys while the onboarding tutorial is open —
  // it sits behind the modal and reads as "the app is asking for my password
  // in the background". Defer until the tutorial is dismissed/finished.
  const { showChoice, shouldShow, showFullTutorial } = useTutorial();
  const tutorialActive = showChoice || shouldShow || showFullTutorial;
  const { data: passkeys, isLoading } = useQuery<PasskeyInfo[]>({
    queryKey: ["/api/passkeys"],
    enabled: !dismissed && !tutorialActive,
  });

  function handleDismiss() {
    sessionStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  if (tutorialActive || dismissed || isLoading || (passkeys && passkeys.length > 0)) return null;

  return <PasskeySetupPrompt onDismiss={handleDismiss} />;
}

export function PasskeySetupPrompt({ onDismiss }: { onDismiss: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const [step, setStep] = useState<"prompt" | "name">("prompt");
  const [name, setName] = useState("");

  async function handleSetup() {
    setRegistering(true);
    try {
      const startRes = await apiRequest("POST", "/api/passkeys/register/start");
      const options = await startRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const finishRes = await apiRequest("POST", "/api/passkeys/register/finish", {
        name: name || "My Passkey",
        ...credential,
      });
      if (!finishRes.ok) {
        const err = await finishRes.json();
        throw new Error(err.message || "Registration failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/passkeys"] });
      toast({ title: "Passkey saved!", description: "Next time, sign in with just a tap or glance." });
      onDismiss();
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        toast({ title: "Setup failed", description: err.message || "Could not add passkey.", variant: "destructive" });
      }
      setRegistering(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Sign in faster with a passkey</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use Windows Hello, Face ID, fingerprint, or your phone — no password needed next time.
          </p>
        </div>
      </div>

      {step === "name" && (
        <Input
          placeholder='Name this passkey (e.g. "My Phone")'
          value={name}
          onChange={e => setName(e.target.value)}
          className="text-sm"
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") handleSetup(); }}
        />
      )}

      <div className="flex gap-2">
        {step === "prompt" ? (
          <>
            <Button size="sm" className="flex-1" onClick={() => setStep("name")} data-testid="button-setup-passkey">
              Set up passkey
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss} data-testid="button-skip-passkey">
              Not now
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="flex-1" onClick={handleSetup} disabled={registering} data-testid="button-confirm-passkey">
              {registering ? "Setting up…" : "Continue"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStep("prompt")}>
              Back
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
