import {
  closureParamsSchema,
  closureSchema,
  createClosureBodySchema,
  servicePincodesSchema,
  setHoursBodySchema,
  setPincodesBodySchema,
  warehouseParamsSchema,
  warehouseScheduleSchema,
  type WarehouseSchedule,
} from "@qc/contracts";
import { assertWarehouseScope, requireRole, type ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import { NotFoundError } from "./errors";
import type { InventoryRepository } from "./repository";
import { statusOf } from "./schedule";

/**
 * Where and when each warehouse serves. Admins change pincodes, hours and closures; staff of a
 * warehouse can read its schedule (a manager still opens or closes it with the warehouse PATCH).
 */
export function registerScheduleRoutes(app: ServiceApp, repository: InventoryRepository): void {
  const scheduleOf = async (warehouseId: string, now = new Date()): Promise<WarehouseSchedule> => {
    const warehouse = await repository.getWarehouse(warehouseId);
    if (!warehouse) throw new NotFoundError("Warehouse not found.");
    const setup = await repository.getServiceSetup();
    return {
      warehouseId,
      hours: setup.hours.get(warehouseId) ?? [],
      closures: (setup.closures.get(warehouseId) ?? []).map((c) => ({
        ...c,
        warehouseId,
        createdAt: c.createdAt ?? "",
      })),
      pincodes: [...(setup.pincodes.get(warehouseId) ?? [])].sort(),
      status: statusOf(warehouse, setup, now),
    };
  };

  app.get(
    "/v1/inventory/warehouses/:id/schedule",
    {
      schema: {
        tags: ["inventory"],
        summary: "Pincodes, opening hours, closures and whether the warehouse is open now",
        params: warehouseParamsSchema,
        response: { 200: warehouseScheduleSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, "warehouse_staff", "warehouse_manager", "admin");
      assertWarehouseScope(identity, request.params.id);
      return scheduleOf(request.params.id);
    },
  );

  app.put(
    "/v1/inventory/warehouses/:id/pincodes",
    {
      schema: {
        tags: ["inventory"],
        summary: "Replace the pincodes a warehouse delivers to (admin)",
        params: warehouseParamsSchema,
        body: setPincodesBodySchema,
        response: { 200: servicePincodesSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return { pincodes: await repository.setPincodes(request.params.id, request.body.pincodes) };
    },
  );

  app.put(
    "/v1/inventory/warehouses/:id/hours",
    {
      schema: {
        tags: ["inventory"],
        summary: "Replace the weekly opening hours, India time (admin). Empty means open all day.",
        params: warehouseParamsSchema,
        body: setHoursBodySchema,
        response: { 200: warehouseScheduleSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      await repository.setHours(request.params.id, request.body.hours);
      return scheduleOf(request.params.id);
    },
  );

  app.post(
    "/v1/inventory/warehouses/:id/closures",
    {
      schema: {
        tags: ["inventory"],
        summary: "Close a warehouse for whole days, such as a holiday (admin)",
        params: warehouseParamsSchema,
        body: createClosureBodySchema,
        response: { 201: closureSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      const closure = await repository.addClosure({
        warehouseId: request.params.id,
        ...request.body,
      });
      return reply.status(201).send(closure);
    },
  );

  app.delete(
    "/v1/inventory/warehouses/:id/closures/:closureId",
    {
      schema: {
        tags: ["inventory"],
        summary: "Remove a closure (admin)",
        params: closureParamsSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const removed = await repository.removeClosure(request.params.id, request.params.closureId);
      if (!removed) throw new NotFoundError("Closure not found.");
      return { ok: true as const };
    },
  );
}
