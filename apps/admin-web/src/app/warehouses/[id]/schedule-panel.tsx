"use client";

import type { Closure, OpeningWindow, WarehouseSchedule } from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  EmptyRow,
  Field,
  inputCls,
  LoadingRows,
  Panel,
  td,
  th,
  Toggle,
} from "../../../components/kit";
import { X } from "../../../components/ui/icons";
import { errorMessage, gw } from "../../../lib/gw";

const TABS = [
  { id: "area", label: "Service area" },
  { id: "hours", label: "Hours" },
  { id: "closures", label: "Closures" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Monday first, the way people read a week. Values are 0 Sunday to 6 Saturday. */
const WEEK = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];

/** "06:00" becomes "6:00 AM". */
export function clock12(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** An ISO time shown on the warehouse's clock (India), for example "Sat 6:00 AM". */
function indiaTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Every 6 digit pincode in what someone pasted, plus anything that is not one. */
export function parsePincodes(text: string): { valid: string[]; invalid: string[] } {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const valid = tokens.filter((t) => /^[1-9][0-9]{5}$/.test(t));
  const invalid = tokens.filter((t) => !/^[1-9][0-9]{5}$/.test(t));
  return { valid: [...new Set(valid)], invalid };
}

export function SchedulePanel({
  warehouseId,
  radiusKm,
}: {
  warehouseId: string;
  radiusKm?: number;
}) {
  const [tab, setTab] = useState<Tab>("area");
  const schedule = useQuery({
    queryKey: ["warehouse-schedule", warehouseId],
    refetchInterval: 60_000,
    queryFn: () =>
      gw<WarehouseSchedule>(
        "GET",
        `/v1/inventory/warehouses/${encodeURIComponent(warehouseId)}/schedule`,
      ),
  });
  const s = schedule.data;

  const statusBadge = !s ? null : s.status.openNow ? (
    <Badge tone="green">
      {s.status.closesAt ? `Open, closes ${indiaTime(s.status.closesAt)}` : "Open 24 hours"}
    </Badge>
  ) : (
    <Badge tone={s.status.closedBy === "manual" ? "gray" : "amber"}>
      {s.status.closedBy === "manual"
        ? "Closed by hand"
        : s.status.opensAt
          ? `Closed, opens ${indiaTime(s.status.opensAt)}`
          : "Closed"}
    </Badge>
  );

  return (
    <Panel
      className="mb-6"
      title="Where and when it delivers"
      description="Pincodes it serves, its weekly hours and holidays. Times are India time."
      actions={statusBadge}
    >
      <div role="tablist" aria-label="Schedule" className="mb-5 flex gap-6 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "area" && s ? (
              <span className="ml-1.5 text-muted">{s.pincodes.length}</span>
            ) : null}
            {t.id === "closures" && s ? (
              <span className="ml-1.5 text-muted">{s.closures.length}</span>
            ) : null}
          </button>
        ))}
      </div>
      {schedule.isError ? (
        <Alert title="Could not load the schedule">{errorMessage(schedule.error)}</Alert>
      ) : !s ? (
        <p className="py-6 text-center text-[13px] text-muted">Loading...</p>
      ) : (
        <div role="tabpanel">
          {tab === "area" ? (
            <ServiceArea warehouseId={warehouseId} pincodes={s.pincodes} radiusKm={radiusKm} />
          ) : tab === "hours" ? (
            <Hours warehouseId={warehouseId} hours={s.hours} />
          ) : (
            <Closures warehouseId={warehouseId} closures={s.closures} />
          )}
        </div>
      )}
    </Panel>
  );
}

function useScheduleSave<T>(warehouseId: string, run: (body: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: ["warehouse-schedule", warehouseId] }),
  });
}

// --- Service area ---------------------------------------------------------------------------

