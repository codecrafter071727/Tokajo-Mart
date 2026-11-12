"use client";

import type { AdminUser } from "@qc/contracts";
import { useMemo, useState } from "react";
import { BlockDialog } from "../../components/user-actions";
import {
  Alert,
  Badge,
  Button,
  EmptyRow,
  LoadingRows,
  TableShell,
  th,
  td,
  Toolbar,
} from "../../components/ui";
import { joinedDate } from "../../lib/dates";
import { errorMessage } from "../../lib/gw";
import { useDebounced, useUserList } from "../../lib/users";

export function Customers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const q = useDebounced(search.trim());
  const list = useUserList({ role: "customer", q: q || undefined, status: status || undefined });
  const customers = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const [blocking, setBlocking] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <Toolbar>
        <input
          type="search"
          aria-label="Search customers"
          placeholder="Search by name or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72 rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </Toolbar>
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {list.isError ? <Alert>{errorMessage(list.error)}</Alert> : null}

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Customer", "Phone", "Status", "Joined", ""].map((h, i) => (
                <th key={h || i} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.isPending ? (
              <LoadingRows colSpan={5} />
            ) : customers.length === 0 ? (
              <EmptyRow colSpan={5}>
                {q || status ? "No customers match." : "No customers yet."}
              </EmptyRow>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-brand-50/40">
                  <td className={`${td} font-bold`}>{c.name || "No name"}</td>
                  <td className={`${td} tabular-nums`}>{c.phone ?? ""}</td>
                  <td className={td}>
                    <Badge tone={c.status === "blocked" ? "red" : "green"}>
                      {c.status === "blocked" ? "Blocked" : "Active"}
                    </Badge>
                  </td>
                  <td className={`${td} text-ink-500`}>{joinedDate(c.createdAt)}</td>
                  <td className={`${td} text-right`}>
                    <Button small variant="ghost" onClick={() => setBlocking(c)}>
                      {c.status === "blocked" ? "Unblock" : "Block"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>
      {list.hasNextPage ? (
        <div className="mt-4">
          <Button disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            {list.isFetchingNextPage ? "Loading" : "Load more"}
          </Button>
        </div>
      ) : null}

      {blocking ? (
        <BlockDialog
          user={blocking}
          onClose={() => setBlocking(null)}
          onDone={(message) => {
            setBlocking(null);
            setNotice(message);
          }}
        />
      ) : null}
    </>
  );
}
