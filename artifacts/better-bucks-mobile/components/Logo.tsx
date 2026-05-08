import { Image, ImageStyle, StyleProp } from "react-native";

const LOGO = require("../assets/images/logo.png");

export function Logo({
  size = 96,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}
