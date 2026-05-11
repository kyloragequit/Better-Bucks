import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiUrl } from "@/constants/api";

const CACHE_KEY_PREFIX = "bb_store_catalog_";

export type StoreItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  requiresSize: boolean;
  requiresColor: boolean;
  sizes: string[] | null;
  colors: string[] | null;
};

type CacheEntry = {
  data: StoreItem[];
  cachedAt: number;
};

export async function clearStoreCatalogCache(userId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY_PREFIX + userId);
  } catch {
    // Ignore
  }
}

type UseStoreCatalogResult = {
  items: StoreItem[];
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  cachedAt: number | null;
  refetch: () => void;
};

export function useStoreCatalog(
  token: string | null,
  userId: number | null,
): UseStoreCatalogResult {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const activeTokenRef = useRef(token);
  const activeUserIdRef = useRef(userId);

  useEffect(() => {
    activeTokenRef.current = token;
    activeUserIdRef.current = userId;
  });

  const fetchFromNetwork = useCallback(
    async (currentToken: string, currentUserId: number) => {
      setIsFetching(true);
      try {
        const res = await fetch(apiUrl("/api/mobile/store-items"), {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!res.ok) throw new Error("Failed to load store");
        const freshData: StoreItem[] = await res.json();
        const now = Date.now();
        const entry: CacheEntry = { data: freshData, cachedAt: now };
        await AsyncStorage.setItem(
          CACHE_KEY_PREFIX + currentUserId,
          JSON.stringify(entry),
        );
        if (
          activeTokenRef.current === currentToken &&
          activeUserIdRef.current === currentUserId
        ) {
          setItems(freshData);
          setIsFromCache(false);
          setCachedAt(now);
        }
      } catch {
        // Network failed — keep cached data if available
      } finally {
        if (
          activeTokenRef.current === currentToken &&
          activeUserIdRef.current === currentUserId
        ) {
          setIsFetching(false);
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!token || !userId) {
      setIsLoading(false);
      setItems([]);
      setIsFromCache(false);
      setCachedAt(null);
      return;
    }

    const capturedToken = token;
    const capturedUserId = userId;

    setIsLoading(true);

    (async () => {
      // 1. Serve cached data immediately for instant render
      try {
        const raw = await AsyncStorage.getItem(
          CACHE_KEY_PREFIX + capturedUserId,
        );
        if (raw) {
          const entry: CacheEntry = JSON.parse(raw);
          if (
            activeTokenRef.current === capturedToken &&
            activeUserIdRef.current === capturedUserId
          ) {
            setItems(entry.data);
            setIsFromCache(true);
            setCachedAt(entry.cachedAt);
            setIsLoading(false);
          }
        }
      } catch {
        // Ignore cache read errors
      }

      // 2. Always fetch fresh data in the background
      await fetchFromNetwork(capturedToken, capturedUserId);
    })();
  }, [token, userId, fetchFromNetwork]);

  const refetch = useCallback(() => {
    if (!token || !userId) return;
    fetchFromNetwork(token, userId);
  }, [token, userId, fetchFromNetwork]);

  return { items, isLoading, isFetching, isFromCache, cachedAt, refetch };
}
