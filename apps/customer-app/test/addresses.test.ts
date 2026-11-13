import { describe, expect, it } from "vitest";
import {
  addAddress,
  addressTag,
  initialBook,
  migrateAddressBook,
  removeAddress,
  selectAddress,
  selectedOf,
  updateAddress,
  validateDraft,
  CURRENT_LOCATION_AREA,
  addressSummary,
  bookFromServer,
  fromServer,
  isUntouchedSeed,
  pendingUploads,
  replaceId,
  toServer,
  type AddressDraft,
} from "../src/lib/addresses";
import { coveringWarehouse, SERVICE_AREAS, servedLocally } from "../src/lib/serviceAreas";

const draft = (over: Partial<AddressDraft> = {}): AddressDraft => ({
  kind: "home",
  label: "",
  line1: "Flat 4, Green Road",
  line2: "",
  instructions: "",
  areaId: "noida-62",
  ...over,
});

describe("starting addresses", () => {
  it("starts with three addresses and Home selected", () => {
    const book = initialBook();
    expect(book.addresses.map((a) => addressTag(a))).toEqual(["Home", "Work", "Parents"]);
    expect(selectedOf(book).id).toBe("a1");
  });
});

describe("add, edit, select", () => {
  it("adds an address with the area's coordinates and selects it", () => {
    const book = addAddress(initialBook(), draft({ areaId: "noida-63" }), "n1");
    expect(book.addresses).toHaveLength(4);
    expect(book.selectedId).toBe("n1");
    expect(selectedOf(book)).toMatchObject({
      lat: 28.6301,
      lng: 77.3801,
      line1: "Flat 4, Green Road",
    });
  });

  it("trims text and drops the label for home and work", () => {
    const book = addAddress(initialBook(), draft({ label: "ignored", line1: "  Flat 4  " }), "n1");
    expect(selectedOf(book)).toMatchObject({ label: "", line1: "Flat 4" });
  });

  it("edits one address and moves its coordinates when the area changes", () => {
    const book = updateAddress(initialBook(), "a2", draft({ kind: "work", areaId: "indiranagar" }));
    const edited = book.addresses.find((a) => a.id === "a2");
    expect(edited).toMatchObject({ areaId: "indiranagar", lat: 12.9784, lng: 77.6408 });
    expect(book.addresses.find((a) => a.id === "a1")?.areaId).toBe("noida-62");
    expect(book.selectedId).toBe("a1");
  });

  it("only selects an address that exists", () => {
    expect(selectAddress(initialBook(), "a3").selectedId).toBe("a3");
    expect(selectAddress(initialBook(), "ghost").selectedId).toBe("a1");
  });

  it("names an other address by its label", () => {
    expect(addressTag({ kind: "other", label: "Gym" })).toBe("Gym");
    expect(addressTag({ kind: "other", label: " " })).toBe("Other");
  });
});

