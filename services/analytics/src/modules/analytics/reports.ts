import type {
  CustomersReport,
  DeliveryReport,
  HeatmapReport,
  ProductsReport,
  RidersReport,
  SalesReport,
} from "@qc/contracts";
import type { Kysely, Transaction } from "@qc/service-kit";
import { sql, type RawBuilder } from "kysely";
import type { ReportRange } from "./range";

/**
 * Reports read other services' schemas and never write. Every report runs in a READ ONLY
 * transaction, so Postgres itself refuses any write, with a statement timeout so one heavy report
 * cannot hold a connection. In production point ANALYTICS_DATABASE_URL at a read only database
 * user (and ideally a replica) as well.
 */
export type AnalyticsDb = Kysely<Record<string, never>>;
type Trx = Transaction<Record<string, never>>;

export async function readOnly<T>(db: AnalyticsDb, run: (trx: Trx) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`set transaction read only`.execute(trx);
    await sql`set local statement_timeout = '15s'`.execute(trx);
    return run(trx);
  });
}

type Scope = { range: ReportRange; warehouseId: string | null };

const IST = sql.lit("Asia/Kolkata");
/** Orders that were really placed: unpaid online orders that never went through do not count */
const PLACED = sql`o.status not in ('pending_payment', 'payment_failed', 'expired')`;

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const maybe = (v: unknown, digits = 1): number | null => {
  if (v === null || v === undefined) return null;
  const f = 10 ** digits;
  return Math.round(Number(v) * f) / f;
};
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

function scoped({ warehouseId }: Scope, column: string): RawBuilder<unknown> {
  return warehouseId ? sql`and ${sql.ref(column)} = ${warehouseId}` : sql``;
}
const inRange = ({ range }: Scope, column: string) =>
  sql`${sql.ref(column)} >= ${range.start} and ${sql.ref(column)} < ${range.end}`;
const days = ({ range }: Scope) =>
  sql`generate_series(${range.from}::date, ${range.to}::date, interval '1 day')`;

/**
 * Each customer's first order (at the chosen warehouse when one is chosen, otherwise anywhere).
 * A customer is "new" in a range when this first order falls inside it.
 */
const firstOrders = (scope: Scope) => sql`
  select o.user_id, min(o.placed_at) as first_at
  from orders.orders o
  where ${PLACED} ${scoped(scope, "o.warehouse_id")}
  group by o.user_id`;

// ---------------------------------------------------------------------------------------------

export async function salesReport(trx: Trx, scope: Scope): Promise<Omit<SalesReport, "range">> {
  const base = sql`
    with first_orders as (${firstOrders(scope)}),
    o as (
      select o.id, o.user_id, o.status, o.payment_method, o.total_paise, o.discount_paise,
             (o.placed_at at time zone ${IST})::date as day,
             o.placed_at = f.first_at as is_first,
             f.first_at < ${scope.range.start} as is_returning
      from orders.orders o
      join first_orders f on f.user_id = o.user_id
      where ${PLACED} and ${inRange(scope, "o.placed_at")} ${scoped(scope, "o.warehouse_id")}
    )`;

  const totals = await sql<Record<string, unknown>>`
    ${base}
    select count(*) as orders,
           count(*) filter (where status = 'delivered') as delivered,
           count(*) filter (where status = 'cancelled') as cancelled,
           coalesce(sum(total_paise) filter (where status = 'delivered'), 0) as gmv_paise,
           coalesce(sum(discount_paise) filter (where status <> 'cancelled'), 0) as discount_paise,
           count(distinct user_id) filter (where is_first) as new_customers,
           count(distinct user_id) filter (where is_returning) as returning_customers
    from o`.execute(trx);

  const daily = await sql<Record<string, unknown>>`
    ${base}
    select to_char(d.day, 'YYYY-MM-DD') as date,
           count(o.id) as orders,
           count(o.id) filter (where o.status = 'delivered') as delivered,
           coalesce(sum(o.total_paise) filter (where o.status = 'delivered'), 0) as gmv_paise,
           coalesce(sum(o.discount_paise) filter (where o.status <> 'cancelled'), 0) as discount_paise,
           count(o.id) filter (where o.is_first) as new_customer_orders,
           count(o.id) filter (where not o.is_first) as repeat_customer_orders
    from ${days(scope)} as d(day)
    left join o on o.day = d.day::date
    group by d.day
    order by d.day`.execute(trx);

  const methods = await sql<Record<string, unknown>>`
    ${base}
    select payment_method as method,
           count(*) as orders,
           count(*) filter (where status = 'delivered') as delivered,
           coalesce(sum(total_paise) filter (where status = 'delivered'), 0) as gmv_paise
    from o
    group by payment_method
    order by orders desc`.execute(trx);

  const t = totals.rows[0] ?? {};
  const delivered = num(t.delivered);
  const gmv = num(t.gmvPaise);
  return {
    totals: {
      orders: num(t.orders),
      delivered,
      cancelled: num(t.cancelled),
      gmvPaise: gmv,
      averageOrderPaise: delivered > 0 ? Math.round(gmv / delivered) : null,
      discountPaise: num(t.discountPaise),
      newCustomers: num(t.newCustomers),
      returningCustomers: num(t.returningCustomers),
    },
    daily: daily.rows.map((r) => ({
      date: String(r.date),
      orders: num(r.orders),
      delivered: num(r.delivered),
      gmvPaise: num(r.gmvPaise),
      discountPaise: num(r.discountPaise),
      newCustomerOrders: num(r.newCustomerOrders),
      repeatCustomerOrders: num(r.repeatCustomerOrders),
    })),
    byPaymentMethod: methods.rows.map((r) => ({
      method: String(r.method),
      orders: num(r.orders),
      delivered: num(r.delivered),
      gmvPaise: num(r.gmvPaise),
    })),
  };
}

