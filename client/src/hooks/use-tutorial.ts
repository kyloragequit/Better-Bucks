import { useUser } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useTutorial() {
  const { data: user } = useUser();

  const shouldShow = !!user && !user.tutorialCompleted;

  const completeTutorial = async () => {
    if (!user) return;
    await apiRequest("POST", "/api/users/complete-tutorial");
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  const skipTutorial = completeTutorial;

  const restartTutorial = async () => {
    if (!user) return;
    await apiRequest("POST", "/api/users/reset-tutorial");
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };

  return { shouldShow, completeTutorial, skipTutorial, restartTutorial };
}
