import { createHash, randomBytes } from "node:crypto";
import type { AuthResponse, AuthUser, OtpRequestResponse, Role } from "@qc/contracts";
import { signAccessToken } from "@qc/service-kit";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.generated";
import { conflict, forbidden, tooMany, unauthorized } from "./errors";
import { demoCode, generateCode, hashCode, otpLength, sameHash, type OtpSender } from "./otp";
import { verifyPassword } from "./password";

export type AuthConfig = {
  jwtSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
  otpTtlSeconds: number;
  otpMode: "demo" | "sms";
  sender: OtpSender;
  /** Numbers that use the demo code and get no SMS, even in sms mode (store review, QA) */
  testNumbers?: Set<string>;
  now?: () => Date;
};

/** Wrong guesses allowed per code, and codes that may be requested per number per hour. */
export const MAX_OTP_ATTEMPTS = 5;
export const MAX_OTP_REQUESTS_PER_HOUR = 5;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type UserRow = {
  id: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  warehouseId: string | null;
  status: string;
  passwordHash?: string | null;
};

const toUser = (row: UserRow, riderWarehouse: string | null = null): AuthUser => ({
  id: row.id,
  role: row.role as Role,
  name: row.name,
  phone: row.phone,
  email: row.email,
  warehouseId: row.warehouseId ?? riderWarehouse,
});

