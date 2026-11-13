import type { CreateAddressBody, CustomerAddress } from "@qc/contracts";
import { findArea } from "./serviceAreas";

/** areaId for an address placed with the device location instead of a preset area. */
export const CURRENT_LOCATION_AREA = "current";

export type AddressKind = "home" | "work" | "other";

export type SavedAddress = {
  id: string;
  kind: AddressKind;
  /** Name shown for an "other" address, for example "Parents". Home and Work ignore it. */
  label: string;
  /** Flat or house number and street */
  line1: string;
  /** Landmark or building, optional */
  line2: string;
  /** What the rider should know at the door, optional */
  instructions: string;
  areaId: string;
  lat: number;
  lng: number;
  /** The account default on the server. Only set for addresses saved to the server. */
  isDefault?: boolean;
};

/** What the form edits. Coordinates come from the area preset, or from the device location. */
export type AddressDraft = Omit<SavedAddress, "id" | "lat" | "lng" | "isDefault"> & {
  lat?: number;
  lng?: number;
};

export type AddressBook = { addresses: SavedAddress[]; selectedId: string };

/** The three addresses the app has always started with, so a first run still works. */
export const SEED_ADDRESSES: SavedAddress[] = [
  {
    id: "a1",
    kind: "home",
    label: "",
    line1: "B-12, Sector 62",
    line2: "",
    instructions: "",
    areaId: "noida-62",
    lat: 28.6208,
    lng: 77.3649,
  },
  {
    id: "a2",
    kind: "work",
    label: "",
    line1: "Tower 3, Logix Cyber Park, Sector 62",
    line2: "",
    instructions: "",
    areaId: "noida-62",
    lat: 28.6262,
    lng: 77.3722,
  },
  {
    id: "a3",
    kind: "other",
    label: "Parents",
    line1: "7B, Sector 63",
    line2: "",
    instructions: "",
    areaId: "noida-63",
    lat: 28.6301,
    lng: 77.3801,
  },
];

export const initialBook = (): AddressBook => ({
  addresses: SEED_ADDRESSES.map((a) => ({ ...a })),
  selectedId: "a1",
});

/** What the order and the screens call an address: Home, Work, or the custom label. */
export function addressTag(a: Pick<SavedAddress, "kind" | "label">): string {
  if (a.kind === "home") return "Home";
  if (a.kind === "work") return "Work";
  return a.label.trim() || "Other";
}

export function addressSummary(a: SavedAddress): { line1: string; line2: string } {
  const area = findArea(a.areaId);
  const place = area
    ? `${area.name}, ${area.city} - ${area.pincode}`
    : a.areaId === CURRENT_LOCATION_AREA
      ? "Pinned with your location"
      : "";
  return { line1: a.line1, line2: [a.line2, place].filter(Boolean).join(", ") };
}

/** Short text for the home header chip. */
export function addressChip(a: SavedAddress): string {
  const area = findArea(a.areaId);
  return `${addressTag(a)} - ${area ? `${area.name}, ${area.city}` : a.line1}`;
}

export type DraftErrors = Partial<
  Record<"line1" | "line2" | "label" | "instructions" | "areaId", string>
>;

export function validateDraft(draft: AddressDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.line1.trim().length < 3) errors.line1 = "Enter your flat or house number and street.";
  else if (draft.line1.trim().length > 200)
    errors.line1 = "That is too long. Keep it under 200 characters.";
  if (draft.line2.trim().length > 150) errors.line2 = "Keep the landmark under 150 characters.";
  if (draft.instructions.trim().length > 200) {
    errors.instructions = "Keep delivery instructions under 200 characters.";
  }
  if (draft.kind === "other") {
    if (draft.label.trim().length < 2) errors.label = "Give this address a name, like Parents.";
    else if (draft.label.trim().length > 20) errors.label = "Keep the name under 20 characters.";
  }
  const pinned = draft.areaId === CURRENT_LOCATION_AREA && validCoordinates(draft.lat, draft.lng);
  if (!findArea(draft.areaId) && !pinned) {
    errors.areaId = "Choose the area this address is in, or use your current location.";
  }
  return errors;
}

