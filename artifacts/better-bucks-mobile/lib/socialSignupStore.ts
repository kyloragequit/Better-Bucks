export type PendingSocialSignup = {
  provider: "google" | "apple";
  identityToken: string;
  providerEmail: string | null;
  providerName: string | null;
};

let pending: PendingSocialSignup | null = null;

export function setPendingSocialSignup(data: PendingSocialSignup): void {
  pending = data;
}

export function consumePendingSocialSignup(): PendingSocialSignup | null {
  const p = pending;
  pending = null;
  return p;
}
