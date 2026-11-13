import type { ReactNode } from "react";
import { cn } from "./core";

/** A grey block that pulses: what a page shows in its own shape while its data loads, so a click answers at once. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("animate-pulse rounded-md bg-line/70", className)} />
);

/** Announces the loading state once, for screen readers; the blocks themselves are hidden from them. */
const Loading = ({ children, label = "Loading" }: { children: ReactNode; label?: string }) => (
  <div role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

export const HeaderSkeleton = ({ actions = true }: { actions?: boolean }) => (
  <div className="mb-6 flex items-start justify-between gap-4">
    <div className="space-y-2.5">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
    {actions && <Skeleton className="h-9 w-32" />}
  </div>
);

const CardBox = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>{children}</div>
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }, (_, i) => (
      <CardBox key={i}>
        <div className="mb-4 flex items-start justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-9" />
        </div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-3 h-3 w-40" />
      </CardBox>
    ))}
  </div>
);

export const TableSkeleton = ({
  rows = 8,
  cols = 6,
  toolbar = true,
}: {
  rows?: number;
  cols?: number;
  toolbar?: boolean;
}) => (
  <div className="rounded-xl border border-line bg-surface">
    {toolbar && (
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-56" />
      </div>
    )}
    <div className="border-b border-line bg-surface-2/60 px-4 py-3">
      <div className="grid gap-4" style={{ gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)` }}>
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="border-b border-line px-4 py-3.5 last:border-b-0">
        <div
          className="grid items-center gap-4"
          style={{ gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)` }}
        >
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {Array.from({ length: cols - 1 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-4/5" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const CardsSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, i) => (
      <CardBox key={i}>
        <div className="mb-4 flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, j) => (
            <div key={j} className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </CardBox>
    ))}
  </div>
);

export const OverviewSkeleton = () => (
  <Loading label="Loading the overview">
    <HeaderSkeleton />
    <div className="space-y-6">
      <StatsSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <CardBox className="lg:col-span-2">
          <Skeleton className="mb-1 h-5 w-32" />
          <Skeleton className="mb-6 h-3 w-24" />
          <Skeleton className="h-[240px] w-full" />
        </CardBox>
        <CardBox>
          <Skeleton className="mb-1 h-5 w-28" />
          <Skeleton className="mb-6 h-3 w-24" />
          <Skeleton className="mx-auto size-[170px] rounded-full" />
        </CardBox>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <CardBox className="lg:col-span-2">
          <Skeleton className="mb-5 h-5 w-36" />
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardBox>
        <CardBox className="lg:col-span-3">
          <Skeleton className="mb-5 h-5 w-28" />
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardBox>
      </div>
    </div>
  </Loading>
);

export const ListPageSkeleton = ({
  label = "Loading",
  cols = 6,
  rows = 8,
}: {
  label?: string;
  cols?: number;
  rows?: number;
}) => (
  <Loading label={label}>
    <HeaderSkeleton />
    <TableSkeleton cols={cols} rows={rows} />
  </Loading>
);

export const CardsPageSkeleton = ({
  label = "Loading",
  count = 3,
}: {
  label?: string;
  count?: number;
}) => (
  <Loading label={label}>
    <HeaderSkeleton />
    <CardsSkeleton count={count} />
  </Loading>
);

export const DetailPageSkeleton = ({ label = "Loading" }: { label?: string }) => (
  <Loading label={label}>
    <div className="mb-6 space-y-3">
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-8 w-80 max-w-full" />
    </div>
    <div className="mb-6 flex gap-2 border-b border-line pb-px">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="mb-2 h-6 w-24" />
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <CardBox>
          <Skeleton className="mb-5 h-5 w-24" />
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-5 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardBox>
        <CardBox>
          <Skeleton className="mb-5 h-5 w-32" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </CardBox>
      </div>
      <CardBox>
        <Skeleton className="mb-5 h-5 w-28" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </CardBox>
    </div>
  </Loading>
);
