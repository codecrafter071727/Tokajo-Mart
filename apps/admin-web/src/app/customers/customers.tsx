"use client";

import type { AdminUser } from "@qc/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BlockCustomerDialog } from "../../components/orders/block-dialog";
import { Avatar } from "../../components/ui/brand";
import { Badge, Button, Callout, Card, EmptyState, cn } from "../../components/ui/core";
import { Search, Users, X } from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead } from "../../components/ui/table";
import { fullDate, timeAgo } from "../../lib/format";
import { errorMessage } from "../../lib/gw";
import { useDebounced, useUserList } from "../../lib/users";

const STATUS = [
  { id: "", label: "All" },
  { id: "active", label: "Active" },
  { id: "blocked", label: "Blocked" },
];

export function Customers() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const q = useDebounced(search.trim());
  const list = useUserList(
    { role: "customer", q: q || undefined, status: status || undefined },
    50,
  );
  const customers = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const [blocking, setBlocking] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who has signed in to the customer app. Open one to see their orders and spend."
      />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <Card className="rise" flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or phone"
              aria-label="Search customers by name or phone"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-8 pl-9 text-sm text-ink shadow-card placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear the search"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div
            className="ml-auto inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[13px]"
            role="group"
            aria-label="Status"
          >
            {STATUS.map((s) => (
              <button
                key={s.id || "all"}
                type="button"
                aria-pressed={status === s.id}
                onClick={() => setStatus(s.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  status === s.id
                    ? "bg-surface text-ink shadow-card ring-1 ring-line"
                    : "text-muted hover:text-ink",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {list.isError ? (
          <div className="p-4">
            <Callout tone="bad">{errorMessage(list.error)}</Callout>
          </div>
        ) : list.isPending ? (
          <TableSkeleton cols={5} rows={8} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q || status ? "No customers match" : "No customers yet"}
          >
            {q
              ? `Nobody's name or phone matches "${q}".`
              : "Customers appear here after they sign in to the app."}
          </EmptyState>
        ) : (
          <Table maxHeight="calc(100vh - 15rem)">
            <THead>
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Joined</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  className="group cursor-pointer transition-colors hover:bg-surface-2"
                >
                  <Td>
                    <Link
                      href={`/customers/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={c.name || "Customer"} size={32} />
                      <span className="font-medium text-ink group-hover:text-accent">
                        {c.name || "No name yet"}
                      </span>
                    </Link>
                  </Td>
                  <Td className="tnum">{c.phone ?? ""}</Td>
                  <Td>
                    <Badge tone={c.status === "blocked" ? "bad" : "ok"}>
                      {c.status === "blocked" ? "Blocked" : "Active"}
                    </Badge>
                  </Td>
                  <Td muted className="hidden md:table-cell">
                    <span title={fullDate(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                  </Td>
                  <Td align="right">
                    <Button
                      size="sm"
                      variant={c.status === "blocked" ? "secondary" : "ghost"}
                      className={c.status === "blocked" ? "" : "text-bad!"}
                      onClick={(event) => {
                        event.stopPropagation();
                        setBlocking(c);
                      }}
                    >
                      {c.status === "blocked" ? "Unblock" : "Block"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
        {list.hasNextPage ? (
          <div className="border-t border-line px-4 py-3">
            <Button
              size="sm"
              pending={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </Card>

      {blocking ? (
        <BlockCustomerDialog
          user={blocking}
          onClose={() => setBlocking(null)}
          onDone={(message) => {
            setBlocking(null);
            setNotice(message);
          }}
        />
      ) : null}
    </div>
  );
}
