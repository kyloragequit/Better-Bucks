import {
  ReactNode,
} from "react";
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
  rightElement,
  ...rest
}: TextInputProps & { label: string; error?: string; rightElement?: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? { borderColor: brand.danger } : null]}>
        <TextInput
          placeholderTextColor={brand.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {rightElement ? <View style={styles.rightSlot}>{rightElement}</View> : null}
      </View>
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.white,
    borderColor: brand.border,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  input: {
    flex: 1,
    color: brand.text,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rightSlot: {
    paddingRight: 12,
  },
  error: {
    color: brand.danger,
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_500Medium",
  },
});
