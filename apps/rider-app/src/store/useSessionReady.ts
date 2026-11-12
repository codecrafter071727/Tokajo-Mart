import { useEffect, useState } from "react";
import { useSession } from "./session";

/** True once the saved session has been read, so a signed in rider is not sent to the login. */
export function useSessionReady() {
  const [ready, setReady] = useState(useSession.persist.hasHydrated());
  useEffect(() => {
    if (useSession.persist.hasHydrated()) setReady(true);
    return useSession.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}
