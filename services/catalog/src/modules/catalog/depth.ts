// Catalog depth helpers shared by both repositories: search tokens and typo matching, and the CSV
// format for import and export. Pure functions, so the in-memory and Postgres repositories agree.
import { CATALOG_CSV_COLUMNS, type ImportRowError, type Product } from "@qc/contracts";
import { slugify } from "./errors";

// ---------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------

/** A typo match needs at least this many characters, so short searches stay precise. */
export const MIN_TYPO_LENGTH = 4;
/** How much of the search must appear in a word of the name (pg_trgm word_similarity). */
export const TYPO_THRESHOLD = 0.45;

/**
 * The words of a search used for full text matching: letters and digits only, at least two
 * characters (so "a_b" or "%" never match everything), at most six words.
 */
export function searchTokens(q: string): string[] {
  return (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length >= 2).slice(0, 6);
}

/** A prefix tsquery for the tokens, safe to pass to to_tsquery because tokens are alphanumeric. */
export function prefixTsQuery(tokens: string[]): string {
  return tokens.map((t) => `${t}:*`).join(" & ");
}

/** Trigrams the way pg_trgm makes them: each word padded with two spaces in front and one after. */
function trigrams(word: string): Set<string> {
  const padded = `  ${word} `;
  const set = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

/**
 * Close to pg_trgm's word_similarity(needle, text) for a one word needle: the share of the
 * needle's trigrams found in the best matching word of the text.
 */
export function wordSimilarity(needle: string, text: string): number {
  const words = needle.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return 0;
  const target = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(trigrams);
  let shared = 0;
  let total = 0;
  for (const word of words) {
    const grams = trigrams(word);
    total += grams.size;
    let best = 0;
    for (const t of target) {
      let n = 0;
      for (const g of grams) if (t.has(g)) n += 1;
      best = Math.max(best, n);
    }
    shared += best;
  }
  return total === 0 ? 0 : shared / total;
}

/** True when every search token starts a word somewhere in the given texts. */
export function tokensMatch(tokens: string[], texts: (string | null | undefined)[]): boolean {
  if (tokens.length === 0) return false;
  const words = texts.flatMap((t) => (t ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return tokens.every((token) => words.some((w) => w.startsWith(token)));
}

/** The label shown for a variant: its own label, or the pack size when it has none. */
export const variantLabelOf = (p: { variantLabel?: string | null; unit: string }) =>
  p.variantLabel ?? p.unit;

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

/** Parses RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry nothing
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote anything with a separator, a quote or a line break, and neutralise spreadsheet formulas
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) || safe !== text ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const MAX_IMPORT_ROWS = 2000;

/** One validated line of an import file. Category and group are still names or ids here. */
export type ImportRow = {
  line: number;
  id: string | null;
  name: string;
  unit: string;
  pricePaise: number;
  mrpPaise: number;
  category: string;
  brand: string | null;
  tags: string[];
  imageUrl: string | null;
  variantGroup: string | null;
  variantLabel: string | null;
  description: string | null;
};

export type ImportPlan = {
  creates: number;
  updates: number;
  groupsCreated: string[];
  errors: ImportRowError[];
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Rupees as typed in a sheet ("45", "45.5", "1,299.00") into whole paise. Null when not money. */
export function rupeesToPaise(value: string): number | null {
  const clean = value.trim().replace(/^₹/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const paise = Math.round(Number(clean) * 100);
  return Number.isSafeInteger(paise) && paise <= 100_000_000 ? paise : null;
}

const paiseToRupees = (paise: number) => {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
};

/**
 * Reads an import file into rows and the problems found in it. Checks what can be checked without
 * the database: columns, required values, money, links, tags, duplicate ids. Names of categories
 * and groups are resolved by the repository.
 */
export function parseImportCsv(text: string): { rows: ImportRow[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  if (header.length === 0) {
    return { rows: [], errors: [{ line: 1, column: null, message: "The file is empty." }] };
  }
  const known = new Set<string>(CATALOG_CSV_COLUMNS);
  for (const column of header) {
    if (!known.has(column)) {
      errors.push({ line: 1, column, message: `Unknown column "${column}".` });
    }
  }
  for (const required of ["name", "unit", "price", "mrp", "category"]) {
    if (!header.includes(required)) {
      errors.push({ line: 1, column: required, message: `The "${required}" column is missing.` });
    }
  }
  if (new Set(header).size !== header.length) {
    errors.push({ line: 1, column: null, message: "A column appears twice." });
  }
  if (errors.length > 0) return { rows: [], errors };
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [
        { line: 1, column: null, message: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` },
      ],
    };
  }

  const rows: ImportRow[] = [];
  const seenIds = new Map<string, number>();
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (column: string) => (cells[header.indexOf(column)] ?? "").trim();
    const opt = (column: string) =>
      header.includes(column) && get(column) !== "" ? get(column) : null;
    const fail = (column: string | null, message: string) => errors.push({ line, column, message });
    const before = errors.length;

    if (cells.length > header.length) fail(null, "This row has more cells than the header.");
    const id = opt("id")?.toLowerCase() ?? null;
    if (id !== null) {
      if (!ID_PATTERN.test(id)) fail("id", "Use lowercase letters, digits and dashes, up to 40.");
      const first = seenIds.get(id);
      if (first !== undefined) fail("id", `The same id is on line ${first}.`);
      else seenIds.set(id, line);
    }
    const name = get("name");
    if (name === "" || name.length > 120) fail("name", "Give a name of up to 120 characters.");
    const unit = get("unit");
    if (unit === "" || unit.length > 40) fail("unit", "Give a pack size of up to 40 characters.");
    const pricePaise = rupeesToPaise(get("price"));
    if (pricePaise === null) fail("price", "Write the price in rupees, for example 45 or 45.50.");
    const mrpPaise = rupeesToPaise(get("mrp"));
    if (mrpPaise === null) fail("mrp", "Write the MRP in rupees, for example 50.");
    if (pricePaise !== null && mrpPaise !== null && pricePaise > mrpPaise) {
      fail("price", "The selling price cannot be higher than the MRP.");
    }
    const category = get("category");
    if (category === "") fail("category", "Say which category, by id or name.");
    const brand = opt("brand");
    if (brand !== null && brand.length > 60) fail("brand", "Keep the brand to 60 characters.");
    const tags = [
      ...new Set(
        (opt("tags") ?? "")
          .split(/[|;]/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (tags.length > 10 || tags.some((t) => t.length > 30)) {
      fail("tags", "Up to 10 tags of up to 30 characters, separated by | or ;.");
    }
    const imageUrl = opt("image_url");
    if (imageUrl !== null) {
      let ok: boolean;
      try {
        ok = new URL(imageUrl).protocol === "https:";
      } catch {
        ok = false;
      }
      if (!ok) fail("image_url", "Use an https image link.");
    }
    const variantGroup = opt("variant_group");
    if (variantGroup !== null && variantGroup.length > 120) {
      fail("variant_group", "Keep the group to 120 characters.");
    }
    const variantLabel = opt("variant_label");
    if (variantLabel !== null && variantLabel.length > 40) {
      fail("variant_label", "Keep the variant label to 40 characters.");
    }
    if (variantLabel !== null && variantGroup === null) {
      fail("variant_label", "A variant label needs a variant_group.");
    }
    const description = opt("description");
    if (description !== null && description.length > 2000) {
      fail("description", "Keep the description to 2000 characters.");
    }

    if (errors.length === before) {
      rows.push({
        line,
        id,
        name,
        unit,
        pricePaise: pricePaise as number,
        mrpPaise: mrpPaise as number,
        category,
        brand,
        tags,
        imageUrl,
        variantGroup,
        variantLabel,
        description,
      });
    }
  });
  if (table.length <= 1) errors.push({ line: 1, column: null, message: "The file has no rows." });
  return { rows, errors };
}

/** The catalog as CSV, in the same columns the import reads, so an export can be edited and re-imported. */
export function productsToCsv(products: Product[]): string {
  const lines = [CATALOG_CSV_COLUMNS.join(",")];
  for (const p of products) {
    lines.push(
      [
        p.id,
        p.name,
        p.unit,
        paiseToRupees(p.pricePaise),
        paiseToRupees(p.mrpPaise),
        p.categoryId,
        p.brand ?? "",
        (p.tags ?? []).join("|"),
        p.imageUrl ?? "",
        p.groupId ?? "",
        p.variantLabel ?? "",
        p.description ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** A stable id for a group made from its name, so importing the same file twice finds the same group. */
export const groupIdFromName = (slug: string) => `g-${slug}`.slice(0, 60);

export type ResolvedImportRow = ImportRow & {
  categoryId: string;
  groupId: string | null;
  exists: boolean;
};
export type NewImportGroup = { id: string; name: string; categoryId: string; brand: string | null };

/**
 * Resolves import rows against what the catalog has: category by id or name, product group by id
 * or name (a new name makes a new group), and whether each id already exists. Pure, so both
 * repositories plan an import the same way.
 */
export function planImportRows(
  rows: ImportRow[],
  catalog: {
    categories: { id: string; name: string }[];
    groups: { id: string; name: string }[];
    existingIds: Set<string>;
  },
): { resolved: ResolvedImportRow[]; groupsCreated: NewImportGroup[]; plan: ImportPlan } {
  const errors: ImportRowError[] = [];
  const groupsCreated: NewImportGroup[] = [];
  const resolved: ResolvedImportRow[] = [];
  for (const row of rows) {
    const wanted = row.category.toLowerCase();
    const category = catalog.categories.find(
      (c) => c.id === row.category || c.name.toLowerCase() === wanted,
    );
    if (!category) {
      errors.push({
        line: row.line,
        column: "category",
        message: `No category "${row.category}".`,
      });
      continue;
    }
    let groupId: string | null = null;
    if (row.variantGroup !== null) {
      const key = row.variantGroup.toLowerCase();
      const found =
        catalog.groups.find((g) => g.id === row.variantGroup || g.name.toLowerCase() === key) ??
        groupsCreated.find((g) => g.name.toLowerCase() === key);
      if (found) {
        groupId = found.id;
      } else {
        const slug = slugify(row.variantGroup);
        if (slug === "") {
          errors.push({
            line: row.line,
            column: "variant_group",
            message: "The group name needs letters or numbers.",
          });
          continue;
        }
        const id = groupIdFromName(slug);
        if (catalog.groups.some((g) => g.id === id) || groupsCreated.some((g) => g.id === id)) {
          errors.push({
            line: row.line,
            column: "variant_group",
            message: `A different group already uses the id ${id}. Use that group's exact name or id.`,
          });
          continue;
        }
        groupsCreated.push({
          id,
          name: row.variantGroup,
          categoryId: category.id,
          brand: row.brand,
        });
        groupId = id;
      }
    }
    const exists = row.id !== null && catalog.existingIds.has(row.id);
    resolved.push({ ...row, categoryId: category.id, groupId, exists });
  }
  return {
    resolved,
    groupsCreated,
    plan: {
      creates: resolved.filter((r) => !r.exists).length,
      updates: resolved.filter((r) => r.exists).length,
      groupsCreated: groupsCreated.map((g) => g.id),
      errors,
    },
  };
}
