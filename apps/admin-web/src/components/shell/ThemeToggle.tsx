"use client";

import { Monitor, Moon, Sun } from "@/components/ui/icons";
import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";
const KEY = "qc-admin-theme";
const NEXT: Record<Choice, Choice> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Choice, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "Theme follows your device",
};

function apply(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** One button that cycles light, dark and system. The choice is kept in this browser; the layout's script applies it before first paint. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    let saved: Choice = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") saved = v;
    } catch {
      /* private window: stay on system */
    }
    setChoice(saved);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) ?? "system") === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next = NEXT[choice];
  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        setChoice(next);
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* not kept */
        }
        apply(next);
      }}
      aria-label={`${LABEL[choice]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={LABEL[choice]}
      className={`flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
