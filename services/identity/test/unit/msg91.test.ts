import { describe, expect, it } from "vitest";
import { createMsg91Sender, SmsDeliveryError, toMsg91Mobile } from "../../src/modules/auth/msg91";
import { parseTestNumbers } from "../../src/modules/auth/otp";

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const base = { authKey: "test-auth-key", templateId: "tmpl-123", expiryMinutes: 5 };

describe("msg91 sender", () => {
  it("formats the number without the plus", () => {
    expect(toMsg91Mobile("+919810000011")).toBe("919810000011");
  });

  it("sends our code with the template, length and expiry, and the key only in a header", async () => {
    const fake = fakeFetch(() => json(200, { type: "success", request_id: "abc" }));
    await createMsg91Sender({ ...base, fetch: fake.fn }).send("+919810000011", "4821");
    expect(fake.calls).toHaveLength(1);
    const url = new URL(fake.calls[0]!.url);
    expect(url.origin + url.pathname).toBe("https://control.msg91.com/api/v5/otp");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template_id: "tmpl-123",
      mobile: "919810000011",
      otp: "4821",
      otp_length: "4",
      otp_expiry: "5",
    });
    expect(url.search).not.toContain("test-auth-key");
    expect((fake.calls[0]!.init.headers as Record<string, string>).authkey).toBe("test-auth-key");
    expect(fake.calls[0]!.init.method).toBe("POST");
  });

  it("fails when MSG91 says error, even with a 200", async () => {
    const reasons: string[] = [];
    const fake = fakeFetch(() => json(200, { type: "error", message: "Template not approved" }));
    const sender = createMsg91Sender({ ...base, fetch: fake.fn, onError: (r) => reasons.push(r) });
    await expect(sender.send("+919810000011", "1234")).rejects.toBeInstanceOf(SmsDeliveryError);
    expect(reasons[0]).toContain("Template not approved");
    expect(reasons[0]).not.toContain("1234");
    expect(reasons[0]).not.toContain("test-auth-key");
  });

  it("fails on an HTTP error, a non JSON answer or no network", async () => {
    for (const respond of [
      () => json(401, { type: "error", message: "Invalid authkey" }),
      () => new Response("<html>bad gateway</html>", { status: 502 }),
      () => Promise.reject(new TypeError("fetch failed")),
    ]) {
      const fake = fakeFetch(respond);
      await expect(
        createMsg91Sender({ ...base, fetch: fake.fn }).send("+919810000011", "1234"),
      ).rejects.toBeInstanceOf(SmsDeliveryError);
    }
  });

  it("gives up after its timeout", async () => {
    const slow = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
        );
      })) as unknown as typeof fetch;
    const reasons: string[] = [];
    const sender = createMsg91Sender({
      ...base,
      fetch: slow,
      timeoutMs: 50,
      onError: (r) => reasons.push(r),
    });
    await expect(sender.send("+919810000011", "1234")).rejects.toBeInstanceOf(SmsDeliveryError);
    expect(reasons[0]).toBe("msg91 timed out");
  });

  it("uses a configured base url", async () => {
    const fake = fakeFetch(() => json(200, { type: "success" }));
    await createMsg91Sender({ ...base, baseUrl: "https://sms.example.test/", fetch: fake.fn }).send(
      "+919810000011",
      "1234",
    );
    expect(fake.calls[0]!.url.startsWith("https://sms.example.test/api/v5/otp?")).toBe(true);
  });
});

describe("test numbers", () => {
  it("keeps only valid Indian mobile numbers", () => {
    expect([...parseTestNumbers(" +919810000099, junk, +911234567890 ,+919810000098")]).toEqual([
      "+919810000099",
      "+919810000098",
    ]);
    expect(parseTestNumbers(undefined).size).toBe(0);
  });
});
