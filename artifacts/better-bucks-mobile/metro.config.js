const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * @stripe/stripe-react-native imports several react-native internal modules
 * (codegenNativeCommands, codegenNativeComponent, etc.) that are native-only
 * and not available when Metro bundles for the web platform.  Rather than
 * blocking all web builds, resolve any import of
 * react-native/Libraries/** on web to an empty module.
 * Native platform bundles are completely unaffected.
 */
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    moduleName.startsWith("react-native/Libraries/")
  ) {
    return { type: "empty" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
