import {
  availabilityQuerySchema,
  availabilityResponseSchema,
  reservationRefParamsSchema,
  reservationSchema,
  reserveRequestSchema,
  resolveRequestSchema,
  resolveResponseSchema,
  serviceabilityQuerySchema,
  serviceabilityResponseSchema,
  warehouseSchema,
  type AvailabilityItem,
} from "@qc/contracts";
import type { ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import { DEFAULT_MAX_PER_ORDER, etaMinutes, stockStatus } from "./domain";
import { coveringWarehouses, resolveBasket, type InventoryRepository } from "./repository";

const idParams = z.object({ id: z.string().min(1) });

export function registerInventoryRoutes(app: ServiceApp, repository: InventoryRepository): void {
  // ---------------------------------------------------------------------------------------
  // Public (through the gateway)
  // ---------------------------------------------------------------------------------------
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
      const covering = coveringWarehouses(await repository.listWarehouses(), lat, lng);
      const serving = covering.find((entry) => entry.warehouse.open);
      if (serving) {
        return {
          serviceable: true,
          warehouseId: serving.warehouse.id,
          etaMins: etaMinutes(serving.distanceKm),
          reason: null,
        };
      }
      return {
        serviceable: false,
        warehouseId: null,
        etaMins: null,
        reason: covering.length > 0 ? "WAREHOUSE_CLOSED" : "OUTSIDE_SERVICE_AREA",
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
      if (!(await repository.getWarehouse(warehouseId))) {
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

  // ---------------------------------------------------------------------------------------
  // Internal (service to service only, guarded by the shared key, never routed by the gateway)
  // ---------------------------------------------------------------------------------------
  app.post(
    "/internal/serviceability/resolve",
    {
      schema: {
        tags: ["internal"],
        summary: "Pick the warehouse that should serve a basket",
        body: resolveRequestSchema,
        response: { 200: resolveResponseSchema },
      },
    },
    async (request) =>
      resolveBasket(repository, request.body.lat, request.body.lng, request.body.items),
  );

  app.get(
    "/internal/warehouses/:id",
    {
      schema: { tags: ["internal"], params: idParams, response: { 200: warehouseSchema } },
    },
    async (request) => {
      const warehouse = await repository.getWarehouse(request.params.id);
      if (!warehouse) throw app.httpErrors.notFound("Warehouse not found.");
      return {
        id: warehouse.id,
        name: warehouse.name,
        lat: warehouse.lat,
        lng: warehouse.lng,
        open: warehouse.open,
      };
    },
  );

  app.post(
    "/internal/reservations",
    {
      schema: {
        tags: ["internal"],
        summary: "Hold stock for an order (idempotent on reference)",
        body: reserveRequestSchema,
        response: { 200: reservationSchema },
      },
    },
    async (request) => repository.reserve({ ...request.body, now: new Date() }),
  );

  app.post(
    "/internal/reservations/:reference/commit",
    {
      schema: {
        tags: ["internal"],
        summary: "Turn a hold into a sale",
        params: reservationRefParamsSchema,
        response: { 200: reservationSchema },
      },
    },
    async (request) => {
      const reservation = await repository.commit(request.params.reference);
      if (!reservation) throw app.httpErrors.notFound("Reservation not found.");
      return reservation;
    },
  );

  app.post(
    "/internal/reservations/:reference/release",
    {
      schema: {
        tags: ["internal"],
        summary: "Give a hold back",
        params: reservationRefParamsSchema,
        response: { 200: reservationSchema },
      },
    },
    async (request) => {
      const reservation = await repository.release(request.params.reference);
      if (!reservation) throw app.httpErrors.notFound("Reservation not found.");
      return reservation;
    },
  );
}
