"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders a server page every few seconds while the tab is visible, so live lists stay live. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
