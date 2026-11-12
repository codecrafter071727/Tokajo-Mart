import { z } from "zod";

/** Money is integer paise everywhere on the wire. Clients convert for display. */
const paise = z.number().int().nonnegative();

export const imageFitSchema = z.enum(["cover", "contain"]);

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Shown while there is no photo, and as a fallback if it fails to load */
  emoji: z.string(),
  /** Pastel tile colour used behind the photo */
  color: z.string(),
  imageUrl: z.url().nullable(),
  imageFit: imageFitSchema,
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Pack size, for example "500 ml" */
  unit: z.string(),
  pricePaise: paise,
  mrpPaise: paise,
  /** Whole percent, 0 when there is no discount */
  discountPercent: z.number().int().min(0).max(100),
  categoryId: z.string().min(1),
  emoji: z.string(),
  imageUrl: z.url().nullable(),
  imageFit: imageFitSchema,
  /** Delivery promise for this item, in minutes */
  deliveryMins: z.number().int().positive(),
  /** Greater than 1 when the product has variants */
  optionsCount: z.number().int().positive().nullable(),
  description: z.string().nullable(),
});
export type Product = z.infer<typeof productSchema>;

export const listCategoriesResponseSchema = z.object({
  items: z.array(categorySchema),
});
export type ListCategoriesResponse = z.infer<typeof listCategoriesResponseSchema>;

export const listProductsQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  /** Free text search over name, pack size and category */
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  /** Opaque cursor returned by the previous page */
  cursor: z.string().min(1).optional(),
});
/** What a client may send. The schema above adds coercion and the default limit on the server. */
export type ListProductsQuery = {
  categoryId?: string;
  q?: string;
  limit?: number;
  cursor?: string;
};

export const listProductsResponseSchema = z.object({
  items: z.array(productSchema),
  nextCursor: z.string().nullable(),
});
export type ListProductsResponse = z.infer<typeof listProductsResponseSchema>;

export const productParamsSchema = z.object({ id: z.string().min(1) });
