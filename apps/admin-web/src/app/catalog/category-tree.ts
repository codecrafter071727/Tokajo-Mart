import type { Category } from "@qc/contracts";

export type CategoryNode = Category & { children: Category[] };

const bySort = (a: Category, b: Category) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/**
 * Top level categories in display order, each with its sub categories. A sub category whose parent
 * is missing is shown at the top level so it never disappears from the screen.
 */
export function categoryTree(categories: Category[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(bySort);
  return roots.map((root) => ({
    ...root,
    children: categories.filter((c) => c.parentId === root.id).sort(bySort),
  }));
}

/** Options for a category picker: parents, then their children indented underneath. */
export function categoryOptions(categories: Category[]): { id: string; label: string }[] {
  return categoryTree(categories).flatMap((root) => [
    { id: root.id, label: root.name },
    ...root.children.map((child) => ({ id: child.id, label: `  ↳ ${child.name}` })),
  ]);
}

/**
 * The sort orders to send so `id` moves one place up or down among its siblings. Returns the two
 * categories to update, or nothing when it is already at that end. Equal sort orders are spread out
 * first so a swap always changes the order on screen.
 */
export function moveWithinSiblings(
  categories: Category[],
  id: string,
  direction: -1 | 1,
): { id: string; sortOrder: number }[] {
  const target = categories.find((c) => c.id === id);
  if (!target) return [];
  const siblings = categories
    .filter((c) => (c.parentId ?? null) === (target.parentId ?? null))
    .sort(bySort);
  const index = siblings.findIndex((c) => c.id === id);
  const other = siblings[index + direction];
  if (!other) return [];
  // Renumber the siblings 10, 20, 30... with the two swapped, and send only what changed
  const order = siblings.map((c) => c.id);
  order[index] = other.id;
  order[index + direction] = id;
  return order
    .map((cid, i) => ({ id: cid, sortOrder: (i + 1) * 10 }))
    .filter((next) => categories.find((c) => c.id === next.id)?.sortOrder !== next.sortOrder);
}
