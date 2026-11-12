"use client";

import type { Category } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ConfirmModal,
  primaryButton,
  secondaryButton,
  Thumb,
  Toast,
} from "../../components/catalog-ui";
import { TableShell, td, th } from "../../components/ui";
import { catalogAdmin } from "../../lib/catalog-admin";
import { CategoryDialog } from "./category-dialog";

export function CategoriesPanel() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogAdmin.categories });
  const remove = useMutation({
    mutationFn: (category: Category) => catalogAdmin.deleteCategory(category.id),
    onSuccess: async (_r, category) => {
      await client.invalidateQueries({ queryKey: ["categories"] });
      setToast(`Deleted ${category.name}`);
      setDeleting(null);
    },
  });

  if (categories.isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-800">Could not load categories.</p>
        <button
          type="button"
          onClick={() => void categories.refetch()}
          className={`mt-3 ${primaryButton}`}
        >
          Try again
        </button>
      </div>
    );
  }

  const list = categories.data ?? [];
  const nextSort = list.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 10;

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <p className="text-sm text-ink-500">
          Categories show on the customer home screen in this order. Lower numbers come first.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className={`ml-auto ${primaryButton}`}
        >
          New category
        </button>
      </div>

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Category", "Colour", "Order", ""].map((h) => (
                <th key={h || "actions"} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.isPending
              ? Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className={td} colSpan={4}>
                      <div className="h-8 animate-pulse rounded bg-surface" />
                    </td>
                  </tr>
                ))
              : list.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line last:border-0 hover:bg-brand-50/40"
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Thumb
                          imageUrl={c.imageUrl}
                          emoji={c.emoji}
                          fit={c.imageFit}
                          color={c.color}
                        />
                        <div>
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-xs text-ink-500">{c.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-2 text-ink-500">
                        <span
                          className="size-4 rounded border border-line"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.color}
                      </span>
                    </td>
                    <td className={`${td} tabular-nums`}>{c.sortOrder}</td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className={`${secondaryButton} mr-2 !px-3 !py-1.5`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(c)}
                        className={`${secondaryButton} !px-3 !py-1.5`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            {!categories.isPending && list.length === 0 ? (
              <tr>
                <td className={`${td} py-10 text-center text-ink-500`} colSpan={4}>
                  No categories yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>

      {editing ? (
        <CategoryDialog
          category={editing === "new" ? null : editing}
          nextSortOrder={nextSort}
          onClose={() => setEditing(null)}
          onSaved={setToast}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Delete this category?"
          body={
            <>
              <strong>{deleting.name}</strong> is removed from the app. A category that still has
              products on sale cannot be deleted: archive or move those products first.
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
