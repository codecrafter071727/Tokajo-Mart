"use client";

import type { AdminCoupon } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Card,
  cn,
  EmptyState,
  Mono,
  Stat,
  type Tone,
} from "../../components/ui/core";
import { Ban, IndianRupee, Pencil, Percent, Plus, Receipt, Tag } from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { rupees } from "../../lib/api";
import { couponValue } from "../../lib/coupons";
import { dateTime } from "../../lib/format";
import { errorMessage, gw } from "../../lib/gw";
import { CouponDialog } from "./coupon-dialog";

const STATE: Record<AdminCoupon["state"], { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "ok" },
  scheduled: { label: "Scheduled", tone: "info" },
  ended: { label: "Ended", tone: "neutral" },
  used_up: { label: "Used up", tone: "warn" },
  inactive: { label: "Off", tone: "neutral" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "other", label: "Ended or off" },
] as const;
type FilterId = (typeof FILTERS)[number]["value"];

function limits(c: AdminCoupon): string {
  const parts: string[] = [];
  if (c.minOrderPaise > 0) parts.push(`min ${rupees(c.minOrderPaise)}`);
  if (c.firstOrderOnly) parts.push("first order");
  if (c.usageLimitPerUser) parts.push(`${c.usageLimitPerUser} per customer`);
  return parts.join(" · ") || "No limits";
}

export function Promotions() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("all");
  const [editing, setEditing] = useState<AdminCoupon | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => gw<{ items: AdminCoupon[] }>("GET", "/v1/orders/admin/coupons"),
    refetchInterval: 60_000,
  });
  const coupons = useMemo(() => list.data?.items ?? [], [list.data]);
  const shown = coupons.filter((c) =>
    filter === "all"
      ? true
      : filter === "other"
        ? c.state === "ended" || c.state === "inactive" || c.state === "used_up"
        : c.state === filter,
  );
  const live = coupons.filter((c) => c.state === "live").length;
  const uses = coupons.reduce((n, c) => n + c.redemptions, 0);
  const given = coupons.reduce((n, c) => n + c.discountGivenPaise, 0);

  const deactivate = useMutation({
    mutationFn: (c: AdminCoupon) =>
      gw<AdminCoupon>("POST", `/v1/orders/admin/coupons/${c.id}/deactivate`),
    onSuccess: (c) => {
      setNotice(`${c.code} is switched off. Orders already placed keep their discount.`);
      void client.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e) => setFailure(errorMessage(e)),
  });
  const reactivate = useMutation({
    mutationFn: (c: AdminCoupon) =>
      gw<AdminCoupon>("PATCH", `/v1/orders/admin/coupons/${c.id}`, { active: true }),
    onSuccess: (c) => {
      setNotice(`${c.code} is on again.`);
      void client.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e) => setFailure(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Coupon codes customers apply in the cart. The order service checks every rule again when the order is placed."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
            New coupon
          </Button>
        }
      />

      {notice ? <Callout tone="ok">{notice}</Callout> : null}
      {failure ? <Callout tone="bad">{failure}</Callout> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          delay={0}
          icon={Tag}
          label="Live coupons"
          value={live}
          hint={`${coupons.length} in all`}
        />
        <Stat
          delay={1}
          icon={Receipt}
          label="Times used"
          value={uses}
          hint="On orders not cancelled"
        />
        <Stat
          delay={2}
          icon={IndianRupee}
          label="Discount given"
          value={rupees(given)}
          hint="Including waived delivery"
        />
      </div>

      <Card
        flush
        title="Coupons"
        actions={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter coupons">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                  filter === f.value
                    ? "border-accent-line bg-accent-soft text-accent"
                    : "border-line bg-surface text-ink-2 hover:bg-surface-2",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {list.isLoading ? (
          <TableSkeleton rows={4} cols={7} toolbar={false} />
        ) : list.isError ? (
          <div className="p-5">
            <Callout tone="bad" title="Could not load coupons">
              {errorMessage(list.error)}
            </Callout>
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Percent className="size-5" />}
            title={coupons.length === 0 ? "No coupons yet" : "Nothing in this view"}
            action={
              coupons.length === 0 ? (
                <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                  Create the first coupon
                </Button>
              ) : undefined
            }
          >
            {coupons.length === 0
              ? "Create a code like WELCOME50 for first orders or FREEDEL for free delivery."
              : "Try another filter."}
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Offer</Th>
                <Th>Rules</Th>
                <Th>Runs</Th>
                <Th>Status</Th>
                <Th align="right">Used</Th>
                <Th align="right">Discount given</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {shown.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Mono>{c.code}</Mono>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-muted">
                      {c.title}
                    </div>
                  </Td>
                  <Td>{couponValue(c)}</Td>
                  <Td muted>{limits(c)}</Td>
                  <Td muted>
                    {c.startsAt || c.endsAt
                      ? `${c.startsAt ? dateTime(c.startsAt) : "Now"} to ${c.endsAt ? dateTime(c.endsAt) : "no end"}`
                      : "Always"}
                  </Td>
                  <Td>
                    <Badge tone={STATE[c.state].tone}>{STATE[c.state].label}</Badge>
                  </Td>
                  <Td align="right">
                    {c.redemptions}
                    {c.usageLimitTotal ? (
                      <span className="text-muted"> / {c.usageLimitTotal}</span>
                    ) : null}
                  </Td>
                  <Td align="right">{rupees(c.discountGivenPaise)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                      {c.active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Ban}
                          className="text-bad"
                          pending={deactivate.isPending && deactivate.variables?.id === c.id}
                          onClick={() => {
                            setNotice(null);
                            setFailure(null);
                            if (
                              window.confirm(
                                `Switch off ${c.code}? Customers can no longer apply it.`,
                              )
                            ) {
                              deactivate.mutate(c);
                            }
                          }}
                        >
                          Switch off
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          pending={reactivate.isPending && reactivate.variables?.id === c.id}
                          onClick={() => {
                            setNotice(null);
                            setFailure(null);
                            reactivate.mutate(c);
                          }}
                        >
                          Switch on
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {editing ? (
        <CouponDialog
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(c, created) => {
            setEditing(null);
            setFailure(null);
            setNotice(created ? `${c.code} is ready.` : `${c.code} is saved.`);
            void client.invalidateQueries({ queryKey: ["admin-coupons"] });
          }}
        />
      ) : null}
    </div>
  );
}
