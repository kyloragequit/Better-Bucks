import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-auth";

const RESTART_EVENT = "bb-tutorial-restart";

export function useTutorial() {
  const { data: user } = useUser();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!user) { setShouldShow(false); return; }
    const key = `bb_tutorial_done_${user.id}`;
    if (!localStorage.getItem(key)) {
      setShouldShow(true);
    }
  }, [user?.id]);

  useEffect(() => {
    const handler = () => setShouldShow(true);
    window.addEventListener(RESTART_EVENT, handler);
    return () => window.removeEventListener(RESTART_EVENT, handler);
  }, []);

  const completeTutorial = () => {
    if (!user) return;
    localStorage.setItem(`bb_tutorial_done_${user.id}`, "1");
    setShouldShow(false);
  };

  const skipTutorial = completeTutorial;

  const restartTutorial = () => {
    if (!user) return;
    localStorage.removeItem(`bb_tutorial_done_${user.id}`);
    window.dispatchEvent(new CustomEvent(RESTART_EVENT));
  };

  return { shouldShow, completeTutorial, skipTutorial, restartTutorial };
}
