"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Segmented } from "../../components/kit";
import { useWarehouse } from "../../components/shell/warehouse-context";
import { buttonClass } from "../../components/ui/button-style";
import { cn } from "../../components/ui/core";
import { RangePicker } from "../../components/ui/date-picker";
import { Calendar } from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { Modal } from "../../components/ui/modal";
import { indiaDay, shortDate } from "../../lib/dates";
import { CustomersTab } from "./customers-tab";
import { DeliveryTab } from "./delivery-tab";
import { HeatmapTab } from "./heatmap-tab";
import { ProductsTab } from "./products-tab";
import {
  clampRange,
  daysIn,
  MAX_DAYS,
  PRESETS,
  presetRange,
  previousRange,
  type PresetKey,
} from "./report-utils";
import { RidersTab } from "./riders-tab";
import { SalesTab } from "./sales-tab";

const TABS = [
  { id: "sales", label: "Sales", View: SalesTab },
  { id: "products", label: "Products", View: ProductsTab },
  { id: "delivery", label: "Delivery", View: DeliveryTab },
  { id: "riders", label: "Riders", View: RidersTab },
  { id: "customers", label: "Customers", View: CustomersTab },
  { id: "heatmap", label: "Heatmap", View: HeatmapTab },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isPreset = (v: string | null): v is PresetKey => PRESETS.some((p) => p.key === v);

/** Everything the page shows is in the address, so a report can be shared or bookmarked. */
function useReportState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "sales";
  const from = params.get("from");
  const to = params.get("to");
  const presetParam = params.get("range");

  const custom = from && to && DAY.test(from) && DAY.test(to) ? clampRange({ from, to }) : null;
  const preset: PresetKey | "custom" = custom
    ? "custom"
    : isPreset(presetParam)
      ? presetParam
      : "30d";
  // Recomputed per render so "today" stays right on a page left open overnight
  const range = custom ?? presetRange(preset === "custom" ? "30d" : preset);

  const set = useCallback(
    (next: Record<string, string | null>) => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null) search.delete(key);
        else search.set(key, value);
      }
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return { tab, preset, range, set };
}

export function Reports() {
  const { warehouseId, nameOf } = useWarehouse();
  const { tab, preset, range, set } = useReportState();
  const before = useMemo(() => previousRange(range), [range]);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const View = current.View;
  const days = daysIn(range);
  const today = indiaDay(0);
  const where = warehouseId ? nameOf(warehouseId) : "every warehouse";

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${shortDate(range.from)} to ${shortDate(range.to)} (${days} day${days === 1 ? "" : "s"}) at ${where}. Changes compare with ${shortDate(before.from)} to ${shortDate(before.to)}.`}
        actions={
          <>
            <Segmented
              label="Date range"
              options={[
                ...PRESETS.map((p) => ({ value: p.key, label: p.label })),
                ...(preset === "custom" ? [{ value: "custom" as const, label: "Custom" }] : []),
              ]}
              value={preset}
              onChange={(v) => {
                if (v !== "custom") set({ range: v, from: null, to: null });
              }}
            />
            <Modal
              trigger={
                <>
                  <Calendar className="size-4" aria-hidden />
                  <span>Pick dates</span>
                </>
              }
              triggerClass={buttonClass("secondary", "md")}
              title="Pick a date range"
              description={`Up to ${MAX_DAYS} days. Days are India local days.`}
            >
              {/* method="dialog" closes the dialog once the dates are applied */}
              <form
                method="dialog"
                onSubmit={(e) => {
                  const data = new FormData(e.currentTarget);
                  const f = String(data.get("from") ?? "");
                  const t = String(data.get("to") ?? "");
                  if (!DAY.test(f) || !DAY.test(t)) {
                    e.preventDefault();
                    return;
                  }
                  const picked = clampRange({ from: f, to: t }, today);
                  set({ range: null, from: picked.from, to: picked.to });
                }}
                className="space-y-4"
              >
                <RangePicker
                  from="from"
                  to="to"
                  defaultFrom={range.from}
                  defaultTo={range.to}
                  min={indiaDay(-2 * MAX_DAYS)}
                />
                <div className="flex justify-end gap-2">
                  <button type="submit" className={buttonClass("primary", "md")}>
                    Show report
                  </button>
                </div>
              </form>
            </Modal>
          </>
        }
      />

      <div
        className="mb-6 flex gap-1 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label="Reports"
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="report-panel"
              onClick={() => set({ tab: t.id })}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                on ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div id="report-panel" role="tabpanel" aria-label={current.label}>
        <View
          key={`${tab}-${range.from}-${range.to}-${warehouseId}`}
          range={range}
          warehouseId={warehouseId}
        />
      </div>
    </>
  );
}
