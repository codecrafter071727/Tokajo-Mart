export class PaymentError extends Error {
  readonly statusCode: number;
  /** Every message here is written for the customer, including the 502 and 503 ones */
  readonly expose = true;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PaymentError";
    this.statusCode = statusCode;
  }
}
