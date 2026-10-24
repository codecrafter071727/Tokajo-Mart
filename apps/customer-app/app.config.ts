import type { ConfigContext, ExpoConfig } from "expo/config";

type AppEnv = "development" | "staging" | "production";

const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;

const variants: Record<AppEnv, { name: string; idSuffix: string }> = {
  development: { name: "QC (Dev)", idSuffix: ".dev" },
  staging: { name: "QC (Staging)", idSuffix: ".staging" },
  production: { name: "QC", idSuffix: "" },
};

const variant = variants[APP_ENV];
const appId = `com.thehxd.qc.customer${variant.idSuffix}`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: "qc-customer",
  scheme: "qccustomer",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  runtimeVersion: { policy: "appVersion" },
  ios: {
    bundleIdentifier: appId,
    supportsTablet: false,
    usesAppleSignIn: true,
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST,
    config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Your location is used to find the nearest store and set your delivery address.",
    },
  },
  android: {
    package: appId,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-image",
    "expo-splash-screen",
    "expo-apple-authentication",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Your location is used to find the nearest store and set your delivery address.",
      },
    ],
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    "@react-native-google-signin/google-signin",
    [
      "@sentry/react-native",
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT_CUSTOMER },
    ],
  ],
  experiments: { typedRoutes: true },
  updates: process.env.EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` }
    : undefined,
  extra: {
    appEnv: APP_ENV,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
