"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ACTIONS_SLOT } from "./ui";

/**
 * Puts buttons into the page header from inside a client component, so the primary action sits
 * top right on every page even when the state it needs lives further down.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(ACTIONS_SLOT)), []);
  return slot ? createPortal(children, slot) : null;
}
