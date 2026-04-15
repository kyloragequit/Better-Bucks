import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Scoped to user ID so a stale choice from one account never affects another
const storageKey = (userId: number) => `bb_tutorial_type_${userId}`;
const CHANGE_EVENT = "bb_tutorial_choice_change";

function readChoice(userId: number | undefined): "quick" | "full" | null {
  if (!userId || typeof window === "undefined") return null;
  return localStorage.getItem(storageKey(userId)) as "quick" | "full" | null;
}

function broadcastChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
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

  const showChoice = !!user && !dbCompleted && !tutorialChoice;
  const shouldShow = !!user && !dbCompleted && tutorialChoice === "quick";
  const showFullTutorial = !!user && !dbCompleted && tutorialChoice === "full";

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
    restoreScroll();
    queryClient.setQueryData(["/api/user"], { ...user, tutorialCompleted: true });
    if (userId) localStorage.removeItem(storageKey(userId));
    broadcastChange();
    try {
      await apiRequest("POST", "/api/users/complete-tutorial");
    } catch {}
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  const skipTutorial = completeTutorial;

  const restartTutorial = async () => {
    if (!user) return;
    restoreScroll();
    if (userId) localStorage.removeItem(storageKey(userId));
    broadcastChange();
    await apiRequest("POST", "/api/users/reset-tutorial");
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  return { showChoice, shouldShow, showFullTutorial, tutorialChoice, chooseTutorial, completeTutorial, skipTutorial, restartTutorial };
}
