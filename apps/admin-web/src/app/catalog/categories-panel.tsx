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
import { ChevronDown, ChevronUp } from "../../components/ui/icons";
import { catalogAdmin } from "../../lib/catalog-admin";
import { CategoryDialog } from "./category-dialog";
import { categoryTree, moveWithinSiblings } from "./category-tree";

export function CategoriesPanel() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Category | { parentId: string } | "new" | null>(null);
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

  const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const updates = moveWithinSiblings(categories.data ?? [], id, direction);
      for (const u of updates) await catalogAdmin.updateCategory(u.id, { sortOrder: u.sortOrder });
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["categories"] }),
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
  const tree = categoryTree(list);
  const nextSort = list.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 10;
  const rows = tree.flatMap((root) => [
    {
      category: root as Category,
      depth: 0,
      first: root.id === tree[0]?.id,
      last: root.id === tree.at(-1)?.id,
      childCount: root.children.length,
    },
    ...root.children.map((child, i) => ({
      category: child,
      depth: 1,
      first: i === 0,
      last: i === root.children.length - 1,
      childCount: 0,
    })),
  ]);

  return (
    <>
      <PageActions>
        <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>
          New category
        </Button>
      </PageActions>
      <p className="mb-4 text-sm text-muted">
        Categories show in the app in this order. Use the arrows to move one up or down. Sub
        categories show as a rail inside their parent, like Blinkit.
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
              rows.map(({ category: c, depth, first, last, childCount }) => (
                <tr key={c.id} className={depth ? "bg-surface-2/40" : undefined}>
                  <td className={td}>
                    <div className={`flex items-center gap-3 ${depth ? "pl-8" : ""}`}>
                      {depth ? (
                        <span aria-hidden className="-ml-5 text-faint">
                          └
                        </span>
                      ) : null}
                      <Thumb
                        imageUrl={c.imageUrl}
                        emoji={c.emoji}
                        fit={c.imageFit}
                        color={c.color}
                      />
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted">
                          {c.id}
                          {childCount ? ` · ${childCount} sub categories` : ""}
                        </div>
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
                  <td className={tdNum}>
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${c.name} up`}
                        disabled={first || move.isPending}
                        onClick={() => move.mutate({ id: c.id, direction: -1 })}
                        className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${c.name} down`}
                        disabled={last || move.isPending}
                        onClick={() => move.mutate({ id: c.id, direction: 1 })}
                        className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                      <span className="w-10 text-right">{c.sortOrder}</span>
                    </span>
                  </td>
                  <td className={tdActions}>
                    {depth === 0 ? (
                      <button
                        type="button"
                        onClick={() => setEditing({ parentId: c.id })}
                        className={rowAction}
                      >
                        Add sub
                      </button>
                    ) : null}
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

      {move.isError ? (
        <div className="mt-3">
          <Alert>Could not change the order. Try again.</Alert>
        </div>
      ) : null}
      {editing ? (
        <CategoryDialog
          category={editing === "new" || !("id" in editing) ? null : editing}
          categories={list}
          defaultParentId={editing !== "new" && !("id" in editing) ? editing.parentId : ""}
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
