"use client";

import type { Category } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmModal, Thumb, Toast } from "../../components/catalog-ui";
import { PageActions } from "../../components/page-actions";
import {
  Alert,
  Button,
  EmptyRow,
  LoadingRows,
  rowAction,
  rowActionDanger,
  TableShell,
  td,
  tdActions,
  tdNum,
  th,
  thNum,
} from "../../components/kit";
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
      <div className="space-y-3">
        <Alert>Could not load categories.</Alert>
        <Button onClick={() => void categories.refetch()}>Try again</Button>
      </div>
    );
  }

  const list = categories.data ?? [];
  const nextSort = list.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 10;

  return (
    <>
      <PageActions>
        <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>
          New category
        </Button>
      </PageActions>
      <p className="mb-4 text-sm text-muted">
        Categories show on the customer home screen in this order. Lower numbers come first.
      </p>

      <TableShell>
        <table>
          <thead>
            <tr>
              <th className={th}>Category</th>
              <th className={th}>Colour</th>
              <th className={thNum}>Order</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.isPending ? (
              <LoadingRows colSpan={4} />
            ) : (
              list.map((c) => (
                <tr key={c.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Thumb
                        imageUrl={c.imageUrl}
                        emoji={c.emoji}
                        fit={c.imageFit}
                        color={c.color}
                      />
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted">{c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span
                        className="size-4 rounded border border-line"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.color}
                    </span>
                  </td>
                  <td className={tdNum}>{c.sortOrder}</td>
                  <td className={tdActions}>
                    <button type="button" onClick={() => setEditing(c)} className={rowAction}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(c)}
                      className={rowActionDanger}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!categories.isPending && list.length === 0 ? (
              <EmptyRow colSpan={4}>No categories yet.</EmptyRow>
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