describe("delete", () => {
  it("falls back to another address when the selected one is deleted", () => {
    const book = removeAddress(initialBook(), "a1");
    expect(book.addresses.map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(book.selectedId).toBe("a2");
  });

  it("keeps the selection when another address is deleted", () => {
    expect(removeAddress(selectAddress(initialBook(), "a3"), "a1").selectedId).toBe("a3");
  });

  it("never deletes the last address", () => {
    let book = removeAddress(removeAddress(initialBook(), "a1"), "a2");
    expect(book.addresses).toHaveLength(1);
    book = removeAddress(book, "a3");
    expect(book.addresses).toHaveLength(1);
  });

  it("ignores an unknown id", () => {
    expect(removeAddress(initialBook(), "ghost")).toEqual(initialBook());
  });
});

describe("validation", () => {
  it("accepts a good address", () => {
    expect(validateDraft(draft())).toEqual({});
  });

  it("explains each problem", () => {
    const errors = validateDraft(
      draft({ kind: "other", label: "", line1: "x", areaId: "nowhere" }),
    );
    expect(errors.line1).toMatch(/flat or house/);
    expect(errors.label).toMatch(/name/);
    expect(errors.areaId).toMatch(/area/);
    expect(validateDraft(draft({ instructions: "x".repeat(201) })).instructions).toBeDefined();
    expect(validateDraft(draft({ kind: "other", label: "y".repeat(21) })).label).toMatch(
      /under 20/,
    );
  });

  it("does not ask for a name on home or work", () => {
    expect(validateDraft(draft({ kind: "work", label: "" })).label).toBeUndefined();
  });
});

describe("migration", () => {
  it("falls back to the starting addresses for nothing or junk", () => {
    for (const bad of [undefined, null, 5, "x", {}, { addresses: [] }, { addresses: [null, 3] }]) {
      expect(migrateAddressBook(bad)).toEqual(initialBook());
    }
  });

  it("upgrades old entries that had a tag and an icon", () => {
    const book = migrateAddressBook({
      addresses: [
        {
          id: "a1",
          tag: "Home",
          icon: "home",
          line1: "B-12, Sector 62",
          line2: "Noida - 201309",
          lat: 28.62,
          lng: 77.36,
        },
        {
          id: "a3",
          tag: "Parents",
          icon: "people",
          line1: "7B",
          line2: "Noida - 201301",
          lat: 28.63,
          lng: 77.38,
        },
      ],
      selectedId: "a3",
    });
    expect(book.addresses[0]).toMatchObject({ kind: "home", label: "", line2: "" });
    expect(book.addresses[1]).toMatchObject({ kind: "other", label: "Parents" });
    expect(book.selectedId).toBe("a3");
  });

  it("repairs a stale selection, duplicate ids and bad areas", () => {
    const book = migrateAddressBook({
      addresses: [
        { id: "x", kind: "home", label: "", line1: "One", areaId: "gone" },
        { id: "x", kind: "work", label: "", line1: "Dup" },
        { id: "y", kind: "weird", line1: "Two", lat: 1, lng: 2 },
      ],
      selectedId: "missing",
    });
    expect(book.addresses.map((a) => a.id)).toEqual(["x", "y"]);
    expect(book.addresses[0]?.areaId).toBe("noida-62");
    expect(book.addresses[1]?.kind).toBe("other");
    expect(book.selectedId).toBe("x");
  });

  it("keeps a good current book unchanged", () => {
    const book = addAddress(initialBook(), draft({ kind: "other", label: "Gym" }), "n1");
    expect(migrateAddressBook(book)).toEqual(book);
  });
});

describe("service areas", () => {
  it("knows which presets we deliver to", () => {
    const served = Object.fromEntries(SERVICE_AREAS.map((a) => [a.id, servedLocally(a)]));
    expect(served).toEqual({
      "noida-62": true,
      "noida-63": true,
      // Sector 18 is past the radius, but its pincode 201301 is one the Noida store delivers to
      "noida-18": true,
      indiranagar: true,
    });
  });

  it("goes by pincode when there is one, and by distance when there is not", () => {
    expect(servedLocally({ lat: 28.5708, lng: 77.3261, pincode: "110011" })).toBe(false);
    expect(servedLocally({ lat: 0, lng: 0, pincode: "560075" })).toBe(true);
    expect(servedLocally({ lat: 28.5708, lng: 77.3261 })).toBe(false);
    expect(servedLocally({ lat: 28.5708, lng: 77.3261, areaId: "noida-18" })).toBe(true);
  });

  it("names the warehouse that covers a point", () => {
    expect(coveringWarehouse(28.6208, 77.3649)).toBe("wh-noida-62");
    expect(coveringWarehouse(12.98, 77.64)).toBe("wh-indiranagar");
    expect(coveringWarehouse(19.07, 72.87)).toBeNull();
  });
});

describe("addresses pinned with the device location", () => {
  const pinned = draft({ areaId: CURRENT_LOCATION_AREA, lat: 28.6311, lng: 77.3712 });

  it("accepts a pinned spot and keeps its exact coordinates", () => {
    expect(validateDraft(pinned)).toEqual({});
    const book = addAddress(initialBook(), pinned, "p1");
    const added = book.addresses.find((a) => a.id === "p1")!;
    expect([added.lat, added.lng]).toEqual([28.6311, 77.3712]);
    expect(addressSummary(added).line2).toBe("Pinned with your location");
  });

  it("refuses a pin without coordinates", () => {
    expect(validateDraft(draft({ areaId: CURRENT_LOCATION_AREA })).areaId).toBeTruthy();
    expect(
      validateDraft(draft({ areaId: CURRENT_LOCATION_AREA, lat: 200, lng: 1 })).areaId,
    ).toBeTruthy();
  });

  it("survives a reload", () => {
    const book = addAddress(initialBook(), pinned, "p1");
    const again = migrateAddressBook(JSON.parse(JSON.stringify(book)));
    expect(again.addresses.find((a) => a.id === "p1")).toMatchObject({
      areaId: CURRENT_LOCATION_AREA,
      lat: 28.6311,
    });
  });
});

describe("server mapping", () => {
  it("sends the area's pincode, and no area for a pinned spot", () => {
    const seed = initialBook().addresses[2]!;
    expect(toServer(seed)).toMatchObject({
      kind: "other",
      label: "Parents",
      areaId: "noida-63",
      pincode: "201301",
    });
    const book = addAddress(
      initialBook(),
      draft({ areaId: CURRENT_LOCATION_AREA, lat: 28.6, lng: 77.3 }),
      "p",
    );
    expect(toServer(book.addresses.find((a) => a.id === "p")!)).toMatchObject({
      areaId: null,
      pincode: null,
    });
  });

  it("reads a server row back, treating an unknown area as a pinned spot", () => {
    const base = {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "home" as const,
      label: "",
      line1: "X road",
      line2: "",
      landmark: "",
      instructions: "",
      lat: 1,
      lng: 2,
      pincode: null,
      isDefault: true,
      createdAt: "",
      updatedAt: "",
    };
    expect(fromServer({ ...base, areaId: "noida-62" }).areaId).toBe("noida-62");
    expect(fromServer({ ...base, areaId: null }).areaId).toBe(CURRENT_LOCATION_AREA);
  });

  it("knows which starting addresses were never changed", () => {
    const seed = initialBook().addresses[0]!;
    expect(isUntouchedSeed(seed)).toBe(true);
    expect(isUntouchedSeed({ ...seed, line1: "Changed" })).toBe(false);
  });

  it("skips duplicates within the device list too", () => {
    const one = { ...initialBook().addresses[0]!, id: "x1", line1: "Same Road" };
    const two = { ...one, id: "x2", line1: " same road" };
    expect(pendingUploads([one, two], []).map((a) => a.id)).toEqual(["x1"]);
  });

  it("swaps a temporary id for the server one, keeping the selection", () => {
    const book = addAddress(initialBook(), draft(), "tmp");
    const saved = {
      ...book.addresses.find((a) => a.id === "tmp")!,
      id: "00000000-0000-4000-8000-000000000009",
    };
    const next = replaceId(book, "tmp", saved);
    expect(next.selectedId).toBe(saved.id);
    expect(next.addresses.some((a) => a.id === "tmp")).toBe(false);
  });

  it("falls back to the starting addresses when nothing is left anywhere", () => {
    expect(bookFromServer([], { addresses: [], selectedId: "" }).selectedId).toBe("a1");
  });
});
