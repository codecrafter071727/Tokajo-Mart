"use client";

import { useEffect, useRef, useState } from "react";
import {
  audioReady,
  findNewOrders,
  playChime,
  saveSoundEnabled,
  soundEnabled,
  unlockAudio,
} from "../lib/chime";
import { useQueue } from "../lib/live";
import { Icon } from "./ui";

const shortNumber = (n: string) => `#${n.split("-").pop() ?? n}`;

/** Swaps the tab title with a new order notice until someone looks at the screen. */
function useTitleFlash() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const original = useRef<string | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (original.current !== null) document.title = original.current;
    original.current = null;
  };

  useEffect(() => {
    const onVisible = () => {
      // Seen: stop a few seconds after the tab comes back into view
      if (document.visibilityState === "visible" && timer.current) setTimeout(stop, 6000);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, []);

  return (count: number) => {
    if (original.current === null) original.current = document.title;
    if (timer.current) clearInterval(timer.current);
    const notice = `(${count}) New order${count === 1 ? "" : "s"}`;
    let on = true;
    document.title = notice;
    timer.current = setInterval(() => {
      on = !on;
      document.title = on ? notice : (original.current ?? "");
    }, 1000);
    // A visible screen does not need to blink for long
    if (document.visibilityState === "visible") setTimeout(stop, 10_000);
  };
}

/**
 * Watches the live queue and announces new confirmed orders: a chime, a blinking tab title and a
 * short banner. Lives in the top bar, so it runs on every page.
 */
export function OrderAlerts() {
  const queue = useQueue();
  const known = useRef<Set<string> | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = useTitleFlash();

  useEffect(() => {
    setEnabled(soundEnabled());
    setUnlocked(audioReady());
    // Any touch, click or key on the page unlocks audio, so the prompt is rarely needed
    const unlock = () => {
      void unlockAudio().then((ok) => {
        if (ok) {
          setUnlocked(true);
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        }
      });
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const items = queue.data?.items;
  useEffect(() => {
    if (!items) return;
    const { fresh, known: next } = findNewOrders(known.current, items);
    known.current = next;
    if (fresh.length === 0) return;
    const numbers = items.filter((o) => fresh.includes(o.id)).map((o) => shortNumber(o.number));
    const played = enabled && playChime(fresh.length);
    flash(fresh.length);
    setToast(
      fresh.length === 1
        ? `New order ${numbers[0]}`
        : `${fresh.length} new orders: ${numbers.join(", ")}`,
    );
    // A visible trace for checks on devices where sound is muted
    document.documentElement.dataset.lastChime = `${new Date().toISOString()} ${fresh.length} ${played ? "played" : "silent"}`;
    console.info(`[queue] ${fresh.length} new order(s), chime ${played ? "played" : "not played"}`);
    // flash is recreated each render; the queue data is what should trigger this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, enabled]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    saveSoundEnabled(next);
    if (next) {
      void unlockAudio().then((ok) => {
        setUnlocked(ok);
        if (ok) playChime(1);
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={
          enabled ? "New order sound is on. Turn it off" : "New order sound is off. Turn it on"
        }
        title={enabled ? "Sound on" : "Sound off"}
        className={`grid size-10 place-items-center rounded-lg transition ${
          enabled ? "text-brand-900 hover:bg-brand-50" : "text-ink-500 hover:bg-surface"
        }`}
      >
        <Icon name={enabled ? "sound" : "mute"} />
      </button>

      {enabled && !unlocked ? (
        <button
          type="button"
          onClick={() => void unlockAudio().then((ok) => setUnlocked(ok))}
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-base font-bold text-white shadow-lg"
        >
          <Icon name="sound" />
          Tap to turn on new order sounds
        </button>
      ) : null}

      <div aria-live="assertive" className="pointer-events-none fixed right-4 top-20 z-40">
        {toast ? (
          <div className="flex items-center gap-3 rounded-xl bg-brand-600 px-4 py-3 text-base font-extrabold text-ink-900 shadow-lg">
            <Icon name="box" />
            {toast}
          </div>
        ) : null}
      </div>
    </>
  );
}