export class AuthService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly cfg: AuthConfig,
  ) {}

  private now = () => (this.cfg.now ?? (() => new Date()))();

  // ------------------------------------------------------------------------------------------
  // Phone code login (customers and riders)
  // ------------------------------------------------------------------------------------------

  async requestOtp(phone: string, role: "customer" | "rider"): Promise<OtpRequestResponse> {
    const now = this.now();

    // Riders are created by an admin, so an unknown number cannot even get a code
    if (role === "rider") {
      const rider = await this.db
        .selectFrom("identity.users as u")
        .innerJoin("identity.riderProfiles as r", "r.userId", "u.id")
        .select("u.status")
        .where("u.phone", "=", phone)
        .where("u.role", "=", "rider")
        .executeTakeFirst();
      if (!rider)
        throw forbidden("This number is not registered as a rider. Ask your warehouse manager.");
      if (rider.status !== "active") throw forbidden("This rider account is not active.");
    }

    const recent = await this.db
      .selectFrom("identity.otpChallenges")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("phone", "=", phone)
      .where("createdAt", ">", new Date(now.getTime() - 3600_000))
      .executeTakeFirstOrThrow();
    if (Number(recent.count) >= MAX_OTP_REQUESTS_PER_HOUR) {
      throw tooMany("Too many codes requested. Try again in an hour.");
    }

    const demo = this.cfg.otpMode === "demo";
    const testNumber = !demo && (this.cfg.testNumbers?.has(phone) ?? false);
    const code = demo || testNumber ? demoCode(role) : generateCode(otpLength(role));
    const challenge = await this.db
      .insertInto("identity.otpChallenges")
      .values({
        phone,
        codeHash: hashCode(this.cfg.jwtSecret, phone, code),
        createdAt: now,
        expiresAt: new Date(now.getTime() + this.cfg.otpTtlSeconds * 1000),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (!testNumber) {
      try {
        await this.cfg.sender.send(phone, code);
      } catch (error) {
        // The customer never got this code, so it must not count against them or stay usable
        await this.db.deleteFrom("identity.otpChallenges").where("id", "=", challenge.id).execute();
        throw error;
      }
    }

    return {
      expiresInSeconds: this.cfg.otpTtlSeconds,
      codeLength: otpLength(role),
      demoMode: demo,
    };
  }

  async verifyOtp(input: {
    phone: string;
    role: "customer" | "rider";
    code: string;
    name?: string;
  }): Promise<AuthResponse> {
    const now = this.now();
    const challenge = await this.db
      .selectFrom("identity.otpChallenges")
      .selectAll()
      .where("phone", "=", input.phone)
      .where("consumedAt", "is", null)
      .where("expiresAt", ">", now)
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();
    if (!challenge) throw unauthorized("That code has expired. Ask for a new one.");

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      await this.db
        .updateTable("identity.otpChallenges")
        .set({ consumedAt: now })
        .where("id", "=", challenge.id)
        .execute();
      throw tooMany("Too many wrong tries. Ask for a new code.");
    }

    // Count the try before checking it, so a wrong guess can never be free
    await this.db
      .updateTable("identity.otpChallenges")
      .set({ attempts: challenge.attempts + 1 })
      .where("id", "=", challenge.id)
      .execute();
    if (!sameHash(challenge.codeHash, hashCode(this.cfg.jwtSecret, input.phone, input.code))) {
      throw unauthorized("That code is not right. Try again.");
    }
    await this.db
      .updateTable("identity.otpChallenges")
      .set({ consumedAt: now })
      .where("id", "=", challenge.id)
      .execute();

    let user = await this.db
      .selectFrom("identity.users")
      .selectAll()
      .where("phone", "=", input.phone)
      .executeTakeFirst();
    if (!user) {
      if (input.role === "rider") throw forbidden("This number is not registered as a rider.");
      user = await this.db
        .insertInto("identity.users")
        .values({ role: "customer", phone: input.phone, name: input.name ?? "Customer" })
        .onConflict((oc) => oc.column("phone").doUpdateSet({ phone: input.phone }))
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    if (user.role !== input.role)
      throw conflict("This number belongs to a different kind of account.");
    return this.issue(user);
  }

  // ------------------------------------------------------------------------------------------
  // Email and password login (warehouse staff and admins)
  // ------------------------------------------------------------------------------------------

  async loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    const user = await this.db
      .selectFrom("identity.users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();
    // Same answer and similar work whether the email exists or not, so it cannot be probed
    const ok = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, "scrypt$16384$8$1$00$00");
    if (!user || !ok) throw unauthorized("Email or password is not right.");
    if (!["warehouse_staff", "warehouse_manager", "admin"].includes(user.role))
      throw forbidden("Use phone sign in for this account.");
    return this.issue(user);
  }

  // ------------------------------------------------------------------------------------------
  // Sessions
  // ------------------------------------------------------------------------------------------

  /** Trade a refresh token for a new pair. The old one stops working at once (rotation). */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const now = this.now();
    const row = await this.db
      .selectFrom("identity.refreshTokens")
      .selectAll()
      .where("tokenHash", "=", sha256(refreshToken))
      .executeTakeFirst();
    if (!row) throw unauthorized("Please sign in again.");

    if (row.revokedAt) {
      // A token that was already used is being used again: assume it was stolen, end every session
      await this.db
        .updateTable("identity.refreshTokens")
        .set({ revokedAt: now })
        .where("userId", "=", row.userId)
        .where("revokedAt", "is", null)
        .execute();
      throw unauthorized("Please sign in again.");
    }
    if (row.expiresAt <= now) throw unauthorized("Your session has expired. Please sign in again.");

    const user = await this.db
      .selectFrom("identity.users")
      .selectAll()
      .where("id", "=", row.userId)
      .executeTakeFirst();
    if (!user || user.status !== "active") throw forbidden("This account is not active.");

    await this.db
      .updateTable("identity.refreshTokens")
      .set({ revokedAt: now })
      .where("id", "=", row.id)
      .execute();
    return this.issue(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db
      .updateTable("identity.refreshTokens")
      .set({ revokedAt: this.now() })
      .where("tokenHash", "=", sha256(refreshToken))
      .where("revokedAt", "is", null)
      .execute();
  }

  private async issue(user: UserRow): Promise<AuthResponse> {
    if (user.status !== "active") throw forbidden("This account is not active.");

    let riderWarehouse: string | null = null;
    if (user.role === "rider") {
      const profile = await this.db
        .selectFrom("identity.riderProfiles")
        .select("warehouseId")
        .where("userId", "=", user.id)
        .executeTakeFirst();
      if (!profile) throw forbidden("This rider has no profile yet.");
      riderWarehouse = profile.warehouseId;
    }

    const authUser = toUser(user, riderWarehouse);
    const now = this.now();
    const accessToken = await signAccessToken(
      { userId: user.id, role: authUser.role, warehouseId: authUser.warehouseId },
      { secret: this.cfg.jwtSecret, ttlSeconds: this.cfg.accessTtlSeconds, now },
    );

    const refreshToken = randomBytes(32).toString("base64url");
    await this.db
      .insertInto("identity.refreshTokens")
      .values({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(now.getTime() + this.cfg.refreshTtlDays * 86_400_000),
      })
      .execute();

    return { accessToken, refreshToken, expiresIn: this.cfg.accessTtlSeconds, user: authUser };
  }
}
