import type { ConfigContext, ExpoConfig } from "expo/config";

type AppEnv = "development" | "staging" | "production";

const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;

const variants: Record<AppEnv, { name: string; idSuffix: string }> = {
  development: { name: "QC Rider (Dev)", idSuffix: ".dev" },
  staging: { name: "QC Rider (Staging)", idSuffix: ".staging" },
  production: { name: "QC Rider", idSuffix: "" },
};

const variant = variants[APP_ENV];
const appId = `com.thehxd.qc.rider${variant.idSuffix}`;

const locationReason =
  "Your location is shared with the store and the customer while you are on an active delivery.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: "qc-rider",
  scheme: "qcrider",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  runtimeVersion: { policy: "appVersion" },
  ios: {
    bundleIdentifier: appId,
    supportsTablet: false,
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST,
    config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY },
    infoPlist: {
      UIBackgroundModes: ["location", "remote-notification"],
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
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: locationReason,
        locationWhenInUsePermission: locationReason,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-camera",
      { cameraPermission: "The camera is used to capture proof-of-delivery photos." },
    ],
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    [
      "@sentry/react-native",
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT_RIDER },
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
