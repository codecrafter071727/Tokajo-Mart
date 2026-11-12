import { describe, expect, it } from "vitest";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../../src/modules/auth/password";

describe("passwords", () => {
  it("accepts the right password and refuses a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse battery!", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("never stores the password and uses a fresh salt each time", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
    expect(a).not.toContain("same-password-here");
    expect(a.startsWith("scrypt$")).toBe(true);
  });

  it("treats a malformed stored value as a wrong password, not an error", async () => {
    for (const bad of ["", "plain", "scrypt$1$2", "bcrypt$a$b$c$d$e", "scrypt$16384$8$1$zz$zz"]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
  });

  it("verifies against the parameters stored with the hash", async () => {
    const stored = await hashPassword("a-reasonable-password");
    const [, n, r, p] = stored.split("$");
    expect([n, r, p]).toEqual(["16384", "8", "1"]);
  });

  it("asks for a sensible minimum length", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(10);
  });
});
