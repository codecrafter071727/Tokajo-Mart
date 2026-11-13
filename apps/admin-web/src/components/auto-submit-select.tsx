"use client";

import type { ReactNode } from "react";
import { selectCls } from "./ui";

/** A select inside a GET form that submits as soon as it changes, so filters need no Apply button. */
export function AutoSubmitSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={selectCls}
    >
      {children}
    </select>
  );
}
