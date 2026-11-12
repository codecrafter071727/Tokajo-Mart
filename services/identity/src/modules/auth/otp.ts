import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Role } from "@qc/contracts";

/** Customers get a 4 digit code, riders a 6 digit one. */
export const otpLength = (role: Role): number => (role === "rider" ? 6 : 4);

/** The fixed code accepted in demo mode, when no SMS provider is configured. */
export const demoCode = (role: Role): string => (role === "rider" ? "123456" : "1234");

export function generateCode(length: number): string {
  return String(randomInt(0, 10 ** length)).padStart(length, "0");
}

/** The code is never stored, only this keyed hash of it, tied to the phone number. */
export function hashCode(secret: string, phone: string, code: string): string {
  return createHmac("sha256", secret).update(`${phone}|${code}`).digest("hex");
}

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Delivers a code to a phone. The real implementation is an SMS provider (MSG91 needs DLT). */
export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

/** Demo mode: nothing is sent, because the fixed demo code is accepted. */
export const demoSender: OtpSender = { async send() {} };
