import {
  POD_MAX_BYTES,
  type AdminOrderDelivery,
  type PodUploadBody,
  type RiderLocationBody,
  type RiderPosition,
  type Tracking,
} from "@qc/contracts";
import {
  InternalCallError,
  type Identity,
  type InternalClient,
  type Kysely,
} from "@qc/service-kit";
import type { Selectable } from "kysely";
import type { DB, DeliveryRiderLocations } from "../../db/types.generated";
import { HttpError } from "./errors";
import { podKey, type PodStorage } from "./pod-storage";

/** A phone may report at most this often; faster readings are refused, not queued. */
export const LOCATION_MIN_INTERVAL_MS = 4000;
/** Readings older than this (a phone that was offline) are no use for live tracking. */
export const LOCATION_MAX_AGE_MS = 2 * 60_000;
const LOCATION_MAX_FUTURE_MS = 30_000;
/** Faster than this between two readings is a GPS glitch or a spoofed position (180 km/h). */
export const MAX_RIDER_SPEED_MPS = 50;
/** Moves shorter than this are always accepted, so GPS jitter never trips the speed check. */
const JITTER_METRES = 200;
/** Average city speed on a two wheeler, used for the ETA */
export const AVERAGE_SPEED_KMH = 18;
/** A photo can still be added this long after the delivery is marked done */
export const POD_LATE_UPLOAD_MS = 30 * 60_000;

const ON_THE_WAY = ["picked_up", "out_for_delivery"];
const RIDER_ACTIVE = ["assigned", "at_store", "picked_up", "at_customer"];

/** Straight line distance in metres. */
export function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Minutes to cover a distance at the average speed, never less than one. */
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / AVERAGE_SPEED_KMH) * 60));
}

type OrderInfo = { id: string; userId: string; status: string };

