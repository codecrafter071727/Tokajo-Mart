export { registerInventoryRoutes } from "./routes";
export { registerStaffRoutes } from "./staff-routes";
export {
  createInMemoryInventoryRepository,
  resolveBasket,
  type InventoryRepository,
} from "./repository";
export { createPostgresInventoryRepository } from "./postgres-repository";
export {
  InsufficientStockError,
  LimitExceededError,
  NotFoundError,
  ReservationStateError,
  StockChangeError,
  WarehouseClosedError,
  WarehouseExistsError,
} from "./errors";
export { seedStock, seedWarehouses } from "./seed";