const clean = ({ lat: _lat, lng: _lng, ...d }: AddressDraft) => ({
  ...d,
  label: d.kind === "other" ? d.label.trim() : "",
  line1: d.line1.trim(),
  line2: d.line2.trim(),
  instructions: d.instructions.trim(),
});

export function validCoordinates(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function withCoordinates(draft: AddressDraft, fallback?: SavedAddress) {
  if (draft.areaId === CURRENT_LOCATION_AREA && validCoordinates(draft.lat, draft.lng)) {
    return { lat: draft.lat as number, lng: draft.lng as number };
  }
  const area = findArea(draft.areaId);
  return { lat: area?.lat ?? fallback?.lat ?? 0, lng: area?.lng ?? fallback?.lng ?? 0 };
}

/** Adds an address and selects it. */
export function addAddress(book: AddressBook, draft: AddressDraft, id: string): AddressBook {
  const d = clean(draft);
  const added: SavedAddress = { ...d, id, ...withCoordinates(draft) };
  return { addresses: [...book.addresses, added], selectedId: id };
}

export function updateAddress(book: AddressBook, id: string, draft: AddressDraft): AddressBook {
  const d = clean(draft);
  return {
    ...book,
    addresses: book.addresses.map((a) =>
      a.id === id ? { ...d, id, isDefault: a.isDefault, ...withCoordinates(draft, a) } : a,
    ),
  };
}

/** Removes an address. The last one cannot be removed, and deleting the selected one picks another. */
export function removeAddress(book: AddressBook, id: string): AddressBook {
  if (book.addresses.length <= 1 || !book.addresses.some((a) => a.id === id)) return book;
  const addresses = book.addresses.filter((a) => a.id !== id);
  const selectedId = book.selectedId === id ? (addresses[0] as SavedAddress).id : book.selectedId;
  return { addresses, selectedId };
}

export function selectAddress(book: AddressBook, id: string): AddressBook {
  return book.addresses.some((a) => a.id === id) ? { ...book, selectedId: id } : book;
}

export const selectedOf = (book: AddressBook): SavedAddress =>
  book.addresses.find((a) => a.id === book.selectedId) ?? (book.addresses[0] as SavedAddress);

const KINDS: AddressKind[] = ["home", "work", "other"];

/**
 * Turns whatever was saved by any earlier version into a valid address book. Anything unreadable
 * falls back to the starting addresses, and a stale selection falls back to the first address.
 * Old entries kept a `tag` and an `icon` instead of `kind` and `label`.
 */
export function migrateAddressBook(persisted: unknown): AddressBook {
  const fresh = initialBook();
  if (!persisted || typeof persisted !== "object") return fresh;
  const raw = (persisted as { addresses?: unknown; selectedId?: unknown }).addresses;
  if (!Array.isArray(raw)) return fresh;

  const seen = new Set<string>();
  const addresses: SavedAddress[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === "string" && e.id ? e.id : null;
    if (!id || seen.has(id) || typeof e.line1 !== "string" || !e.line1.trim()) continue;

    let kind: AddressKind = KINDS.includes(e.kind as AddressKind)
      ? (e.kind as AddressKind)
      : "other";
    let label = typeof e.label === "string" ? e.label : "";
    if (typeof e.tag === "string" && !KINDS.includes(e.kind as AddressKind)) {
      const tag = e.tag.trim().toLowerCase();
      kind = tag === "home" ? "home" : tag === "work" ? "work" : "other";
      label = kind === "other" ? e.tag.trim() : "";
    }
    const pinned = e.areaId === CURRENT_LOCATION_AREA && validCoordinates(e.lat, e.lng);
    const areaId =
      typeof e.areaId === "string" && (findArea(e.areaId) || pinned) ? e.areaId : "noida-62";
    const area = findArea(areaId);
    const lat = typeof e.lat === "number" ? e.lat : (area?.lat ?? 0);
    const lng = typeof e.lng === "number" ? e.lng : (area?.lng ?? 0);
    const line2 = typeof e.line2 === "string" ? e.line2 : "";
    seen.add(id);
    addresses.push({
      id,
      kind,
      label,
      line1: e.line1.trim(),
      line2: line2.includes(" - 2") ? "" : line2, // old line2 was "Noida - 201309": the area covers it now
      instructions: typeof e.instructions === "string" ? e.instructions : "",
      areaId,
      lat,
      lng,
    });
  }
  if (addresses.length === 0) return fresh;
  const selectedId = (persisted as { selectedId?: unknown }).selectedId;
  return {
    addresses,
    selectedId:
      typeof selectedId === "string" && seen.has(selectedId)
        ? selectedId
        : (addresses[0] as SavedAddress).id,
  };
}

// -------------------------------------------------------------------------------------------
// Server sync: the account's addresses live in the identity service when a backend is set
// -------------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saved on the server (a uuid), as opposed to the starting addresses or one still being saved. */
export const isServerId = (id: string) => UUID.test(id);

export function fromServer(row: CustomerAddress): SavedAddress {
  const area = row.areaId ? findArea(row.areaId) : undefined;
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    instructions: row.instructions,
    areaId: area ? area.id : CURRENT_LOCATION_AREA,
    lat: row.lat,
    lng: row.lng,
    isDefault: row.isDefault,
  };
}

