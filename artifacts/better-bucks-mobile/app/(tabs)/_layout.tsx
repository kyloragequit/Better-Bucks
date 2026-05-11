import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  focused,
}: {
  name: IoniconsName;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={24}
      color={focused ? brand.green : "#9E9E9E"}
    />
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const admin = user?.role === "admin" || user?.role === "prime_admin";

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: brand.navy },
        headerTintColor: brand.white,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: brand.white,
          borderTopColor: brand.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: brand.green,
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" focused={focused} />
          ),
          headerTitle: "Better Bucks",
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: admin ? "Reward" : "Store",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={admin ? "gift" : "storefront"}
              focused={focused}
            />
          ),
          headerTitle: admin ? "Reward Employee" : "Store",
        }}
      />
      <Tabs.Screen
        name="surveys"
        options={{
          title: "Surveys",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="document-text" focused={focused} />
          ),
          headerTitle: "Surveys",
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: admin ? "Orders" : "My Orders",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="receipt" focused={focused} />
          ),
          headerTitle: admin ? "All Orders" : "My Orders",
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="notifications" focused={focused} />
          ),
          headerTitle: "Notifications",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" focused={focused} />
          ),
          headerTitle: "Profile",
        }}
      />
    </Tabs>
  );
}
