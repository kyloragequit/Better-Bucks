import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type SecurityEvent = {
  id: number;
  eventType: "social_linked" | "social_unlinked" | "password_changed";
  provider: "google" | "apple" | null;
  providerEmail: string | null;
  createdAt: string;
};

function eventLabel(event: SecurityEvent): string {
  const providerName =
    event.provider === "google"
      ? "Google"
      : event.provider === "apple"
        ? "Apple"
        : null;

  switch (event.eventType) {
    case "social_linked":
      return providerName ? `${providerName} account linked` : "Social account linked";
    case "social_unlinked":
      return providerName ? `${providerName} account unlinked` : "Social account unlinked";
    case "password_changed":
      return "Password changed";
    default:
      return "Account change";
  }
}

function eventIcon(
  event: SecurityEvent,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (event.eventType) {
    case "social_linked":
      return "link-outline";
    case "social_unlinked":
      return "unlink-outline";
    case "password_changed":
      return "key-outline";
    default:
      return "shield-outline";
  }
}

function eventIconColor(event: SecurityEvent): string {
  switch (event.eventType) {
    case "social_linked":
      return brand.green ?? "#22c55e";
    case "social_unlinked":
      return brand.danger ?? "#ef4444";
    case "password_changed":
      return brand.gold;
    default:
      return "rgba(255,255,255,0.5)";
  }
}

function eventIconBg(event: SecurityEvent): string {
  switch (event.eventType) {
    case "social_linked":
      return "rgba(34,197,94,0.12)";
    case "social_unlinked":
      return "rgba(239,68,68,0.12)";
    case "password_changed":
      return "rgba(245,200,66,0.12)";
    default:
      return "rgba(255,255,255,0.06)";
  }
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function EventRow({ event }: { event: SecurityEvent }) {
  const iconName = eventIcon(event);
  const iconColor = eventIconColor(event);
  const iconBg = eventIconBg(event);

  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{eventLabel(event)}</Text>
        {event.providerEmail ? (
          <Text style={styles.rowSub}>{event.providerEmail}</Text>
        ) : null}
        <Text style={styles.rowTime}>{formatDate(event.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function SecurityActivityScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/mobile/account/security-events"), {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (!res.ok) throw new Error("Failed to load security events");
        const data = await res.json();
        if (!cancelled) setEvents(data.events ?? []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Text style={styles.description}>
        A record of recent changes to your account security, such as signing in
        with a social provider or updating your password.
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={brand.gold} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color="rgba(255,255,255,0.3)"
          />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="shield-checkmark-outline"
            size={48}
            color="rgba(255,255,255,0.2)"
          />
          <Text style={styles.emptyText}>No security events yet</Text>
          <Text style={styles.emptySubtext}>
            Changes to your linked accounts and password will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <EventRow event={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.navy,
  },
  description: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowLabel: {
    color: brand.white,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    marginBottom: 2,
  },
  rowSub: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginBottom: 2,
  },
  rowTime: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 54,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyText: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.3)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
