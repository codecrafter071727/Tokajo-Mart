"use client";

import type { Banner } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ConfirmModal,
  ErrorBanner,
  primaryButton,
  secondaryButton,
  Toast,
} from "../../components/catalog-ui";
import { Badge } from "../../components/ui";
import { catalogAdmin } from "../../lib/catalog-admin";
import { BannerDialog } from "./banner-dialog";
import { BannerPreview } from "./banner-preview";

type State = { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" };

/** Whether customers can see the banner right now, and if not, why. */
function stateOf(b: Banner, now: Date): State {
  if (!b.active) return { label: "Hidden", tone: "gray" };
  if (b.startsAt && new Date(b.startsAt) > now) return { label: "Scheduled", tone: "blue" };
  if (b.endsAt && new Date(b.endsAt) <= now) return { label: "Ended", tone: "red" };
  return { label: "Live", tone: "green" };
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

export function BannersPanel() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogAdmin.categories });
  const banners = useQuery({ queryKey: ["admin-banners"], queryFn: catalogAdmin.banners });
  const categoryNames = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  const list = useMemo(
    () =>
      [...(banners.data ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
      ),
    [banners.data],
  );

  const refresh = () => client.invalidateQueries({ queryKey: ["admin-banners"] });

  const toggle = useMutation({
    mutationFn: (b: Banner) => catalogAdmin.updateBanner(b.id, { active: !b.active }),
    onSuccess: async (_r, b) => {
      await refresh();
      setToast(b.active ? `Hid ${b.title}` : `Activated ${b.title}`);
    },
  });

  // Moving one place renumbers the whole list in steps of 10, so equal numbers never get stuck
  const move = useMutation({
    mutationFn: async ({ index, by }: { index: number; by: -1 | 1 }) => {
      const order = [...list];
      const target = index + by;
      if (target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target] as Banner, order[index] as Banner];
      await Promise.all(
        order.map((b, i) =>
          b.sortOrder === i * 10 ? null : catalogAdmin.updateBanner(b.id, { sortOrder: i * 10 }),
        ),
      );
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (b: Banner) => catalogAdmin.deleteBanner(b.id),
    onSuccess: async (_r, b) => {
      await refresh();
      setToast(`Deleted ${b.title}`);
      setDeleting(null);
    },
  });

  if (banners.isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-800">Could not load banners.</p>
        <button
          type="button"
          onClick={() => void banners.refetch()}
          className={`mt-3 ${primaryButton}`}
        >
          Try again
        </button>
      </div>
    );
  }

  const nextSort = list.reduce((max, b) => Math.max(max, b.sortOrder), 0) + 10;
  const now = new Date();

  const describeLink = (b: Banner) => {
    if (b.linkType === "none" || !b.linkTarget) return "No link";
    if (b.linkType === "category")
      return `Category: ${categoryNames.get(b.linkTarget) ?? b.linkTarget}`;
    return `Product: ${b.linkTarget}`;
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <p className="text-sm text-ink-500">
          Customers see live banners from the top of this list down. Use the arrows to reorder.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={`ml-auto ${primaryButton}`}
        >
          New banner
        </button>
      </div>

      <ErrorBanner error={move.error ?? toggle.error} />

      {banners.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-line bg-white py-12 text-center text-sm text-ink-500">
          No banners yet. Add one and it shows on the customer home screen.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((b, index) => {
            const state = stateOf(b, now);
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4"
              >
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${b.title} up`}
                    disabled={index === 0 || move.isPending}
                    onClick={() => move.mutate({ index, by: -1 })}
                    className={`${secondaryButton} !px-2 !py-1`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${b.title} down`}
                    disabled={index === list.length - 1 || move.isPending}
                    onClick={() => move.mutate({ index, by: 1 })}
                    className={`${secondaryButton} !px-2 !py-1`}
                  >
                    ▼
                  </button>
                </div>
                <div className="w-64 shrink-0">
                  <BannerPreview
                    title={b.title}
                    subtitle={b.subtitle}
                    imageUrl={b.imageUrl}
                    color={b.color}
                  />
                </div>
                <div className="min-w-40 flex-1 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone={state.tone}>{state.label}</Badge>
                    <span className="text-xs text-ink-500">Order {b.sortOrder}</span>
                  </div>
                  <p className="text-ink-700">{describeLink(b)}</p>
                  {b.startsAt || b.endsAt ? (
                    <p className="text-xs text-ink-500">
                      {when(b.startsAt) ?? "Now"} to {when(b.endsAt) ?? "no end"}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => toggle.mutate(b)}
                    disabled={toggle.isPending}
                    className={`${secondaryButton} !px-3 !py-1.5`}
                  >
                    {b.active ? "Hide" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className={`${secondaryButton} !px-3 !py-1.5`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(b)}
                    className={`${secondaryButton} !px-3 !py-1.5`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <BannerDialog
          banner={editing === "new" ? null : editing}
          categories={categories.data ?? []}
          nextSortOrder={nextSort}
          onClose={() => setEditing(null)}
          onSaved={setToast}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Delete this banner?"
          body={
            <>
              <strong>{deleting.title}</strong> is removed for good. To take it off the app for now
              without losing it, use Hide instead.
            </>
          }
          confirmLabel="Delete"
          danger
          pending={remove.isPending}
          error={remove.error}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => {
            remove.reset();
            setDeleting(null);
          }}
        />
      ) : null}
      <Toast message={toast} />
    </>
  );
}