export class TrackingService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly order: InternalClient,
    private readonly storage: PodStorage | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // -------------------------------------------------------------------------------------
  // The rider's phone reports where it is
  // -------------------------------------------------------------------------------------

  async publishLocation(riderId: string, body: RiderLocationBody) {
    const now = this.now();
    const recordedAt = new Date(body.recordedAt);
    if (recordedAt.getTime() < now.getTime() - LOCATION_MAX_AGE_MS) {
      throw new HttpError(422, "That location reading is too old to use.");
    }
    if (recordedAt.getTime() > now.getTime() + LOCATION_MAX_FUTURE_MS) {
      throw new HttpError(422, "That location reading is from the future. Check the phone clock.");
    }

    const state = await this.db
      .selectFrom("delivery.riderState")
      .select("online")
      .where("riderId", "=", riderId)
      .executeTakeFirst();
    if (!state?.online) throw new HttpError(409, "Go on duty to share your location.");

    const last = await this.db
      .selectFrom("delivery.riderLocations")
      .selectAll()
      .where("riderId", "=", riderId)
      .executeTakeFirst();
    if (last) {
      if (now.getTime() - last.updatedAt.getTime() < LOCATION_MIN_INTERVAL_MS) {
        throw new HttpError(429, "Location sent too often. Wait a few seconds.");
      }
      const seconds = (recordedAt.getTime() - last.recordedAt.getTime()) / 1000;
      if (seconds <= 0) throw new HttpError(422, "That reading is older than the last one.");
      const metres = distanceMetres(last.lat, last.lng, body.lat, body.lng);
      if (metres > JITTER_METRES && metres / seconds > MAX_RIDER_SPEED_MPS) {
        throw new HttpError(422, "That position is too far from the last one to be real.");
      }
    }

    const values = {
      lat: body.lat,
      lng: body.lng,
      accuracyM: body.accuracyM ?? null,
      heading: body.heading ?? null,
      speed: body.speed ?? null,
      recordedAt,
      updatedAt: now,
    };
    await this.db
      .insertInto("delivery.riderLocations")
      .values({ riderId, ...values })
      .onConflict((oc) => oc.column("riderId").doUpdateSet(values))
      .execute();
    return { accepted: true as const, nextInSeconds: 6 };
  }

  private position(loc: Selectable<DeliveryRiderLocations>): RiderPosition {
    return {
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading,
      updatedAt: loc.recordedAt.toISOString(),
      ageSeconds: Math.max(0, Math.round((this.now().getTime() - loc.recordedAt.getTime()) / 1000)),
    };
  }

  // -------------------------------------------------------------------------------------
  // The customer follows their order
  // -------------------------------------------------------------------------------------

  private async orderInfo(orderId: string): Promise<OrderInfo | null> {
    try {
      return await this.order.get<OrderInfo>(`/internal/orders/${orderId}/payment-info`);
    } catch (error) {
      if (error instanceof InternalCallError && error.status === 404) return null;
      throw new HttpError(503, "We could not load this order right now.");
    }
  }

  /** The customer who placed the order, and nobody else. Everyone else gets a plain 404. */
  private async ownedOrder(identity: Identity, orderId: string): Promise<OrderInfo> {
    const info = identity.role === "customer" ? await this.orderInfo(orderId) : null;
    if (!info || info.userId !== identity.userId) throw new HttpError(404, "Order not found.");
    return info;
  }

  private deliveryByOrder(orderId: string) {
    return this.db
      .selectFrom("delivery.deliveries")
      .selectAll()
      .where("orderId", "=", orderId)
      .executeTakeFirst();
  }

  async tracking(identity: Identity, orderId: string): Promise<Tracking> {
    const info = await this.ownedOrder(identity, orderId);
    const row = await this.deliveryByOrder(orderId);
    const podAvailable = info.status === "delivered" && Boolean(row?.podKey);
    const idle: Tracking = {
      active: false,
      status: info.status,
      rider: null,
      store: null,
      destination: null,
      distanceKm: null,
      etaMins: null,
      podAvailable,
    };
    // Where the rider is only matters, and is only shared, while the order is on its way
    if (!row || !row.riderId || !ON_THE_WAY.includes(info.status)) return idle;

    const loc = await this.db
      .selectFrom("delivery.riderLocations")
      .selectAll()
      .where("riderId", "=", row.riderId)
      .executeTakeFirst();
    const destination =
      row.customerLat !== null && row.customerLng !== null
        ? { lat: row.customerLat, lng: row.customerLng }
        : null;
    const from = loc ? { lat: loc.lat, lng: loc.lng } : { lat: row.storeLat, lng: row.storeLng };
    const km = destination
      ? Math.round(distanceMetres(from.lat, from.lng, destination.lat, destination.lng) / 100) / 10
      : null;
    return {
      active: true,
      status: info.status,
      rider: loc ? this.position(loc) : null,
      store: { lat: row.storeLat, lng: row.storeLng },
      destination,
      distanceKm: km,
      etaMins: km === null ? null : etaMinutes(km),
      podAvailable,
    };
  }

  // -------------------------------------------------------------------------------------
  // Proof of delivery photo
  // -------------------------------------------------------------------------------------

  async uploadPod(riderId: string, deliveryId: string, body: PodUploadBody) {
    if (!this.storage) throw new HttpError(503, "Photo storage is not set up yet.");
    const row = await this.db
      .selectFrom("delivery.deliveries")
      .selectAll()
      .where("id", "=", deliveryId)
      .executeTakeFirst();
    if (!row || row.riderId !== riderId) throw new HttpError(404, "Delivery not found.");
    const late =
      row.status === "delivered" &&
      row.deliveredAt !== null &&
      this.now().getTime() - row.deliveredAt.getTime() <= POD_LATE_UPLOAD_MS;
    if (row.status !== "at_customer" && !late) {
      throw new HttpError(409, "Add the photo at the customer's door.");
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.imageBase64)) {
      throw new HttpError(400, "The photo is not valid base64.");
    }
    const bytes = Buffer.from(body.imageBase64, "base64");
    if (bytes.length > POD_MAX_BYTES) throw new HttpError(413, "The photo is too large.");
    // A JPEG starts with FF D8 FF. Anything else is refused, whatever it claims to be.
    if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new HttpError(415, "Upload a JPEG photo.");
    }

    const key = podKey(row.id);
    await this.storage.put(key, bytes);
    const uploadedAt = this.now();
    await this.db
      .updateTable("delivery.deliveries")
      .set({ podKey: key, podBytes: bytes.length, podUploadedAt: uploadedAt })
      .where("id", "=", row.id)
      .execute();
    return { uploaded: true as const, bytes: bytes.length, uploadedAt: uploadedAt.toISOString() };
  }

  /** Admins, the manager of that warehouse, the rider who took it, and the customer who ordered. */
  async readPod(identity: Identity, ref: { deliveryId?: string; orderId?: string }) {
    let query = this.db.selectFrom("delivery.deliveries").selectAll();
    query = ref.deliveryId
      ? query.where("id", "=", ref.deliveryId)
      : query.where("orderId", "=", ref.orderId as string);
    const row = await query.executeTakeFirst();
    if (!row) throw new HttpError(404, "Photo not found.");

    let allowed =
      identity.role === "admin" ||
      (identity.role === "warehouse_manager" && identity.warehouseId === row.warehouseId) ||
      (identity.role === "rider" && row.riderId === identity.userId);
    if (!allowed && identity.role === "customer") {
      const info = await this.orderInfo(row.orderId);
      allowed = info?.userId === identity.userId;
    }
    if (!allowed || !row.podKey || !this.storage) throw new HttpError(404, "Photo not found.");
    const bytes = await this.storage.get(row.podKey);
    if (!bytes) throw new HttpError(404, "Photo not found.");
    return bytes;
  }

  // -------------------------------------------------------------------------------------
  // The admin order page
  // -------------------------------------------------------------------------------------

  async adminOrderDelivery(identity: Identity, orderId: string): Promise<AdminOrderDelivery> {
    const row = await this.deliveryByOrder(orderId);
    const allowed =
      identity.role === "admin" ||
      (identity.role === "warehouse_manager" && identity.warehouseId === row?.warehouseId);
    if (!row || !allowed) throw new HttpError(404, "No delivery for this order yet.");
    let riderLocation: RiderPosition | null = null;
    if (row.riderId && RIDER_ACTIVE.includes(row.status)) {
      const loc = await this.db
        .selectFrom("delivery.riderLocations")
        .selectAll()
        .where("riderId", "=", row.riderId)
        .executeTakeFirst();
      riderLocation = loc ? this.position(loc) : null;
    }
    return {
      deliveryId: row.id,
      status: row.status as AdminOrderDelivery["status"],
      riderLocation,
      podAvailable: Boolean(row.podKey),
      podUploadedAt: row.podUploadedAt ? row.podUploadedAt.toISOString() : null,
    };
  }
}
