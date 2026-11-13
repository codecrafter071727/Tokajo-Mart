import {
  analyticsQuerySchema,
  customersReportSchema,
  deliveryReportSchema,
  heatmapReportSchema,
  productsReportSchema,
  ridersReportSchema,
  salesReportSchema,
} from "@qc/contracts";
import { requireRole, type ServiceApp } from "@qc/service-kit";
import type { z } from "zod";
import { resolveRange } from "./range";
import {
  customersReport,
  deliveryReport,
  heatmapReport,
  productsReport,
  readOnly,
  ridersReport,
  salesReport,
  type AnalyticsDb,
} from "./reports";

type Report = (
  trx: Parameters<Parameters<typeof readOnly>[1]>[0],
  scope: { range: ReturnType<typeof resolveRange>; warehouseId: string | null },
) => Promise<object>;

export function registerAnalyticsRoutes(
  app: ServiceApp,
  db: AnalyticsDb,
  now: () => Date = () => new Date(),
): void {
  const report = (path: string, summary: string, schema: z.ZodType, build: Report) =>
    app.get(
      `/v1/analytics/${path}`,
      {
        schema: {
          tags: ["analytics"],
          summary,
          querystring: analyticsQuerySchema,
          response: { 200: schema },
        },
      },
      async (request) => {
        // Admins see everything or one warehouse. A manager always sees only their own.
        const who = requireRole(request, "admin", "warehouse_manager");
        const warehouseId =
          who.role === "admin" ? (request.query.warehouseId ?? null) : who.warehouseId;
        if (who.role !== "admin" && !warehouseId) {
          throw app.httpErrors.forbidden("You are not assigned to a warehouse.");
        }
        const range = resolveRange(request.query, now());
        const body = await readOnly(db, (trx) => build(trx, { range, warehouseId }));
        return {
          range: {
            from: range.from,
            to: range.to,
            days: range.days,
            warehouseId,
            generatedAt: now().toISOString(),
          },
          ...body,
        };
      },
    );

  report(
    "sales",
    "Orders, GMV, discounts and new versus repeat customers",
    salesReportSchema,
    salesReport,
  );
  report(
    "products",
    "Best and worst sellers, category share and out of stock days",
    productsReportSchema,
    productsReport,
  );
  report(
    "delivery",
    "Delivery times, on time rate, by hour and warehouse, cancellations",
    deliveryReportSchema,
    deliveryReport,
  );
  report("riders", "Deliveries, earnings and speed per rider", ridersReportSchema, ridersReport);
  report(
    "customers",
    "New customers, repeat rate and weekly cohorts",
    customersReportSchema,
    customersReport,
  );
  report("hourly-heatmap", "Orders by weekday and hour", heatmapReportSchema, heatmapReport);
}
