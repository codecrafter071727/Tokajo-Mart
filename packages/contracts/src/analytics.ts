import { z } from "zod";

/** A calendar day in India, YYYY-MM-DD. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-13.");
const int = z.number().int();
const paise = z.number().int();
/** Null when there is nothing to average over (for example no delivered orders). */
const maybe = z.number().nullable();

/**
 * Every analytics report takes the same range. Days are India days, `to` is inclusive, the default
 * is the last 30 days and the longest range is 366 days. Admins may pick a warehouse; a warehouse
 * manager always gets their own, whatever they send.
 */
export const analyticsQuerySchema = z.object({
  from: day.optional(),
  to: day.optional(),
  warehouseId: z.string().min(1).optional(),
});
export type AnalyticsQuery = z.input<typeof analyticsQuerySchema>;

const rangeSchema = z.object({
  from: day,
  to: day,
  days: int,
  warehouseId: z.string().nullable(),
  generatedAt: z.string(),
});
export type AnalyticsRange = z.infer<typeof rangeSchema>;

// --- Sales -------------------------------------------------------------------------------------

export const salesReportSchema = z.object({
  range: rangeSchema,
  totals: z.object({
    /** Orders placed in the range, not counting unpaid online orders that never went through */
    orders: int,
    delivered: int,
    cancelled: int,
    /** Delivered orders only */
    gmvPaise: paise,
    averageOrderPaise: maybe,
    /** Coupon discounts on orders that were not cancelled */
    discountPaise: paise,
    /** Customers whose first ever order falls in the range */
    newCustomers: int,
    /** Customers who ordered in the range and had ordered before it */
    returningCustomers: int,
  }),
  daily: z.array(
    z.object({
      date: day,
      orders: int,
      delivered: int,
      gmvPaise: paise,
      discountPaise: paise,
      newCustomerOrders: int,
      repeatCustomerOrders: int,
    }),
  ),
  byPaymentMethod: z.array(
    z.object({ method: z.string(), orders: int, delivered: int, gmvPaise: paise }),
  ),
});
export type SalesReport = z.infer<typeof salesReportSchema>;

// --- Products ----------------------------------------------------------------------------------

const productLine = z.object({
  productId: z.string(),
  name: z.string(),
  categoryId: z.string().nullable(),
  units: int,
  revenuePaise: paise,
});

export const productsReportSchema = z.object({
  range: rangeSchema,
  totals: z.object({ productsSold: int, units: int, revenuePaise: paise }),
  /** Ten best sellers by revenue */
  top: z.array(productLine),
  /** Ten weakest among products that sold at least once */
  bottom: z.array(productLine),
  categories: z.array(
    z.object({
      categoryId: z.string().nullable(),
      name: z.string(),
      units: int,
      revenuePaise: paise,
      /** Share of revenue in the range, 0 to 100 */
      sharePercent: z.number(),
    }),
  ),
  /**
   * Days a product ended with nothing on hand, rebuilt from the stock ledger. Only products with at
   * least one such day, worst first, at most 20.
   */
  outOfStockDays: z.array(
    z.object({ productId: z.string(), name: z.string(), warehouseId: z.string(), days: int }),
  ),
});
export type ProductsReport = z.infer<typeof productsReportSchema>;

// --- Delivery ----------------------------------------------------------------------------------

const deliveryStats = {
  delivered: int,
  averageMins: maybe,
  /** Delivered within the time promised at checkout, 0 to 100 */
  onTimePercent: maybe,
};

export const deliveryReportSchema = z.object({
  range: rangeSchema,
  totals: z.object({
    ...deliveryStats,
    p90Mins: maybe,
    cancelled: int,
  }),
  /** By the hour the order was placed, India time, all 24 hours */
  byHour: z.array(z.object({ hour: int, orders: int, ...deliveryStats })),
  byWarehouse: z.array(
    z.object({ warehouseId: z.string(), orders: int, cancelled: int, ...deliveryStats }),
  ),
  cancellations: z.array(z.object({ reason: z.string(), count: int })),
});
export type DeliveryReport = z.infer<typeof deliveryReportSchema>;

// --- Riders ------------------------------------------------------------------------------------

export const ridersReportSchema = z.object({
  range: rangeSchema,
  riders: z.array(
    z.object({
      riderId: z.string(),
      name: z.string(),
      deliveries: int,
      /** Payout plus tips */
      earningsPaise: paise,
      tipsPaise: paise,
      distanceKm: z.number(),
      /** Placed to delivered, over this rider's orders */
      averageMins: maybe,
    }),
  ),
});
export type RidersReport = z.infer<typeof ridersReportSchema>;

// --- Customers ---------------------------------------------------------------------------------

export const customersReportSchema = z.object({
  range: rangeSchema,
  totals: z.object({
    /** Customers who ordered at least once in the range */
    active: int,
    /** Customers whose first ever order falls in the range */
    newCustomers: int,
    /** Of the active customers, the share who ordered two or more times in the range, 0 to 100 */
    repeatRatePercent: maybe,
  }),
  daily: z.array(
    z.object({
      date: day,
      newCustomers: int,
      /** Accounts created that day. Null when a warehouse is chosen: sign ups have no warehouse. */
      signups: int.nullable(),
    }),
  ),
  /**
   * Customers grouped by the week (Monday) of their first order, at most the last 8 weeks that
   * start in the range. retention[k] is the share of the cohort that ordered again k weeks later.
   */
  cohorts: z.array(z.object({ week: day, size: int, retention: z.array(z.number().nullable()) })),
});
export type CustomersReport = z.infer<typeof customersReportSchema>;

// --- Heatmap -----------------------------------------------------------------------------------

export const heatmapReportSchema = z.object({
  range: rangeSchema,
  /** All 7 x 24 cells. weekday 1 is Monday, 7 is Sunday; hour is India time. */
  cells: z.array(z.object({ weekday: int, hour: int, orders: int })),
  max: int,
});
export type HeatmapReport = z.infer<typeof heatmapReportSchema>;
