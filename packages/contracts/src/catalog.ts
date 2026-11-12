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

const imageUrlField = z.url({ protocol: /^https$/, message: "Use an https image link." });
const nameField = z.string().trim().min(1).max(120);
const unitField = z.string().trim().min(1).max(40);
const descriptionField = z.string().trim().max(2000);

/** Admin: add a product. The server makes the id. The price may not be above the MRP. */
export const createProductBodySchema = z
  .object({
    name: nameField,
    unit: unitField,
    pricePaise: paise,
    mrpPaise: paise,
    categoryId: z.string().min(1),
    emoji: z.string().trim().max(16).default(""),
    imageUrl: imageUrlField.nullable().default(null),
    imageFit: imageFitSchema.default("contain"),
    deliveryMins: z.number().int().min(1).max(120).default(10),
    optionsCount: z.number().int().min(1).max(50).nullable().default(null),
    description: descriptionField.nullable().default(null),
  })
  .strict()
  .refine((body) => body.pricePaise <= body.mrpPaise, {
    message: "The selling price cannot be higher than the MRP.",
    path: ["pricePaise"],
  });
export type CreateProductBody = z.input<typeof createProductBodySchema>;
export type NewProduct = z.output<typeof createProductBodySchema>;

/** Admin edit of a product. Send only the fields that change; at least one is required. */
export const updateProductBodySchema = z
  .object({
    name: nameField.optional(),
    unit: unitField.optional(),
    pricePaise: paise.optional(),
    mrpPaise: paise.optional(),
    description: descriptionField.nullable().optional(),
    categoryId: z.string().min(1).optional(),
    emoji: z.string().trim().max(16).optional(),
    imageUrl: imageUrlField.nullable().optional(),
    imageFit: imageFitSchema.optional(),
    deliveryMins: z.number().int().min(1).max(120).optional(),
    optionsCount: z.number().int().min(1).max(50).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field to change.",
  });
export type UpdateProductBody = {
  name?: string;
  unit?: string;
  pricePaise?: number;
  mrpPaise?: number;
  description?: string | null;
  categoryId?: string;
  emoji?: string;
  imageUrl?: string | null;
  imageFit?: "cover" | "contain";
  deliveryMins?: number;
  optionsCount?: number | null;
};

/** What the admin table shows: every product, with whether it has been taken off sale. */
export const adminProductSchema = productSchema.extend({ archived: z.boolean() });
export type AdminProduct = z.infer<typeof adminProductSchema>;
export const listAdminProductsResponseSchema = z.object({
  items: z.array(adminProductSchema),
  nextCursor: z.string().nullable(),
});
export type ListAdminProductsResponse = z.infer<typeof listAdminProductsResponseSchema>;

// --- Categories ------------------------------------------------------------------------------

const colorField = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #E8F5E9.");

export const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    emoji: z.string().trim().max(16).default(""),
    color: colorField.default("#F3F6F5"),
    imageUrl: imageUrlField.nullable().default(null),
    imageFit: imageFitSchema.default("cover"),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();
export type CreateCategoryBody = z.input<typeof createCategoryBodySchema>;
export type NewCategory = z.output<typeof createCategoryBodySchema>;

export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    emoji: z.string().trim().max(16).optional(),
    color: colorField.optional(),
    imageUrl: imageUrlField.nullable().optional(),
    imageFit: imageFitSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field to change.",
  });
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;

export const categoryParamsSchema = z.object({ id: z.string().min(1) });

// --- Banners ---------------------------------------------------------------------------------

export const bannerLinkTypeSchema = z.enum(["category", "product", "none"]);

export const bannerSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  subtitle: z.string(),
  imageUrl: z.string().nullable(),
  linkType: bannerLinkTypeSchema,
  /** A category id or product id, depending on linkType. Null when linkType is none. */
  linkTarget: z.string().nullable(),
  color: z.string(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  /** ISO times. Null means no start or no end. */
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});
export type Banner = z.infer<typeof bannerSchema>;
export const listBannersResponseSchema = z.object({ items: z.array(bannerSchema) });
export type ListBannersResponse = z.infer<typeof listBannersResponseSchema>;

const bannerFields = {
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(160),
  imageUrl: imageUrlField.nullable(),
  linkType: bannerLinkTypeSchema,
  linkTarget: z.string().min(1).nullable(),
  color: colorField,
  sortOrder: z.number().int().min(0).max(10_000),
  active: z.boolean(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
};

export const createBannerBodySchema = z
  .object({
    title: bannerFields.title,
    subtitle: bannerFields.subtitle.default(""),
    imageUrl: bannerFields.imageUrl.default(null),
    linkType: bannerFields.linkType.default("none"),
    linkTarget: bannerFields.linkTarget.default(null),
    color: bannerFields.color.default("#E8F5E9"),
    sortOrder: bannerFields.sortOrder.default(0),
    active: bannerFields.active.default(true),
    startsAt: bannerFields.startsAt.default(null),
    endsAt: bannerFields.endsAt.default(null),
  })
  .strict();
export type CreateBannerBody = z.input<typeof createBannerBodySchema>;
export type NewBanner = z.output<typeof createBannerBodySchema>;

export const updateBannerBodySchema = z
  .object({
    title: bannerFields.title.optional(),
    subtitle: bannerFields.subtitle.optional(),
    imageUrl: bannerFields.imageUrl.optional(),
    linkType: bannerFields.linkType.optional(),
    linkTarget: bannerFields.linkTarget.optional(),
    color: bannerFields.color.optional(),
    sortOrder: bannerFields.sortOrder.optional(),
    active: bannerFields.active.optional(),
    startsAt: bannerFields.startsAt.optional(),
    endsAt: bannerFields.endsAt.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field to change.",
  });
export type UpdateBannerBody = z.infer<typeof updateBannerBodySchema>;

export const bannerParamsSchema = z.object({ id: z.uuid() });

export const productParamsSchema = z.object({ id: z.string().min(1) });
