import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { brand } from "@/constants/colors";

export function TextField({
  label,
  error,
  ...rest
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={brand.textMuted}
        style={[styles.input, error ? { borderColor: brand.danger } : null]}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: brand.white,
    borderColor: brand.border,
    borderWidth: 1.5,
    borderRadius: 10,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: {
    color: brand.danger,
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_500Medium",
  },
});