export function toServer(a: SavedAddress): CreateAddressBody {
  const area = findArea(a.areaId);
  return {
    kind: a.kind,
    label: a.kind === "other" ? a.label : "",
    line1: a.line1,
    line2: a.line2,
    landmark: "",
    instructions: a.instructions,
    lat: a.lat,
    lng: a.lng,
    pincode: area?.pincode ?? null,
    areaId: area ? area.id : null,
  };
}

const sameSpot = (a: Pick<SavedAddress, "line1" | "lat" | "lng">, b: typeof a) =>
  a.line1.trim().toLowerCase() === b.line1.trim().toLowerCase() &&
  Math.abs(a.lat - b.lat) < 0.0005 &&
  Math.abs(a.lng - b.lng) < 0.0005;

/** True for one of the starting addresses that the customer never changed. */
export function isUntouchedSeed(a: SavedAddress): boolean {
  const seed = SEED_ADDRESSES.find((s) => s.id === a.id);
  return Boolean(
    seed &&
    seed.kind === a.kind &&
    seed.label === a.label &&
    seed.line1 === a.line1 &&
    seed.line2 === a.line2 &&
    seed.instructions === a.instructions &&
    seed.areaId === a.areaId,
  );
}

/**
 * Addresses saved only on this device that should move to the account the first time the
 * customer signs in: anything they added or edited, minus what the server already has.
 */
export function pendingUploads(local: SavedAddress[], server: SavedAddress[]): SavedAddress[] {
  const out: SavedAddress[] = [];
  for (const a of local) {
    if (isServerId(a.id) || isUntouchedSeed(a)) continue;
    if (server.some((s) => sameSpot(s, a)) || out.some((o) => sameSpot(o, a))) continue;
    out.push(a);
  }
  return out;
}

/**
 * The address book after loading the account's addresses. Keeps the customer's current choice
 * when it still exists, else the account default. With nothing saved on the account yet, the
 * starting addresses stay so the app can still show prices and delivery times.
 */
export function bookFromServer(server: SavedAddress[], current: AddressBook): AddressBook {
  if (server.length === 0) {
    const local = current.addresses.filter((a) => !isServerId(a.id));
    return local.length > 0
      ? { addresses: local, selectedId: selectedOf({ ...current, addresses: local }).id }
      : initialBook();
  }
  const keep = server.some((a) => a.id === current.selectedId);
  const fallback = server.find((a) => a.isDefault) ?? (server[0] as SavedAddress);
  return { addresses: server, selectedId: keep ? current.selectedId : fallback.id };
}

/** Swaps a temporary id for the one the server gave, keeping the selection on it. */
export function replaceId(book: AddressBook, from: string, saved: SavedAddress): AddressBook {
  return {
    addresses: book.addresses.map((a) => (a.id === from ? saved : a)),
    selectedId: book.selectedId === from ? saved.id : book.selectedId,
  };
}
