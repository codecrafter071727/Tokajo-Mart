import { describe, expect, it } from "vitest";
import { demoCode, generateCode, hashCode, otpLength, sameHash } from "../../src/modules/auth/otp";

describe("otp helpers", () => {
  it("gives customers 4 digits and riders 6", () => {
    expect(otpLength("customer")).toBe(4);
    expect(otpLength("rider")).toBe(6);
    expect(demoCode("customer")).toHaveLength(4);
    expect(demoCode("rider")).toHaveLength(6);
  });

  it("generates only digits, of the right length, keeping leading zeros", () => {
    for (let i = 0; i < 200; i += 1) expect(generateCode(4)).toMatch(/^\d{4}$/);
    expect(generateCode(6)).toMatch(/^\d{6}$/);
  });

  it("hashes a code together with the phone and a secret", () => {
    const base = hashCode("secret", "+919810000011", "123456");
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode("secret", "+919810000012", "123456")).not.toBe(base); // other phone
    expect(hashCode("other", "+919810000011", "123456")).not.toBe(base); // other secret
    expect(hashCode("secret", "+919810000011", "123457")).not.toBe(base); // other code
  });

  it("compares hashes without being fooled by a different length", () => {
    expect(sameHash("abc", "abc")).toBe(true);
    expect(sameHash("abc", "abd")).toBe(false);
    expect(sameHash("abc", "abcd")).toBe(false);
  });
});
