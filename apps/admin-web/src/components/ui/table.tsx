import type { ComponentProps, ReactNode } from "react";
import { cn } from "./core";

/** A dense data table: sticky header, row hover, numbers right-aligned in tabular figures. Scrolls sideways on a phone. */
export function Table({
  children,
  className,
  maxHeight,
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div className={cn("overflow-auto", className)} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full min-w-max border-separate border-spacing-0 text-left text-[13px]">
        {children}
      </table>
    </div>
  );
}
export const THead = ({ children }: { children: ReactNode }) => <thead>{children}</thead>;
export const TBody = ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>;

export function Th({
  children,
  align,
  className,
}: {
  children?: ReactNode;
  align?: "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-10 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted first:rounded-tl-xl last:rounded-tr-xl",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({
  children,
  align,
  className,
  muted,
  num,
  ...p
}: ComponentProps<"td"> & { align?: "right" | "center"; muted?: boolean; num?: boolean }) {
  return (
    <td
      {...p}
      className={cn(
        "border-b border-line px-4 py-2.5 align-middle group-last:border-b-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        (num || align === "right") && "tnum",
        muted ? "text-muted" : "text-ink",
        className,
      )}
    >
      {children}
    </td>
  );
}
export const Tr = ({ children, className }: { children: ReactNode; className?: string }) => (
  <tr className={cn("group transition-colors hover:bg-surface-2", className)}>{children}</tr>
);