// ---------------------------------------------------------------------------------------------

export async function productsReport(
  trx: Trx,
  scope: Scope,
): Promise<Omit<ProductsReport, "range">> {
  const sold = await sql<Record<string, unknown>>`
    select i.product_id, max(i.name) as name, p.category_id,
           sum(i.quantity) as units,
           sum(i.quantity * i.unit_price_paise) as revenue_paise
    from orders.order_items i
    join orders.orders o on o.id = i.order_id
    left join catalog.products p on p.id = i.product_id
    where ${PLACED} and o.status <> 'cancelled'
      and ${inRange(scope, "o.placed_at")} ${scoped(scope, "o.warehouse_id")}
    group by i.product_id, p.category_id`.execute(trx);

  const categories = await sql<{ id: string; name: string }>`
    select id, name from catalog.categories`.execute(trx);
  const categoryName = new Map(categories.rows.map((c) => [c.id, c.name]));

  // End of day stock rebuilt from the ledger: today's count minus everything that moved after that
  // day ended. Every change to on_hand writes a movement, so this is exact. Days before the stock
  // row existed are skipped.
  const out = await sql<Record<string, unknown>>`
    with d as (select day::date as day from ${days(scope)} as g(day)),
    eod as (
      select s.warehouse_id, s.product_id, d.day,
             s.on_hand - coalesce((
               select sum(m.quantity_delta)
               from inventory.stock_movements m
               where m.warehouse_id = s.warehouse_id
                 and m.product_id = s.product_id
                 and m.created_at >= ((d.day + 1)::timestamp at time zone ${IST})
             ), 0) as on_hand
      from inventory.stock_items s
      cross join d
      where d.day >= (s.created_at at time zone ${IST})::date
        and d.day <= (now() at time zone ${IST})::date
        ${scoped(scope, "s.warehouse_id")}
    )
    select eod.warehouse_id, eod.product_id, coalesce(p.name, eod.product_id) as name,
           count(*) as days
    from eod
    left join catalog.products p on p.id = eod.product_id
    where eod.on_hand <= 0
    group by eod.warehouse_id, eod.product_id, p.name
    order by days desc, eod.product_id
    limit 20`.execute(trx);

  const lines = sold.rows.map((r) => ({
    productId: String(r.productId),
    name: String(r.name),
    categoryId: r.categoryId === null || r.categoryId === undefined ? null : String(r.categoryId),
    units: num(r.units),
    revenuePaise: num(r.revenuePaise),
  }));
  const byRevenue = [...lines].sort(
    (a, b) => b.revenuePaise - a.revenuePaise || a.productId.localeCompare(b.productId),
  );
  const revenue = lines.reduce((s, l) => s + l.revenuePaise, 0);

  const perCategory = new Map<string | null, { units: number; revenuePaise: number }>();
  for (const l of lines) {
    const c = perCategory.get(l.categoryId) ?? { units: 0, revenuePaise: 0 };
    c.units += l.units;
    c.revenuePaise += l.revenuePaise;
    perCategory.set(l.categoryId, c);
  }

  return {
    totals: {
      productsSold: lines.length,
      units: lines.reduce((s, l) => s + l.units, 0),
      revenuePaise: revenue,
    },
    top: byRevenue.slice(0, 10),
    bottom: [...byRevenue].reverse().slice(0, 10),
    categories: [...perCategory]
      .map(([categoryId, c]) => ({
        categoryId,
        name: (categoryId && categoryName.get(categoryId)) || "Uncategorised",
        units: c.units,
        revenuePaise: c.revenuePaise,
        sharePercent: pct(c.revenuePaise, revenue) ?? 0,
      }))
      .sort((a, b) => b.revenuePaise - a.revenuePaise),
    outOfStockDays: out.rows.map((r) => ({
      productId: String(r.productId),
      name: String(r.name),
      warehouseId: String(r.warehouseId),
      days: num(r.days),
    })),
  };
}

