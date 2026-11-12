import { createInternalClient, type InternalClient } from "@qc/service-kit";
import { env } from "../../config/env";

export type Clients = {
  catalog: InternalClient;
  inventory: InternalClient;
  delivery: InternalClient;
  identity: InternalClient;
};

export function createClients(): Clients {
  const make = (baseUrl: string | undefined, fallback: string) =>
    createInternalClient({ baseUrl: baseUrl ?? fallback, apiKey: env.INTERNAL_API_KEY });
  return {
    identity: make(env.IDENTITY_SERVICE_URL, "http://localhost:4001"),
    catalog: make(env.CATALOG_SERVICE_URL, "http://localhost:4002"),
    inventory: make(env.WAREHOUSE_INVENTORY_SERVICE_URL, "http://localhost:4003"),
    delivery: make(env.DELIVERY_SERVICE_URL, "http://localhost:4006"),
  };
}

// The shapes of the other services' internal answers that the order service reads
export type CatalogProduct = {
  id: string;
  name: string;
  unit: string;
  pricePaise: number;
  mrpPaise: number;
  emoji: string;
  imageUrl: string | null;
};
export type ResolveResult = {
  serviceable: boolean;
  warehouseId: string | null;
  etaMins: number | null;
  distanceKm: number | null;
  reason: string | null;
  unavailable: { productId: string; requested: number; available: number }[];
};
export type WarehouseInfo = { id: string; name: string; lat: number; lng: number; open: boolean };
