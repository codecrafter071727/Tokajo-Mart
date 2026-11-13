/** A problem with an admin request, carrying the HTTP status the service kit answers with. */
export class CatalogError extends Error {
  readonly statusCode: 400 | 404 | 409;
  /** Structured detail for the caller, for example the rows of an import that failed */
  readonly details?: unknown;
  constructor(statusCode: 400 | 404 | 409, message: string, details?: unknown) {
    super(message);
    this.name = "CatalogError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** A stable readable id for a category, made from its name: "Fruits & Veggies" -> "fruits-veggies". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** "p-" and 8 hex characters: short, readable in URLs, and not guessable in order. */
export function newProductId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `p-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** A banner is on show while it is active and now is inside its optional window. */
export function bannerIsLive(
  banner: { active: boolean; startsAt: string | null; endsAt: string | null },
  now: Date,
): boolean {
  if (!banner.active) return false;
  if (banner.startsAt && Date.parse(banner.startsAt) > now.getTime()) return false;
  if (banner.endsAt && Date.parse(banner.endsAt) <= now.getTime()) return false;
  return true;
}

/** "g-" and 8 hex characters for a product group made in the admin. */
export function newGroupId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `g-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
