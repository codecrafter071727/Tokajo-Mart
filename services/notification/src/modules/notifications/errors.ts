export class NotificationError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "NotificationError";
    this.statusCode = statusCode;
  }
}