// ---------------------------------------------------------------------------------------------

export async function deliveryReport(
  trx: Trx,
  scope: Scope,
): Promise<Omit<DeliveryReport, "range">> {
  const base = sql`
    with o as (
      select o.status, o.warehouse_id, o.promised_mins, o.cancel_reason,
             extract(hour from o.placed_at at time zone ${IST})::int as hour,
             case when o.status = 'delivered' and o.delivered_at is not null
                  then extract(epoch from (o.delivered_at - o.placed_at)) / 60 end as mins
      from orders.orders o
      where ${PLACED} and ${inRange(scope, "o.placed_at")} ${scoped(scope, "o.warehouse_id")}
    )`;
  const stats = sql`
    count(o.mins) as delivered,
    avg(o.mins) as average_mins,
    avg(case when o.mins is null then null when o.mins <= o.promised_mins then 100.0 else 0 end) as on_time_percent`;

  const totals = await sql<Record<string, unknown>>`
    ${base}
    select ${stats},
           percentile_cont(0.9) within group (order by o.mins) as p90_mins,
           count(*) filter (where o.status = 'cancelled') as cancelled
    from o`.execute(trx);

  const byHour = await sql<Record<string, unknown>>`
    ${base}
    select h.hour, count(o.hour) as orders, ${stats}
    from generate_series(0, 23) as h(hour)
    left join o on o.hour = h.hour
    group by h.hour
    order by h.hour`.execute(trx);

  const byWarehouse = await sql<Record<string, unknown>>`
    ${base}
    select o.warehouse_id, count(*) as orders,
           count(*) filter (where o.status = 'cancelled') as cancelled, ${stats}
    from o
    group by o.warehouse_id
    order by orders desc`.execute(trx);

  const reasons = await sql<Record<string, unknown>>`
    ${base}
    select coalesce(nullif(trim(o.cancel_reason), ''), 'No reason given') as reason, count(*) as count
    from o
    where o.status = 'cancelled'
    group by 1
    order by count desc, reason`.execute(trx);

  const s = (r: Record<string, unknown>) => ({
    delivered: num(r.delivered),
    averageMins: maybe(r.averageMins),
    onTimePercent: maybe(r.onTimePercent),
  });
  const t = totals.rows[0] ?? {};
  return {
    totals: { ...s(t), p90Mins: maybe(t.p90Mins), cancelled: num(t.cancelled) },
    byHour: byHour.rows.map((r) => ({ hour: num(r.hour), orders: num(r.orders), ...s(r) })),
    byWarehouse: byWarehouse.rows.map((r) => ({
      warehouseId: String(r.warehouseId),
      orders: num(r.orders),
      cancelled: num(r.cancelled),
      ...s(r),
    })),
    cancellations: reasons.rows.map((r) => ({ reason: String(r.reason), count: num(r.count) })),
  };
}

// ---------------------------------------------------------------------------------------------

export async function ridersReport(trx: Trx, scope: Scope): Promise<Omit<RidersReport, "range">> {
  const rows = await sql<Record<string, unknown>>`
    select d.rider_id, coalesce(max(u.name), 'Rider') as name,
           count(*) as deliveries,
           coalesce(sum(d.payout_paise + d.tip_paise), 0) as earnings_paise,
           coalesce(sum(d.tip_paise), 0) as tips_paise,
           coalesce(sum(d.distance_km), 0) as distance_km,
           avg(extract(epoch from (o.delivered_at - o.placed_at)) / 60) as average_mins
    from delivery.deliveries d
    left join orders.orders o on o.id = d.order_id
    left join identity.users u on u.id = d.rider_id
    where d.status = 'delivered' and d.rider_id is not null
      and ${inRange(scope, "d.delivered_at")} ${scoped(scope, "d.warehouse_id")}
    group by d.rider_id
    order by deliveries desc, earnings_paise desc`.execute(trx);
  return {
    riders: rows.rows.map((r) => ({
      riderId: String(r.riderId),
      name: String(r.name),
      deliveries: num(r.deliveries),
      earningsPaise: num(r.earningsPaise),
      tipsPaise: num(r.tipsPaise),
      distanceKm: maybe(r.distanceKm) ?? 0,
      averageMins: maybe(r.averageMins),
    })),
  };
}

