import type { OtpSender } from "./otp";

/** The code could not be delivered. The caller turns this into a 503 the app can show. */
export class SmsDeliveryError extends Error {
  readonly statusCode = 503;
  constructor(message = "We could not send the code right now. Try again in a minute.") {
    super(message);
    this.name = "SmsDeliveryError";
  }
}

export type Msg91Options = {
  /** MSG91 auth key (dashboard: API > Auth key). Never logged. */
  authKey: string;
  /** DLT approved OTP template id from the MSG91 OTP section. The template must contain ##OTP##. */
  templateId: string;
  /** Minutes the code is valid, shown to MSG91 so its own expiry matches ours. */
  expiryMinutes: number;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  /** Called with a short reason when sending fails. Never receives the code or the auth key. */
  onError?: (reason: string) => void;
};

/** "+919810000011" becomes "919810000011", which is the format MSG91 expects. */
export function toMsg91Mobile(phone: string): string {
  return phone.replace(/^\+/, "");
}

/**
 * Sends our own code through the MSG91 OTP API (v5). We generate and check the code ourselves, so
 * MSG91 only delivers it; its verify endpoint is never used. Indian SMS needs a DLT registered
 * sender id and template, which is set up in the MSG91 dashboard, not here.
 */
export function createMsg91Sender(options: Msg91Options): OtpSender {
  const baseUrl = (options.baseUrl ?? "https://control.msg91.com").replace(/\/+$/, "");
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const fail = (reason: string): never => {
    options.onError?.(reason);
    throw new SmsDeliveryError();
  };

  return {
    async send(phone, code) {
      const query = new URLSearchParams({
        template_id: options.templateId,
        mobile: toMsg91Mobile(phone),
        otp: code,
        otp_length: String(code.length),
        otp_expiry: String(options.expiryMinutes),
      });
      let response: Response;
      try {
        response = await doFetch(`${baseUrl}/api/v5/otp?${query.toString()}`, {
          method: "POST",
          headers: {
            authkey: options.authKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: "{}",
          signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
        });
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        return fail(timedOut ? "msg91 timed out" : "msg91 not reachable");
      }

      let body: { type?: string; message?: string } | undefined;
      try {
        body = (await response.json()) as { type?: string; message?: string };
      } catch {
        body = undefined;
      }
      if (!response.ok || body?.type !== "success") {
        // MSG91 messages describe the problem (bad template, low balance) without secrets
        fail(`msg91 ${response.status}: ${body?.message ?? "no message"}`.slice(0, 200));
      }
    },
  };
}
