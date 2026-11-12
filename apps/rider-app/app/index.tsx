import { Redirect } from "expo-router";
import { useSession } from "../src/store/session";

/** Signed in riders land on their jobs, everyone else on login. */
export default function Index() {
  const rider = useSession((s) => s.rider);
  return <Redirect href={rider ? "/(tabs)" : "/(auth)/login"} />;
}
