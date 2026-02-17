import { useQuery } from "@tanstack/react-query";

export function useStoreUrl() {
  const { data } = useQuery<{ storeUrl: string }>({
    queryKey: ["/api/organizations/store-url"],
  });
  return { storeUrl: data?.storeUrl || "https://dscpromostore.com/" };
}
