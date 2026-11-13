"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Tell the progress bar a navigation is starting (for code that changes the address itself, such as the filter menus). */
export const startNavigation = () => window.dispatchEvent(new Event("qc:navigate"));

/**
 * A thin bar across the top while a page or a save is on its way: it starts when someone clicks an in-app link, submits a form or
 * changes a filter, and ends when the address changes (a save returns to the page with its message). It waits a moment before
 * showing, so quick changes never flicker, and gives up after 15 seconds.
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [on, setOn] = useState(false);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (delay.current) clearTimeout(delay.current);
    if (stop.current) clearTimeout(stop.current);
    delay.current = stop.current = null;
  };
  useEffect(() => {
    clear();
    setOn(false);
  }, [path, search]);
  useEffect(() => {
    const begin = () => {
      clear();
      delay.current = setTimeout(() => setOn(true), 120);
      stop.current = setTimeout(() => setOn(false), 15_000);
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin)
        return;
      if (a.pathname === location.pathname && a.search === location.search) return;
      begin();
    };
    window.addEventListener("click", click, true);
    window.addEventListener("submit", begin, true);
    window.addEventListener("qc:navigate", begin);
    return () => {
      window.removeEventListener("click", click, true);
      window.removeEventListener("submit", begin, true);
      window.removeEventListener("qc:navigate", begin);
      clear();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      role="progressbar"
      aria-hidden={!on}
      aria-label="Loading"
    >
      {on && (
        <div className="h-full w-1/3 animate-[hubbar_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      )}
    </div>
  );
}
