import { findArea } from "./serviceAreas";

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
};

export type AddressDraft = Omit<SavedAddress, "id" | "lat" | "lng">;

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
  const place = area ? `${area.name}, ${area.city} - ${area.pincode}` : "";
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
  if (!findArea(draft.areaId)) errors.areaId = "Choose the area this address is in.";
  return errors;
}

const clean = (d: AddressDraft): AddressDraft => ({
  ...d,
  label: d.kind === "other" ? d.label.trim() : "",
  line1: d.line1.trim(),
  line2: d.line2.trim(),
  instructions: d.instructions.trim(),
});

function withCoordinates(draft: AddressDraft, fallback?: SavedAddress) {
  const area = findArea(draft.areaId);
  return { lat: area?.lat ?? fallback?.lat ?? 0, lng: area?.lng ?? fallback?.lng ?? 0 };
}

/** Adds an address and selects it. */
export function addAddress(book: AddressBook, draft: AddressDraft, id: string): AddressBook {
  const d = clean(draft);
  const added: SavedAddress = { ...d, id, ...withCoordinates(d) };
  return { addresses: [...book.addresses, added], selectedId: id };
}

export function updateAddress(book: AddressBook, id: string, draft: AddressDraft): AddressBook {
  const d = clean(draft);
  return {
    ...book,
    addresses: book.addresses.map((a) =>
      a.id === id ? { ...d, id, ...withCoordinates(d, a) } : a,
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
    const areaId = typeof e.areaId === "string" && findArea(e.areaId) ? e.areaId : "noida-62";
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
