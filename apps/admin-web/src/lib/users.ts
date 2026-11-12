"use client";

import type { AdminUser, AdminWarehouse } from "@qc/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { gw, qs } from "./gw";

export type UserFilter = { role?: string; status?: string; q?: string };

/** A paged user list. Call fetchNextPage for more. */
export function useUserList(filter: UserFilter, limit = 30) {
  return useInfiniteQuery({
    queryKey: ["users", filter.role ?? "", filter.status ?? "", filter.q ?? ""],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      gw<{ items: AdminUser[]; nextCursor: string | null }>(
        "GET",
        `/v1/identity/admin/users${qs({ ...filter, limit, cursor: pageParam })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Who is signed in, so an admin cannot act on their own account. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: Infinity,
    queryFn: () => gw<{ id: string; role: string; name: string }>("GET", "/v1/identity/me"),
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
}

/** Debounces a value so a search box does not call the server on every key press. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
