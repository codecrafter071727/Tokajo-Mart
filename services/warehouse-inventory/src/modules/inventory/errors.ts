/** Not enough stock for a reservation. `lines` says which products are short and by how much. */
export class InsufficientStockError extends Error {
  readonly statusCode = 409;
  readonly details: { productId: string; requested: number; available: number }[];

  constructor(lines: { productId: string; requested: number; available: number }[]) {
    super("Some items are no longer available in the quantity requested.");
    this.name = "InsufficientStockError";
    this.details = lines;
  }
}

/** More of one product than the per order limit allows. */
export class LimitExceededError extends Error {
  readonly statusCode = 409;
  readonly details: { productId: string; requested: number; maxPerOrder: number }[];

  constructor(lines: { productId: string; requested: number; maxPerOrder: number }[]) {
    super("Some items exceed the per order limit.");
    this.name = "LimitExceededError";
    this.details = lines;
  }
}

export class WarehouseClosedError extends Error {
  readonly statusCode = 409;
  constructor() {
    super("This warehouse is closed right now.");
    this.name = "WarehouseClosedError";
  }
}

/** The reservation is in a state that does not allow this, for example committing a released hold. */
export class ReservationStateError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ReservationStateError";
  }
}

/** A stock change that would break the numbers, for example removing more than is free. */
export class StockChangeError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "StockChangeError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class WarehouseExistsError extends Error {
  readonly statusCode = 409;
  constructor(id: string) {
    super(`A warehouse with the id "${id}" already exists.`);
    this.name = "WarehouseExistsError";
  }
}