function ServiceArea({
  warehouseId,
  pincodes,
  radiusKm,
}: {
  warehouseId: string;
  pincodes: string[];
  radiusKm?: number;
}) {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const save = useScheduleSave<string[]>(warehouseId, (list) =>
    gw("PUT", `/v1/inventory/warehouses/${encodeURIComponent(warehouseId)}/pincodes`, {
      pincodes: list,
    }),
  );

  const add = () => {
    const parsed = parsePincodes(text);
    setInvalid(parsed.invalid);
    const fresh = parsed.valid.filter((p) => !pincodes.includes(p));
    if (fresh.length === 0) {
      setDone(parsed.valid.length ? "Those pincodes are already on the list." : null);
      return;
    }
    save.mutate([...pincodes, ...fresh], {
      onSuccess: () => {
        setText("");
        setDone(`Added ${fresh.length} pincode${fresh.length === 1 ? "" : "s"}.`);
      },
    });
  };
  const remove = (pincode: string) => {
    setDone(null);
    save.mutate(pincodes.filter((p) => p !== pincode));
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        When an address has a pincode, the warehouses listing it serve it, even beyond the radius,
        and a pincode nobody lists is not served. Addresses without a pincode use the{" "}
        {radiusKm ? `${radiusKm} km` : ""} radius.
      </p>
      {pincodes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
          No pincodes yet. This warehouse is matched by distance only.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Pincodes served">
          {pincodes.map((p) => (
            <li
              key={p}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 font-mono text-[13px] text-ink"
            >
              {p}
              <button
                type="button"
                onClick={() => remove(p)}
                disabled={save.isPending}
                aria-label={`Remove ${p}`}
                className="rounded-full p-1 text-muted hover:bg-surface hover:text-bad"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Add pincodes"
          hint="Paste one or many, separated by spaces, commas or new lines."
          error={invalid.length ? `Not a 6 digit pincode: ${invalid.slice(0, 5).join(", ")}` : null}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="201301, 201309"
            className={`${inputCls} h-auto py-2 font-mono`}
          />
        </Field>
        <Button variant="primary" onClick={add} pending={save.isPending} disabled={!text.trim()}>
          Add
        </Button>
      </div>
      {pincodes.length > 0 ? (
        <Button
          variant="dangerGhost"
          small
          onClick={() => {
            if (window.confirm("Remove every pincode? The warehouse goes back to distance only.")) {
              setDone(null);
              save.mutate([]);
            }
          }}
        >
          Remove all
        </Button>
      ) : null}
      {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
      {done && !save.isError ? <Alert tone="success">{done}</Alert> : null}
    </div>
  );
}

// --- Hours ----------------------------------------------------------------------------------

type DayRow = { weekday: number; open: boolean; opensAt: string; closesAt: string };

const toRows = (hours: OpeningWindow[]): DayRow[] =>
  WEEK.map(({ weekday }) => {
    const h = hours.find((x) => x.weekday === weekday);
    return h
      ? { weekday, open: true, opensAt: h.opensAt, closesAt: h.closesAt }
      : { weekday, open: hours.length === 0, opensAt: "06:00", closesAt: "01:00" };
  });

function Hours({ warehouseId, hours }: { warehouseId: string; hours: OpeningWindow[] }) {
  const [allDay, setAllDay] = useState(hours.length === 0);
  const [rows, setRows] = useState<DayRow[]>(() => toRows(hours));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setAllDay(hours.length === 0);
    setRows(toRows(hours));
  }, [hours]);

  const save = useScheduleSave<OpeningWindow[]>(warehouseId, (list) =>
    gw("PUT", `/v1/inventory/warehouses/${encodeURIComponent(warehouseId)}/hours`, {
      hours: list,
    }),
  );
  const set = (weekday: number, patch: Partial<DayRow>) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  };
  const copyFirst = () => {
    const first = rows[0];
    if (!first) return;
    setSaved(false);
    setRows((rs) =>
      rs.map((r) => ({ ...r, open: first.open, opensAt: first.opensAt, closesAt: first.closesAt })),
    );
  };
  const submit = () => {
    setError(null);
    if (allDay) {
      save.mutate([], { onSuccess: () => setSaved(true) });
      return;
    }
    const open = rows.filter((r) => r.open);
    if (open.length === 0) {
      setError("Open at least one day, or switch on open all day.");
      return;
    }
    const same = open.find((r) => r.opensAt === r.closesAt);
    if (same) {
      setError("Opening and closing time cannot be the same.");
      return;
    }
    save.mutate(
      open.map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt })),
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <div className="space-y-4">
      <Toggle
        label="Open all day, every day"
        checked={allDay}
        onChange={(v) => {
          setSaved(false);
          setAllDay(v);
        }}
      />
      {!allDay ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className={th}>Day</th>
                  <th className={th}>Open</th>
                  <th className={th}>Opens</th>
                  <th className={th}>Closes</th>
                  <th className={th} aria-label="Note" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const label = WEEK.find((w) => w.weekday === r.weekday)?.label ?? "";
                  const overnight = r.open && r.closesAt <= r.opensAt;
                  return (
                    <tr key={r.weekday} className="border-b border-line last:border-0">
                      <td className={`${td} font-medium`}>{label}</td>
                      <td className={td}>
                        <input
                          type="checkbox"
                          aria-label={`Open on ${label}`}
                          checked={r.open}
                          onChange={(e) => set(r.weekday, { open: e.target.checked })}
                          className="size-4 accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="time"
                          aria-label={`${label} opens`}
                          value={r.opensAt}
                          disabled={!r.open}
                          onChange={(e) => set(r.weekday, { opensAt: e.target.value })}
                          className={`${inputCls} mt-0 w-32`}
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="time"
                          aria-label={`${label} closes`}
                          value={r.closesAt}
                          disabled={!r.open}
                          onChange={(e) => set(r.weekday, { closesAt: e.target.value })}
                          className={`${inputCls} mt-0 w-32`}
                        />
                      </td>
                      <td className={`${td} text-xs text-muted`}>
                        {!r.open
                          ? "Closed all day"
                          : overnight
                            ? `Closes ${clock12(r.closesAt)} the next day`
                            : `${clock12(r.opensAt)} to ${clock12(r.closesAt)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button small variant="ghost" onClick={copyFirst}>
            Copy Monday to every day
          </Button>
        </>
      ) : (
        <p className="text-[13px] text-muted">
          Customers can order at any hour, unless a closure says otherwise.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={submit} pending={save.isPending}>
          Save hours
        </Button>
        {saved && !save.isError ? <span className="text-[13px] text-ok">Saved</span> : null}
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </div>
  );
}

// --- Closures -------------------------------------------------------------------------------

const indiaToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function Closures({ warehouseId, closures }: { warehouseId: string; closures: Closure[] }) {
  const [startsOn, setStartsOn] = useState(indiaToday());
  const [endsOn, setEndsOn] = useState(indiaToday());
  const [reason, setReason] = useState("");
  const base = `/v1/inventory/warehouses/${encodeURIComponent(warehouseId)}/closures`;
  const add = useScheduleSave<void>(warehouseId, () =>
    gw("POST", base, { startsOn, endsOn, reason }),
  );
  const remove = useScheduleSave<string>(warehouseId, (id) =>
    gw("DELETE", `${base}/${encodeURIComponent(id)}`),
  );
  const today = indiaToday();
  const sorted = [...closures].sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(undefined, { onSuccess: () => setReason("") });
        }}
      >
        <Field label="From">
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={endsOn}
            min={startsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Diwali"
            className={inputCls}
            required
            minLength={2}
            maxLength={120}
          />
        </Field>
        <Button type="submit" variant="primary" pending={add.isPending}>
          Add closure
        </Button>
      </form>
      {add.isError ? <Alert>{errorMessage(add.error)}</Alert> : null}
      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              <th className={th}>Dates</th>
              <th className={th}>Reason</th>
              <th className={th}>When</th>
              <th className={th} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {add.isPending && sorted.length === 0 ? <LoadingRows colSpan={4} rows={1} /> : null}
            {sorted.length === 0 && !add.isPending ? (
              <EmptyRow colSpan={4}>No closures. The weekly hours apply every day.</EmptyRow>
            ) : null}
            {sorted.map((c) => {
              const state = c.endsOn < today ? "Past" : c.startsOn <= today ? "Today" : "Upcoming";
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    {c.startsOn === c.endsOn
                      ? dayLabel(c.startsOn)
                      : `${dayLabel(c.startsOn)} to ${dayLabel(c.endsOn)}`}
                  </td>
                  <td className={td}>{c.reason}</td>
                  <td className={td}>
                    <Badge tone={state === "Today" ? "amber" : state === "Past" ? "gray" : "blue"}>
                      {state}
                    </Badge>
                  </td>
                  <td className={`${td} text-right`}>
                    <Button
                      small
                      variant="dangerGhost"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove the closure for ${c.reason}?`))
                          remove.mutate(c.id);
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
