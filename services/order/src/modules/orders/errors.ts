/** An error that carries the HTTP status (and optional detail) the service kit answers with. */
export class OrderError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;
  /** Written for the customer, so even a 503 shows its message */
  readonly expose = true;
  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "OrderError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new OrderError(400, message, details);
export const forbidden = (message: string) => new OrderError(403, message);
export const notFound = (message = "Order not found.") => new OrderError(404, message);
export const conflict = (message: string, details?: unknown) =>
  new OrderError(409, message, details);
export const unavailable = (message: string) => new OrderError(503, message);
