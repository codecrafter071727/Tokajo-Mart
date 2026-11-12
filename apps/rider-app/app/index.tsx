import { Redirect } from "expo-router";
import { useSession } from "../src/store/session";
import { useSessionReady } from "../src/store/useSessionReady";

/** Signed in riders land on their jobs, everyone else on login. */
export default function Index() {
  const rider = useSession((s) => s.rider);
  const ready = useSessionReady();
  if (!ready) return null;
  return <Redirect href={rider ? "/(tabs)" : "/(auth)/login"} />;
}
