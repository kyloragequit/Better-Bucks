import { useQuery } from "@tanstack/react-query";

export function usePublicDemo() {
  const { data } = useQuery<{ inDemo: boolean; isPublicDemo: boolean }>({
    queryKey: ["/api/demo/status"],
  });
  return data?.isPublicDemo === true;
}
