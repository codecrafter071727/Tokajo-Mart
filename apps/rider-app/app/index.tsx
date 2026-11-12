import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useSession } from "../src/store/session";

/** True once the saved session has been read, so a signed in rider is not flashed the login. */
function useSessionReady() {
  const [ready, setReady] = useState(useSession.persist.hasHydrated());
  useEffect(() => {
    if (useSession.persist.hasHydrated()) setReady(true);
    return useSession.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

/** Signed in riders land on their jobs, everyone else on login. */
export default function Index() {
  const rider = useSession((s) => s.rider);
  const ready = useSessionReady();
  if (!ready) return null;
  return <Redirect href={rider ? "/(tabs)" : "/(auth)/login"} />;
}
