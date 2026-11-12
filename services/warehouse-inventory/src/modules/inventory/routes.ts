import {
  availabilityQuerySchema,
  availabilityResponseSchema,
  serviceabilityQuerySchema,
  serviceabilityResponseSchema,
  type AvailabilityItem,
} from "@qc/contracts";
import type { ServiceApp } from "@qc/service-kit";
import { DEFAULT_MAX_PER_ORDER, etaMinutes, stockStatus } from "./domain";
import type { InventoryRepository } from "./repository";

export function registerInventoryRoutes(app: ServiceApp, repository: InventoryRepository): void {
  app.get(
    "/v1/inventory/serviceability",
    {
      schema: {
        tags: ["inventory"],
        summary: "Is this location served, by which warehouse, and how fast",
        querystring: serviceabilityQuerySchema,
        response: { 200: serviceabilityResponseSchema },
      },
    },
    async (request) => {
      const { lat, lng } = request.query;
      const serving = await repository.findServingWarehouse(lat, lng);
      if (serving) {
        return {
          serviceable: true,
          warehouseId: serving.warehouse.id,
          etaMins: etaMinutes(serving.distanceKm),
          reason: null,
        };
      }
      const covering = await repository.findCoveringWarehouse(lat, lng);
      return {
        serviceable: false,
        warehouseId: null,
        etaMins: null,
        reason: covering ? "WAREHOUSE_CLOSED" : "OUTSIDE_SERVICE_AREA",
      };
    },
  );

  app.get(
    "/v1/inventory/availability",
    {
      schema: {
        tags: ["inventory"],
        summary: "Stock status for products at a warehouse",
        querystring: availabilityQuerySchema,
        response: { 200: availabilityResponseSchema },
      },
    },
    async (request) => {
      const { warehouseId, productIds } = request.query;
      if (!(await repository.warehouseExists(warehouseId))) {
        throw app.httpErrors.notFound("Warehouse not found.");
      }
      const records = new Map(
        (await repository.getStock(warehouseId, productIds)).map((r) => [r.productId, r]),
      );

      const items: AvailabilityItem[] = productIds.map((productId) => {
        const record = records.get(productId);
        // A product the warehouse does not stock is treated as out of stock
        const available = record?.available ?? 0;
        const status = stockStatus(available);
        return {
          productId,
          status,
          // Only reveal the real number when it is small enough to be useful and honest
          remaining: status === "low" ? available : null,
          maxPerOrder: status === "out" ? null : (record?.maxPerOrder ?? DEFAULT_MAX_PER_ORDER),
        };
      });
      return { items };
    },
  );
}
