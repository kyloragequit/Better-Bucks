import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Scoped to user ID so a stale choice from one account never affects another
const storageKey = (userId: number) => `bb_tutorial_type_${userId}`;
const CHANGE_EVENT = "bb_tutorial_choice_change";
// Fired ONLY when the user explicitly restarts the tutorial from settings.
// Tutorial overlays listen for this to clear their local "force hide" flag so
// the choice modal re-appears. We can't use a generic re-render for this
// because the user may have already skipped the tutorial earlier — we don't
// want the "skip" to be undone by an unrelated re-render of user data.
export const TUTORIAL_RESET_EVENT = "bb_tutorial_reset";

// Module-level, in-memory set of user IDs who dismissed the tutorial during
// the current page session. This guards against a real race: the global
// PageRefresher in App.tsx invalidates ALL queries on every route change.
// If Skip triggers a navigation (full-tutorial does setLocation(homePath)),
// /api/user is refetched and may return tutorialCompleted=false before the
// POST /api/users/complete-tutorial settles, which would briefly re-open
// the overlay. Any module reading this set is guaranteed to see the
// dismissal regardless of what the server cache currently says, until the
// user explicitly restarts the tutorial.
//
// We also mirror the flag to sessionStorage so a module reload (HMR, lazy
// chunk reload, deferred Suspense remount) doesn't lose the dismissal and
// re-show the choice modal on the next navigation.
const dismissedSessionKey = (userId: number) => `bb_tutorial_dismissed_${userId}`;
const dismissedThisSession = new Set<number>();

function isDismissed(userId: number): boolean {
  if (dismissedThisSession.has(userId)) return true;
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(dismissedSessionKey(userId)) === "1") {
      dismissedThisSession.add(userId);
      return true;
    }
  } catch {}
  return false;
}

function markDismissed(userId: number) {
  dismissedThisSession.add(userId);
  if (typeof window !== "undefined") {
    try { sessionStorage.setItem(dismissedSessionKey(userId), "1"); } catch {}
  }
}

function clearDismissed(userId: number) {
  dismissedThisSession.delete(userId);
  if (typeof window !== "undefined") {
    try { sessionStorage.removeItem(dismissedSessionKey(userId)); } catch {}
  }
}

function readChoice(userId: number | undefined): "quick" | "full" | null {
  if (!userId || typeof window === "undefined") return null;
  return localStorage.getItem(storageKey(userId)) as "quick" | "full" | null;
}

function broadcastChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function broadcastReset() {
  window.dispatchEvent(new Event(TUTORIAL_RESET_EVENT));
}

export function useTutorial() {
  const { data: user } = useUser();
  const userId = user?.id;

  // Re-render counter — all hook instances re-render when tutorial choice changes
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  // Always read fresh from localStorage (never stale state)
  const tutorialChoice = readChoice(userId);
  const dbCompleted = !!user && user.tutorialCompleted;
  const sessionDismissed = !!userId && isDismissed(userId);

  const showChoice = !!user && !dbCompleted && !sessionDismissed && !tutorialChoice;
  const shouldShow = !!user && !dbCompleted && !sessionDismissed && tutorialChoice === "quick";
  const showFullTutorial = !!user && !dbCompleted && !sessionDismissed && tutorialChoice === "full";

  const chooseTutorial = (type: "quick" | "full") => {
    if (!userId) return;
    localStorage.setItem(storageKey(userId), type);
    broadcastChange();
  };

  const restoreScroll = () => {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.documentElement.style.overflow = "";
  };

  const completeTutorial = async () => {
    if (!user) return;
    // ---- Synchronous teardown (runs in the same React event-handler batch) ----
    // Everything here fires before the first `await`, so it lands in the same
    // React render batch as the caller's `setForceHide(true)`. This prevents a
    // race where the PageRefresher (triggered by any navigation in handleSkip)
    // invalidates /api/user and a background refetch returns tutorialCompleted=false
    // before the POST settles — which would briefly re-open the overlay.
    if (userId) markDismissed(userId);       // in-memory Set + sessionStorage
    restoreScroll();
    if (userId) localStorage.removeItem(storageKey(userId)); // clear tutorialChoice
    broadcastChange();  // re-render all useTutorial() instances NOW with fresh flags
    // ---- Async persistence (fire-and-forget from the caller's perspective) ----
    try {
      // Cancel any in-flight /api/user refetch before the optimistic write so a
      // racing response can't overwrite our update.
      await queryClient.cancelQueries({ queryKey: ["/api/user"] });
      queryClient.setQueryData(["/api/user"], { ...user, tutorialCompleted: true });
      const res = await apiRequest("POST", "/api/users/complete-tutorial");
      const updated = await res.json().catch(() => null);
      // Use the server's authoritative response to avoid a stale-data race.
      if (updated && typeof updated === "object") {
        queryClient.setQueryData(["/api/user"], updated);
      }
    } catch {
      // If the server call failed, keep the optimistic update so the user
      // isn't yanked back into the tutorial. They can restart from settings.
    }
  };

  // skipTutorial is functionally identical to completeTutorial — both mark
  // the tutorial as done and prevent it from re-opening. Keep them as a single
  // implementation so any future change applies to both paths.
  const skipTutorial = completeTutorial;

  const restartTutorial = async () => {
    if (!user) return;
    restoreScroll();
    // Explicit restart from Settings is the ONLY way to re-show the tutorial
    // after dismissal — clear the session guard so the choice modal can
    // re-appear once the server reset lands.
    if (userId) clearDismissed(userId);
    if (userId) localStorage.removeItem(storageKey(userId));
    broadcastChange();
    try {
      const res = await apiRequest("POST", "/api/users/reset-tutorial");
      const updated = await res.json().catch(() => null);
      if (updated && typeof updated === "object") {
        queryClient.setQueryData(["/api/user"], updated);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
    // Tell any tutorial overlay that previously force-hid itself to reset.
    broadcastReset();
  };

  return { showChoice, shouldShow, showFullTutorial, tutorialChoice, chooseTutorial, completeTutorial, skipTutorial, restartTutorial };
}
