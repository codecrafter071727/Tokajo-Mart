"use client";

import type { AdminProduct } from "@qc/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ConfirmModal,
  fieldClass,
  primaryButton,
  secondaryButton,
  Thumb,
  Toast,
} from "../../components/catalog-ui";
import { Badge, TableShell, td, th } from "../../components/ui";
import { rupees } from "../../lib/api";
import { catalogAdmin } from "../../lib/catalog-admin";
import { ProductDialog } from "./product-dialog";

export function CatalogTable() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ product: AdminProduct; restore: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogAdmin.categories });
  const products = useInfiniteQuery({
    queryKey: ["admin-products", debounced, categoryId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      catalogAdmin.products(
        { q: debounced || undefined, categoryId: categoryId || undefined },
        pageParam,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const names = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );
  const all = useMemo(() => products.data?.pages.flatMap((p) => p.items) ?? [], [products.data]);
  const rows = showArchived ? all : all.filter((p) => !p.archived);
  const archivedCount = all.filter((p) => p.archived).length;

  const toggle = useMutation({
    mutationFn: ({ product, restore }: { product: AdminProduct; restore: boolean }) =>
      restore ? catalogAdmin.restoreProduct(product.id) : catalogAdmin.archiveProduct(product.id),
    onSuccess: async (_r, { product, restore }) => {
      await client.invalidateQueries({ queryKey: ["admin-products"] });
      setToast(restore ? `Restored ${product.name}` : `Archived ${product.name}`);
      setConfirm(null);
    },
  });

  if (products.isError || categories.isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-800">Could not load the catalog.</p>
        <p className="mt-1 text-sm text-red-800">
          Check that the catalog service is running, then try again.
        </p>
        <button
          type="button"
          onClick={() => {
            void products.refetch();
            void categories.refetch();
          }}
          className={`mt-3 ${primaryButton}`}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          className="w-72 rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className={`${fieldClass} !mt-0 !w-auto`}
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          Show archived
        </label>
        <span className="ml-auto text-sm text-ink-500">
          {products.isPending ? "Loading" : `${rows.length} shown`}
        </span>
        <button
          type="button"
          onClick={() => setEditing("new")}
          disabled={!categories.data?.length}
          className={primaryButton}
        >
          New product
        </button>
      </div>

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Product", "Category", "Price", "MRP", "Off", "Status", ""].map((h) => (
                <th key={h || "actions"} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className={td} colSpan={7}>
                      <div className="h-8 animate-pulse rounded bg-surface" />
                    </td>
                  </tr>
                ))
              : rows.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-line last:border-0 hover:bg-brand-50/40 ${p.archived ? "opacity-60" : ""}`}
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Thumb imageUrl={p.imageUrl} emoji={p.emoji} fit={p.imageFit} />
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-ink-500">{p.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td className={td}>{names.get(p.categoryId) ?? p.categoryId}</td>
                    <td className={`${td} font-bold tabular-nums`}>{rupees(p.pricePaise)}</td>
                    <td className={`${td} tabular-nums text-ink-500`}>{rupees(p.mrpPaise)}</td>
                    <td className={td}>
                      {p.discountPercent > 0 ? (
                        <Badge tone="green">{`${p.discountPercent}%`}</Badge>
                      ) : (
                        <span className="text-ink-500">None</span>
                      )}
                    </td>
                    <td className={td}>
                      {p.archived ? (
                        <Badge tone="gray">Archived</Badge>
                      ) : (
                        <Badge tone="green">On sale</Badge>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className={`${secondaryButton} mr-2 !px-3 !py-1.5`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ product: p, restore: p.archived })}
                        className={`${secondaryButton} !px-3 !py-1.5`}
                      >
                        {p.archived ? "Restore" : "Archive"}
                      </button>
                    </td>
                  </tr>
                ))}
            {!products.isPending && rows.length === 0 ? (
              <tr>
                <td className={`${td} py-10 text-center text-ink-500`} colSpan={7}>
                  {archivedCount > 0 && !showArchived
                    ? "Only archived products match. Turn on Show archived to see them."
                    : "No products match."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>

      {products.hasNextPage ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void products.fetchNextPage()}
            disabled={products.isFetchingNextPage}
            className={secondaryButton}
          >
            {products.isFetchingNextPage ? "Loading" : "Load more"}
          </button>
        </div>
      ) : null}

      {editing ? (
        <ProductDialog
          product={editing === "new" ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={setToast}
        />
      ) : null}

      {confirm ? (
        <ConfirmModal
          title={confirm.restore ? "Restore this product?" : "Archive this product?"}
          body={
            confirm.restore ? (
              <>
                <strong>{confirm.product.name}</strong> goes back on sale and customers can find and
                order it again.
              </>
            ) : (
              <>
                <strong>{confirm.product.name}</strong> is taken off sale. Customers will not see it
                or be able to order it. Past orders keep their details, and you can restore it any
                time.
              </>
            )
          }
          confirmLabel={confirm.restore ? "Restore" : "Archive"}
          danger={!confirm.restore}
          pending={toggle.isPending}
          error={toggle.error}
          onConfirm={() => toggle.mutate(confirm)}
          onClose={() => {
            toggle.reset();
            setConfirm(null);
          }}
        />
      ) : null}
      <Toast message={toast} />
    </>
  );
}
