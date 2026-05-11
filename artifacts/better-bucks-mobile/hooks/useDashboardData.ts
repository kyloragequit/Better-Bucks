import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiUrl } from "@/constants/api";

const CACHE_KEY_PREFIX = "bb_dashboard_cache_";

export type Transaction = {
  id: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  performedByName?: string | null;
};

export type Goal = {
  id: number;
  name: string;
  type: string;
  targetQuantity: number | null;
  currentQuantity: number | null;
  bucksReward: number;
  deadline: string | null;
};

export type DashboardData = {
  balance: number;
  recentTransactions: Transaction[];
  activeGoals: Goal[];
  adminStats: {
    totalEmployees: number;
    pendingOrdersCount: number;
    totalBucksGiven: number;
  } | null;
};

type CacheEntry = {
  data: DashboardData;
  cachedAt: number;
};

export async function clearDashboardCache(userId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY_PREFIX + userId);
  } catch {
    // Ignore
  }
}

type UseDashboardDataResult = {
  data: DashboardData | null;
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  cachedAt: number | null;
  refetch: () => void;
};

export function useDashboardData(
  token: string | null,
  userId: number | null,
): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
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
        const res = await fetch(apiUrl("/api/mobile/dashboard"), {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!res.ok) throw new Error("Failed to load dashboard");
        const freshData: DashboardData = await res.json();
        const now = Date.now();
        const entry: CacheEntry = { data: freshData, cachedAt: now };
        await AsyncStorage.setItem(
          CACHE_KEY_PREFIX + currentUserId,
          JSON.stringify(entry),
        );
        // Only apply if this fetch is still for the current user
        if (
          activeTokenRef.current === currentToken &&
          activeUserIdRef.current === currentUserId
        ) {
          setData(freshData);
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
      setData(null);
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
        const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + capturedUserId);
        if (raw) {
          const entry: CacheEntry = JSON.parse(raw);
          if (
            activeTokenRef.current === capturedToken &&
            activeUserIdRef.current === capturedUserId
          ) {
            setData(entry.data);
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

  return { data, isLoading, isFetching, isFromCache, cachedAt, refetch };
}
