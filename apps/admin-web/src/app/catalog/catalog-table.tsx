"use client";

import type { AdminProduct } from "@qc/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal, Thumb, Toast } from "../../components/catalog-ui";
import { PageActions } from "../../components/page-actions";
import {
  Alert,
  Badge,
  Button,
  EmptyRow,
  LoadingRows,
  rowAction,
  rowActionDanger,
  SearchInput,
  selectCls,
  TableShell,
  td,
  tdActions,
  tdNum,
  th,
  thNum,
  Toggle,
  Toolbar,
} from "../../components/kit";
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
      <div className="space-y-3">
        <Alert>Could not load the catalog. Check that the catalog service is running.</Alert>
        <Button
          onClick={() => {
            void products.refetch();
            void categories.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageActions>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => setEditing("new")}
          disabled={!categories.data?.length}
        >
          New product
        </Button>
      </PageActions>
      <Toolbar>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          aria-label="Search products"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className={selectCls}
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} />
        <span className="ml-auto text-sm text-muted tabular-nums">
          {products.isPending ? "Loading" : `${rows.length} shown`}
        </span>
      </Toolbar>

      <TableShell>
        <table>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={thNum}>Price</th>
              <th className={`${thNum} hidden xl:table-cell`}>MRP</th>
              <th className={`${thNum} hidden xl:table-cell`}>Off</th>
              <th className={th}>Status</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.isPending ? (
              <LoadingRows colSpan={7} rows={8} />
            ) : (
              rows.map((p) => (
                <tr key={p.id} className={p.archived ? "opacity-60" : ""}>
                  <td className={`${td} min-w-60`}>
                    <div className="flex items-center gap-3">
                      <Thumb imageUrl={p.imageUrl} emoji={p.emoji} fit={p.imageFit} />
                      <div>
                        <div className="font-medium text-ink">{p.name}</div>
                        <div className="text-xs text-muted">{p.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>
                    {names.get(p.categoryId) ?? p.categoryId}
                  </td>
                  <td className={tdNum}>
                    <div className="font-semibold">{rupees(p.pricePaise)}</div>
                    {p.mrpPaise > p.pricePaise ? (
                      <div className="text-xs text-muted line-through xl:hidden">
                        {rupees(p.mrpPaise)}
                      </div>
                    ) : null}
                  </td>
                  <td className={`${tdNum} hidden text-muted xl:table-cell`}>
                    {p.mrpPaise > p.pricePaise ? (
                      <span className="line-through">{rupees(p.mrpPaise)}</span>
                    ) : (
                      rupees(p.mrpPaise)
                    )}
                  </td>
                  <td className={`${tdNum} hidden xl:table-cell`}>
                    {p.discountPercent > 0 ? (
                      <span className="font-semibold text-accent">{`${p.discountPercent}%`}</span>
                    ) : (
                      <span className="text-faint">0%</span>
                    )}
                  </td>
                  <td className={td}>
                    {p.archived ? (
                      <Badge tone="gray">Archived</Badge>
                    ) : (
                      <Badge tone="green">On sale</Badge>
                    )}
                  </td>
                  <td className={tdActions}>
                    <button type="button" onClick={() => setEditing(p)} className={rowAction}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ product: p, restore: p.archived })}
                      className={p.archived ? rowAction : rowActionDanger}
                    >
                      {p.archived ? "Restore" : "Archive"}
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!products.isPending && rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                {archivedCount > 0 && !showArchived
                  ? "Only archived products match. Turn on Show archived to see them."
                  : "No products match."}
              </EmptyRow>
            ) : null}
          </tbody>
        </table>
      </TableShell>

      {products.hasNextPage ? (
        <div className="mt-4 text-center">
          <Button
            onClick={() => void products.fetchNextPage()}
            disabled={products.isFetchingNextPage}
          >
            {products.isFetchingNextPage ? "Loading" : "Load more"}
          </Button>
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