// ---------------------------------------------------------------------------------------------

const COHORT_WEEKS = 8;

export async function customersReport(
  trx: Trx,
  scope: Scope,
): Promise<Omit<CustomersReport, "range">> {
  const first = sql`with first_orders as (${firstOrders(scope)})`;

  const totals = await sql<Record<string, unknown>>`
    ${first},
    active as (
      select o.user_id, count(*) as n
      from orders.orders o
      where ${PLACED} and ${inRange(scope, "o.placed_at")} ${scoped(scope, "o.warehouse_id")}
      group by o.user_id
    )
    select (select count(*) from active) as active,
           (select count(*) from active where n >= 2) as repeaters,
           (select count(*) from first_orders f where ${inRange(scope, "f.first_at")}) as new_customers`.execute(
    trx,
  );

  const signups = scope.warehouseId
    ? sql`null::bigint`
    : sql`(select count(*) from identity.users u
           where u.role = 'customer' and (u.created_at at time zone ${IST})::date = d.day::date)`;
  const daily = await sql<Record<string, unknown>>`
    ${first}
    select to_char(d.day, 'YYYY-MM-DD') as date,
           (select count(*) from first_orders f
            where (f.first_at at time zone ${IST})::date = d.day::date) as new_customers,
           ${signups} as signups
    from ${days(scope)} as d(day)
    order by d.day`.execute(trx);

  // Weeks start on Monday, India time. A cohort is everyone whose first order fell in that week.
  const cohorts = await sql<Record<string, unknown>>`
    ${first},
    cohort as (
      select f.user_id, date_trunc('week', f.first_at at time zone ${IST})::date as week
      from first_orders f
      where ${inRange(scope, "f.first_at")}
    ),
    weeks as (
      select week from cohort group by week order by week desc limit ${COHORT_WEEKS}
    ),
    activity as (
      select distinct o.user_id, date_trunc('week', o.placed_at at time zone ${IST})::date as week
      from orders.orders o
      where ${PLACED} ${scoped(scope, "o.warehouse_id")}
    )
    select to_char(w.week, 'YYYY-MM-DD') as week,
           (select count(*) from cohort c where c.week = w.week) as size,
           k.k,
           (w.week + k.k * 7) <= date_trunc('week', now() at time zone ${IST})::date as reached,
           (select count(*) from cohort c join activity a on a.user_id = c.user_id
             where c.week = w.week and a.week = w.week + k.k * 7) as active
    from weeks w
    cross join generate_series(0, ${COHORT_WEEKS - 1}) as k(k)
    order by w.week, k.k`.execute(trx);

  const t = totals.rows[0] ?? {};
  const active = num(t.active);
  const byWeek = new Map<string, { size: number; retention: (number | null)[] }>();
  for (const r of cohorts.rows) {
    const week = String(r.week);
    const entry = byWeek.get(week) ?? { size: num(r.size), retention: [] };
    entry.retention[num(r.k)] = r.reached ? (pct(num(r.active), entry.size) ?? 0) : null;
    byWeek.set(week, entry);
  }

  return {
    totals: {
      active,
      newCustomers: num(t.newCustomers),
      repeatRatePercent: pct(num(t.repeaters), active),
    },
    daily: daily.rows.map((r) => ({
      date: String(r.date),
      newCustomers: num(r.newCustomers),
      signups: r.signups === null || r.signups === undefined ? null : num(r.signups),
    })),
    cohorts: [...byWeek].map(([week, c]) => ({ week, size: c.size, retention: c.retention })),
  };
}

// ---------------------------------------------------------------------------------------------

export async function heatmapReport(trx: Trx, scope: Scope): Promise<Omit<HeatmapReport, "range">> {
  const rows = await sql<Record<string, unknown>>`
    with o as (
      select extract(isodow from o.placed_at at time zone ${IST})::int as weekday,
             extract(hour from o.placed_at at time zone ${IST})::int as hour
      from orders.orders o
      where ${PLACED} and ${inRange(scope, "o.placed_at")} ${scoped(scope, "o.warehouse_id")}
    )
    select w.weekday, h.hour, count(o.hour) as orders
    from generate_series(1, 7) as w(weekday)
    cross join generate_series(0, 23) as h(hour)
    left join o on o.weekday = w.weekday and o.hour = h.hour
    group by w.weekday, h.hour
    order by w.weekday, h.hour`.execute(trx);
  const cells = rows.rows.map((r) => ({
    weekday: num(r.weekday),
    hour: num(r.hour),
    orders: num(r.orders),
  }));
  return { cells, max: cells.reduce((m, c) => Math.max(m, c.orders), 0) };
}
