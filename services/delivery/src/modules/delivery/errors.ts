export type DeliveryErrorReason =
  | "INVALID_TRANSITION"
  | "ITEMS_NOT_CHECKED"
  | "WRONG_CODE"
  | "CODE_LOCKED"
  | "OFFER_EXPIRED"
  | "NOT_YOURS";

/** Carries the HTTP status and a reason the rider app can show in plain words. */
export class DeliveryError extends Error {
  readonly statusCode: number;
  readonly details: { reason: DeliveryErrorReason };
  constructor(statusCode: number, reason: DeliveryErrorReason, message: string) {
    super(message);
    this.name = "DeliveryError";
    this.statusCode = statusCode;
    this.details = { reason };
  }
}

export class HttpError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}
