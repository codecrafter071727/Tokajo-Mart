"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TICK = { fill: "var(--muted)", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 13,
  boxShadow: "var(--shadow-pop)",
};

/** Fades a chart in after mount, so the server render and the first client render always match. */
function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);
  return ready;
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export type TrendPoint = { date: string; value: number };

/** A value per day as an area chart in the theme's colours. */
export function TrendChart({
  data,
  format = (v) => String(v),
  name,
  color = "var(--chart-2)",
  height = 260,
}: {
  data: TrendPoint[];
  format?: (value: number) => string;
  name: string;
  color?: string;
  height?: number;
}) {
  const ready = useReady();
  const id = `fill-${name.replace(/\W+/g, "")}`;
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div
      className={`transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      style={{ height }}
      role="img"
      aria-label={`${name} per day over ${data.length} days: ${format(total)} in total`}
    >
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              axisLine={false}
              tickLine={false}
              tick={TICK}
              dy={8}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={TICK}
              width={56}
              tickFormatter={(v: number) => format(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(d) => dayLabel(String(d))}
              formatter={(v) => [format(Number(v)), name]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${id})`}
              activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export type RingPart = { name: string; value: number; color: string };

/** Parts of a whole as a ring with a big number in the middle and a legend underneath. */
export function Ring({
  parts,
  centre,
  caption,
  label,
}: {
  parts: RingPart[];
  centre: string;
  caption: string;
  label: string;
}) {
  const ready = useReady();
  const total = parts.reduce((n, p) => n + p.value, 0);
  const shown = total ? parts.filter((p) => p.value > 0) : [];
  return (
    <div>
      <div
        className={`relative mx-auto size-[190px] transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        role="img"
        aria-label={label}
      >
        {ready ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shown.length ? shown : [{ name: "None", value: 1, color: "var(--line)" }]}
                dataKey="value"
                innerRadius={62}
                outerRadius={86}
                paddingAngle={shown.length > 1 ? 2 : 0}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive
              >
                {(shown.length ? shown : [{ color: "var(--line)" }]).map((p, i) => (
                  <Cell key={i} fill={p.color} />
                ))}
              </Pie>
              {shown.length ? <Tooltip contentStyle={TOOLTIP_STYLE} /> : null}
            </PieChart>
          </ResponsiveContainer>
        ) : null}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-2xl font-bold text-ink">{centre}</span>
          <span className="text-xs text-muted">{caption}</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-[13px]">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="tnum font-medium text-ink">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
