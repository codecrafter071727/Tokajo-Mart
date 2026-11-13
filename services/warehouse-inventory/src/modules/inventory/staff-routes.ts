import {
  adjustStockBodySchema,
  expiringQuerySchema,
  expiringResponseSchema,
  stockAlertsQuerySchema,
  stockAlertsResponseSchema,
  adminWarehouseSchema,
  adminWarehousesResponseSchema,
  createWarehouseBodySchema,
  productStockResponseSchema,
  receiveStockBodySchema,
  receiveStockResponseSchema,
  stockListQuerySchema,
  stockListResponseSchema,
  stockMovementsQuerySchema,
  stockMovementsResponseSchema,
  stockProductParamsSchema,
  stockRowSchema,
  updateStockBodySchema,
  updateWarehouseBodySchema,
  warehouseParamsSchema,
} from "@qc/contracts";
import {
  assertWarehouseScope,
  AuthError,
  requireRole,
  type Identity,
  type ServiceApp,
} from "@qc/service-kit";
import { expiringBatches, stockAlerts, withRestockCheck, type RestockNotifier } from "./alerts";
import { NotFoundError } from "./errors";
import type { InventoryRepository } from "./repository";

const STAFF = ["warehouse_staff", "warehouse_manager", "admin"] as const;

const encode = (n: number) => Buffer.from(String(n), "utf8").toString("base64url");
function decode(cursor: string | undefined): number | undefined | null {
  if (cursor === undefined) return undefined;
  const text = Buffer.from(cursor, "base64url").toString("utf8");
  return /^\d{1,12}$/.test(text) ? Number(text) : null;
}

/**
 * Which warehouse a staff request is about. Staff are tied to their own warehouse: asking for
 * another one is refused, not quietly answered with their own. Admins must name one.
 */
function warehouseFor(identity: Identity, requested: string | undefined): string {
  if (identity.role === "admin") {
    if (!requested) throw new AuthError(403, "Say which warehouse you mean.");
    return requested;
  }
  if (!identity.warehouseId) throw new AuthError(403, "You are not assigned to a warehouse.");
  if (requested) assertWarehouseScope(identity, requested);
  return identity.warehouseId;
}

/** Stock tools for the warehouse team and admins. Roles are checked here as well as at the gateway. */
/** Like warehouseFor, but an admin may leave it out to mean every warehouse. */
function warehouseOrAll(identity: Identity, requested: string | undefined): string | undefined {
  if (identity.role === "admin") return requested;
  return warehouseFor(identity, requested);
}

