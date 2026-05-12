import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { brand } from "@/constants/colors";

export default function SignupPaymentScreen() {
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.heading}>Native build required</Text>
        <Text style={styles.body}>
          Payment setup uses Stripe&apos;s native card UI, which only runs in a
          native build of the app — not in Expo Go on web.
        </Text>
        <Text style={styles.body}>
          To complete org signup, open the app on a physical device or simulator
          using a development build.
        </Text>
        <Button
          title="Go back"
          onPress={() => router.back()}
          style={{ marginTop: 24 }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  heading: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  body: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
});
