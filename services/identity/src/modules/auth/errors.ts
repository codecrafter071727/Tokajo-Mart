/** An error that carries the HTTP status the service kit should answer with. */
export class HttpError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export const unauthorized = (message: string) => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const tooMany = (message: string) => new HttpError(429, message);
export const conflict = (message: string) => new HttpError(409, message);
