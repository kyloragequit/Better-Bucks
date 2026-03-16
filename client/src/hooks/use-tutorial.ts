import { useState } from "react";
import { useUser } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useTutorial() {
  const { data: user } = useUser();

  const dbCompleted = !!user && user.tutorialCompleted;

  const [tutorialChoice, setTutorialChoiceState] = useState<"quick" | "full" | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bb_tutorial_type") as "quick" | "full" | null;
    }
    return null;
  });

  const showChoice = !!user && !dbCompleted && !tutorialChoice;
  const shouldShow = !!user && !dbCompleted && tutorialChoice === "quick";
  const showFullTutorial = !!user && !dbCompleted && tutorialChoice === "full";

  const chooseTutorial = (type: "quick" | "full") => {
    localStorage.setItem("bb_tutorial_type", type);
    setTutorialChoiceState(type);
  };

  const completeTutorial = async () => {
    if (!user) return;
    localStorage.removeItem("bb_tutorial_type");
    setTutorialChoiceState(null);
    await apiRequest("POST", "/api/users/complete-tutorial");
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  const skipTutorial = completeTutorial;

  const restartTutorial = async () => {
    if (!user) return;
    localStorage.removeItem("bb_tutorial_type");
    setTutorialChoiceState(null);
    await apiRequest("POST", "/api/users/reset-tutorial");
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  return { showChoice, shouldShow, showFullTutorial, tutorialChoice, chooseTutorial, completeTutorial, skipTutorial, restartTutorial };
}