export function registerStaffRoutes(
  app: ServiceApp,
  repository: InventoryRepository,
  notifier?: RestockNotifier,
): void {
  const knownWarehouse = async (id: string) => {
    if (!(await repository.getWarehouse(id))) throw new NotFoundError("Warehouse not found.");
  };

  app.get(
    "/v1/inventory/stock",
    {
      schema: {
        tags: ["inventory"],
        summary: "Stock in a warehouse (staff and admin)",
        querystring: stockListQuerySchema,
        response: { 200: stockListResponseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const warehouseId = warehouseFor(identity, request.query.warehouseId);
      const offset = decode(request.query.cursor);
      if (offset === null) throw app.httpErrors.badRequest("Invalid cursor.");
      const page = await repository.listStock({
        warehouseId,
        q: request.query.q,
        limit: request.query.limit,
        offset: offset ?? 0,
      });
      return {
        items: page.items,
        nextCursor: page.nextOffset === null ? null : encode(page.nextOffset),
      };
    },
  );

  app.get(
    "/v1/inventory/stock/by-product/:productId",
    {
      schema: {
        tags: ["inventory"],
        summary: "One product's stock in every warehouse (admin)",
        params: stockProductParamsSchema,
        response: { 200: productStockResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const items = await repository.stockByProduct(request.params.productId);
      const sum = (pick: (r: (typeof items)[number]) => number) =>
        items.reduce((n, r) => n + pick(r), 0);
      return {
        productId: request.params.productId,
        items,
        totals: {
          onHand: sum((r) => r.onHand),
          reserved: sum((r) => r.reserved),
          available: sum((r) => r.available),
        },
      };
    },
  );

  app.get(
    "/v1/inventory/expiring",
    {
      schema: {
        tags: ["inventory"],
        summary: "Stock expiring soon (and past its date) that is still on the shelf",
        querystring: expiringQuerySchema,
        response: { 200: expiringResponseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const warehouseId = warehouseOrAll(identity, request.query.warehouseId);
      return { items: await expiringBatches(repository, warehouseId, request.query.days) };
    },
  );

  app.get(
    "/v1/inventory/alerts",
    {
      schema: {
        tags: ["inventory"],
        summary: "Out of stock, low stock, expiring and expired items",
        querystring: stockAlertsQuerySchema,
        response: { 200: stockAlertsResponseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      return stockAlerts(repository, {
        warehouseId: warehouseOrAll(identity, request.query.warehouseId),
        lowThreshold: request.query.lowThreshold,
        expiryDays: request.query.expiryDays,
      });
    },
  );

  app.post(
    "/v1/inventory/stock/receive",
    {
      schema: {
        tags: ["inventory"],
        summary: "Receive stock into a warehouse (GRN)",
        body: receiveStockBodySchema,
        response: { 200: receiveStockResponseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const warehouseId = warehouseFor(identity, request.body.warehouseId);
      await knownWarehouse(warehouseId);
      const items = await withRestockCheck(
        repository,
        notifier,
        warehouseId,
        request.body.items.map((i) => i.productId),
        () =>
          repository.receiveStock({
            warehouseId,
            reference: request.body.reference,
            items: request.body.items,
            actorId: identity.userId,
          }),
      );
      return { items };
    },
  );

  app.post(
    "/v1/inventory/stock/adjust",
    {
      schema: {
        tags: ["inventory"],
        summary: "Correct, write off or expire stock, with a reason",
        body: adjustStockBodySchema,
        response: { 200: stockRowSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const body = request.body;
      const warehouseId = warehouseFor(identity, body.warehouseId);
      await knownWarehouse(warehouseId);
      return withRestockCheck(
        repository,
        body.quantityDelta > 0 ? notifier : undefined,
        warehouseId,
        [body.productId],
        () =>
          repository.adjustStock({
            warehouseId,
            productId: body.productId,
            type: body.type,
            quantityDelta: body.quantityDelta,
            reason: body.reason,
            actorId: identity.userId,
          }),
      );
    },
  );

  // Declared before the :productId route so "movements" is never read as a product id
  app.get(
    "/v1/inventory/stock/movements",
    {
      schema: {
        tags: ["inventory"],
        summary: "The stock ledger, newest first",
        querystring: stockMovementsQuerySchema,
        response: { 200: stockMovementsResponseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const warehouseId = warehouseFor(identity, request.query.warehouseId);
      const beforeId = decode(request.query.cursor);
      if (beforeId === null) throw app.httpErrors.badRequest("Invalid cursor.");
      const page = await repository.listMovements({
        warehouseId,
        productId: request.query.productId,
        limit: request.query.limit,
        beforeId,
      });
      return {
        items: page.items,
        nextCursor: page.nextBeforeId === null ? null : encode(page.nextBeforeId),
      };
    },
  );

  app.patch(
    "/v1/inventory/stock/:productId",
    {
      schema: {
        tags: ["inventory"],
        summary: "Set the per order limit or rack location of a product",
        params: stockProductParamsSchema,
        body: updateStockBodySchema,
        response: { 200: stockRowSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const warehouseId = warehouseFor(identity, request.body.warehouseId);
      const { maxPerOrder, rackLocation } = request.body;
      const row = await repository.updateStockSettings(warehouseId, request.params.productId, {
        maxPerOrder,
        rackLocation,
      });
      if (!row) throw new NotFoundError("That product has no stock record in this warehouse.");
      return row;
    },
  );

  // --- Warehouses --------------------------------------------------------------------------
  app.get(
    "/v1/inventory/warehouses",
    {
      schema: {
        tags: ["inventory"],
        summary: "Warehouses (admins see all, staff their own)",
        response: { 200: adminWarehousesResponseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, ...STAFF);
      const all = await repository.listWarehouses();
      return {
        items: identity.role === "admin" ? all : all.filter((w) => w.id === identity.warehouseId),
      };
    },
  );

  app.post(
    "/v1/inventory/warehouses",
    {
      schema: {
        tags: ["inventory"],
        summary: "Add a warehouse (admin)",
        body: createWarehouseBodySchema,
        response: { 201: adminWarehouseSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      const created = await repository.createWarehouse(request.body);
      return reply.status(201).send(created);
    },
  );

  app.patch(
    "/v1/inventory/warehouses/:id",
    {
      schema: {
        tags: ["inventory"],
        summary: "Edit a warehouse. A manager may only open or close their own.",
        params: warehouseParamsSchema,
        body: updateWarehouseBodySchema,
        response: { 200: adminWarehouseSchema },
      },
    },
    async (request) => {
      const identity = requireRole(request, "admin", "warehouse_manager");
      if (identity.role !== "admin") {
        assertWarehouseScope(identity, request.params.id);
        if (Object.keys(request.body).some((key) => key !== "open")) {
          throw new AuthError(403, "Managers can only open or close their warehouse.");
        }
      }
      const updated = await repository.updateWarehouse(request.params.id, request.body);
      if (!updated) throw new NotFoundError("Warehouse not found.");
      return updated;
    },
  );
}
