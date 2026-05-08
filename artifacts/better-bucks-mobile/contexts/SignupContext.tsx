import React, { createContext, useContext, useMemo, useState } from "react";

export type SignupTier = "small" | "mid" | "large" | "enterprise";

export type SignupDraft = {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  tier: SignupTier;
};

type SignupCtx = {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  reset: () => void;
};

const initialDraft: SignupDraft = {
  organizationName: "",
  fullName: "",
  email: "",
  password: "",
  tier: "small",
};

const Ctx = createContext<SignupCtx | null>(null);

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(initialDraft);
  const value = useMemo<SignupCtx>(
    () => ({
      draft,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      reset: () => setDraft(initialDraft),
    }),
    [draft],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSignup() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSignup must be used inside SignupProvider");
  return v;
}
