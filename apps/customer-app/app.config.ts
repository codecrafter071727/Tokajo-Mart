import fs from "node:fs";
import path from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

// This phone only has Expo Go. The chooser page's Development Build button
// has no installed app to open, so it stays on a loading screen.
process.env.EXPO_NO_REDIRECT_PAGE ??= "1";

type AppEnv = "development" | "staging" | "production";

function existingProjectFile(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  return fs.existsSync(path.resolve(process.cwd(), filePath)) ? filePath : undefined;
}

const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;

const variants: Record<AppEnv, { name: string; idSuffix: string }> = {
  development: { name: "QC (Dev)", idSuffix: ".dev" },
  staging: { name: "QC (Staging)", idSuffix: ".staging" },
  production: { name: "QC", idSuffix: "" },
};

const variant = variants[APP_ENV];
const appId = `com.thehxd.qc.customer${variant.idSuffix}`;
const googleServicesPlist = existingProjectFile(process.env.GOOGLE_SERVICES_PLIST);
const googleServicesJson = existingProjectFile(process.env.GOOGLE_SERVICES_JSON);
// Firebase's config plugin refuses to prebuild unless both Google service files exist.
const hasGoogleServices = Boolean(googleServicesPlist && googleServicesJson);

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
    ...(googleServicesPlist ? { googleServicesFile: googleServicesPlist } : {}),
    config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Your location is used to find the nearest store and set your delivery address.",
    },
  },
  android: {
    package: appId,
    ...(googleServicesJson ? { googleServicesFile: googleServicesJson } : {}),
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-image",
    "expo-splash-screen",
    "expo-status-bar",
    "expo-apple-authentication",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Your location is used to find the nearest store and set your delivery address.",
      },
    ],
    ...(hasGoogleServices
      ? ([
          ["expo-build-properties", { ios: { useFrameworks: "static" } }],
          "@react-native-firebase/app",
          "@react-native-firebase/messaging",
          "@react-native-google-signin/google-signin",
        ] as NonNullable<ExpoConfig["plugins"]>)
      : []),
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
