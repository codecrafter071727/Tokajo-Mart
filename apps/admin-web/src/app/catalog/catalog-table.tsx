"use client";

import type { AvailabilityItem, Category, Product } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Badge, TableShell, td, th } from "../../components/ui";
import { api, DEFAULT_WAREHOUSE_ID, rupees } from "../../lib/api";
import { EditProductDialog } from "./edit-product-dialog";

type Row = Product & { categoryName: string; stock: AvailabilityItem | undefined };

const column = createColumnHelper<Row>();

function StockBadge({ stock }: { stock: AvailabilityItem | undefined }) {
  if (!stock) return <Badge tone="gray">Unknown</Badge>;
  if (stock.status === "out") return <Badge tone="red">Out of stock</Badge>;
  if (stock.status === "low") return <Badge tone="amber">{`Low: ${stock.remaining} left`}</Badge>;
  return <Badge tone="green">In stock</Badge>;
}

export function CatalogTable() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<Product | null>(null);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.catalog.listCategories()).items,
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.catalog.listProducts({ limit: 100 })).items,
  });
  const productIds = products.data?.map((p) => p.id) ?? [];
  const stock = useQuery({
    queryKey: ["stock", DEFAULT_WAREHOUSE_ID, productIds.join(",")],
    enabled: productIds.length > 0,
    queryFn: async () => (await api.inventory.availability(DEFAULT_WAREHOUSE_ID, productIds)).items,
  });

  const rows: Row[] = useMemo(() => {
    const names = new Map<string, string>(
      (categories.data ?? []).map((c: Category) => [c.id, c.name]),
    );
    const stockById = new Map((stock.data ?? []).map((s) => [s.productId, s]));
    return (products.data ?? [])
      .filter((p) => categoryId === "" || p.categoryId === categoryId)
      .map((p) => ({
        ...p,
        categoryName: names.get(p.categoryId) ?? p.categoryId,
        stock: stockById.get(p.id),
      }));
  }, [products.data, categories.data, stock.data, categoryId]);

  const columns = useMemo(
    () => [
      column.accessor("name", {
        header: "Product",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.imageUrl ? (
              <img
                src={row.original.imageUrl}
                alt=""
                className="size-10 rounded-lg border border-line bg-white object-contain"
              />
            ) : (
              <span className="grid size-10 place-items-center rounded-lg border border-line bg-surface text-xl">
                {row.original.emoji}
              </span>
            )}
            <div>
              <div className="font-semibold">{row.original.name}</div>
              <div className="text-xs text-ink-500">{row.original.unit}</div>
            </div>
          </div>
        ),
      }),
      column.accessor("categoryName", { header: "Category" }),
      column.accessor("pricePaise", {
        header: "Price",
        cell: (c) => <span className="font-bold tabular-nums">{rupees(c.getValue())}</span>,
      }),
      column.accessor("mrpPaise", {
        header: "MRP",
        cell: (c) => <span className="tabular-nums text-ink-500">{rupees(c.getValue())}</span>,
      }),
      column.accessor("discountPercent", {
        header: "Off",
        cell: (c) =>
          c.getValue() > 0 ? (
            <Badge tone="green">{`${c.getValue()}%`}</Badge>
          ) : (
            <span className="text-ink-500">None</span>
          ),
      }),
      column.display({
        id: "stock",
        header: "Stock",
        cell: ({ row }) => <StockBadge stock={row.original.stock} />,
      }),
      column.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setEditing(row.original)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface"
          >
            Edit
          </button>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _id, value: string) =>
      `${row.original.name} ${row.original.unit} ${row.original.categoryName}`
        .toLowerCase()
        .includes(value.toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (products.isError || categories.isError) {
    const retry = () => {
      void products.refetch();
      void categories.refetch();
    };
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-800">Could not load the catalog.</p>
        <p className="mt-1 text-sm text-red-800">
          Check that the catalog service is running, then try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-ink-900"
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
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-ink-500">
          {products.isPending
            ? "Loading"
            : `${table.getRowModel().rows.length} of ${products.data?.length ?? 0} products`}
        </span>
      </div>

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sortable =
                    header.column.getCanSort() &&
                    header.column.id !== "actions" &&
                    header.column.id !== "stock";
                  const dir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={th}
                      aria-sort={
                        dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="font-bold uppercase"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {dir === "asc" ? " ▲" : dir === "desc" ? " ▼" : ""}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
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
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line last:border-0 hover:bg-brand-50/40"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={td}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
            {!products.isPending && table.getRowModel().rows.length === 0 ? (
              <tr>
                <td className={`${td} py-10 text-center text-ink-500`} colSpan={7}>
                  No products match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>

      {editing ? <EditProductDialog product={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
