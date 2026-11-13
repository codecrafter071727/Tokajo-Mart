import {
  addProductImageBodySchema,
  adminProductDetailSchema,
  catalogImportQuerySchema,
  catalogImportResultSchema,
  createProductGroupBodySchema,
  listProductGroupsResponseSchema,
  listProductImagesResponseSchema,
  productDetailSchema,
  productGroupSchema,
  productImageParamsSchema,
  reorderProductImagesBodySchema,
  bannerParamsSchema,
  bannerSchema,
  categoryParamsSchema,
  categorySchema,
  createBannerBodySchema,
  createCategoryBodySchema,
  createProductBodySchema,
  listAdminProductsResponseSchema,
  listBannersResponseSchema,
  listCategoriesResponseSchema,
  listProductsQuerySchema,
  listProductsResponseSchema,
  productParamsSchema,
  productSchema,
  updateBannerBodySchema,
  updateCategoryBodySchema,
  updateProductBodySchema,
} from "@qc/contracts";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { requireRole, type ServiceApp } from "@qc/service-kit";
import { parseImportCsv, productsToCsv } from "./depth";
import { CatalogError } from "./errors";
import type { CatalogRepository } from "./repository";

/** Largest CSV the import accepts */
const MAX_IMPORT_BYTES = 1024 * 1024;

function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  const offset = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  return Number.isInteger(offset) && offset >= 0 ? offset : null;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

/** Runs before the body is checked, so a stranger learns nothing about what a route accepts. */
const adminOnly = async (request: FastifyRequest) => {
  requireRole(request, "admin");
};

export function registerCatalogRoutes(app: ServiceApp, repository: CatalogRepository): void {
  app.get(
    "/v1/catalog/categories",
    {
      schema: {
        tags: ["catalog"],
        summary: "List categories in display order",
        response: { 200: listCategoriesResponseSchema },
      },
    },
    async () => ({ items: await repository.listCategories() }),
  );

  app.get(
    "/v1/catalog/products",
    {
      schema: {
        tags: ["catalog"],
        summary: "List or search products, optionally within one category",
        querystring: listProductsQuerySchema,
        response: { 200: listProductsResponseSchema },
      },
    },
    async (request) => {
      const { categoryId, q, limit, cursor } = request.query;
      const offset = decodeCursor(cursor);
      if (offset === null) {
        throw app.httpErrors.badRequest("Invalid cursor.");
      }
      const page = await repository.listProducts({ categoryId, q, limit, offset });
      return {
        items: page.items,
        nextCursor: page.nextOffset === null ? null : encodeCursor(page.nextOffset),
      };
    },
  );

  app.get(
    "/v1/catalog/products/:id",
    {
      schema: {
        tags: ["catalog"],
        summary: "Get one product with its variants and photos",
        params: productParamsSchema,
        response: { 200: productDetailSchema },
      },
    },
    async (request) => {
      const detail = await repository.getProductDetail(request.params.id);
      if (!detail) {
        throw app.httpErrors.notFound("Product not found.");
      }
      const { archived: _archived, ...product } = detail;
      return product;
    },
  );

  app.patch(
    "/v1/catalog/products/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["catalog"],
        summary: "Edit a product (admin)",
        params: productParamsSchema,
        body: updateProductBodySchema,
        response: { 200: productSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const existing = await repository.getProduct(request.params.id);
      if (!existing) {
        throw app.httpErrors.notFound("Product not found.");
      }
      const price = request.body.pricePaise ?? existing.pricePaise;
      const mrp = request.body.mrpPaise ?? existing.mrpPaise;
      if (price > mrp) {
        throw app.httpErrors.badRequest("The selling price cannot be higher than the MRP.");
      }
      const updated = await repository.updateProduct(request.params.id, request.body);
      if (!updated) {
        throw app.httpErrors.notFound("Product not found.");
      }
      return updated;
    },
  );

  // --- Admin: products -----------------------------------------------------------------------
  // The gateway already limits writes to admins. The service checks too, because it is the one
  // that must never trust a caller it cannot verify.
  app.get(
    "/v1/catalog/admin/products",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Every product including archived ones (admin)",
        querystring: listProductsQuerySchema,
        response: { 200: listAdminProductsResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const { categoryId, q, limit, cursor } = request.query;
      const offset = decodeCursor(cursor);
      if (offset === null) throw app.httpErrors.badRequest("Invalid cursor.");
      const page = await repository.listAdminProducts({ categoryId, q, limit, offset });
      return {
        items: page.items,
        nextCursor: page.nextOffset === null ? null : encodeCursor(page.nextOffset),
      };
    },
  );

  app.get(
    "/v1/catalog/admin/products/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "One product, archived or not, with its variants and photos (admin)",
        params: productParamsSchema,
        response: { 200: adminProductDetailSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const product = await repository.getProductDetail(request.params.id, true);
      if (!product) throw app.httpErrors.notFound("Product not found.");
      return product;
    },
  );

  app.post(
    "/v1/catalog/products",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Add a product (admin)",
        body: createProductBodySchema,
        response: { 201: productSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      return reply.status(201).send(await repository.createProduct(request.body));
    },
  );

  app.delete(
    "/v1/catalog/products/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Take a product off sale (admin). It can be restored.",
        params: productParamsSchema,
        response: { 200: z.object({ id: z.string(), archived: z.literal(true) }) },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      if (!(await repository.archiveProduct(request.params.id))) {
        throw app.httpErrors.notFound("Product not found.");
      }
      return { id: request.params.id, archived: true as const };
    },
  );

  app.post(
    "/v1/catalog/products/:id/restore",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Put an archived product back on sale (admin)",
        params: productParamsSchema,
        response: { 200: productSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const product = await repository.restoreProduct(request.params.id);
      if (!product) throw app.httpErrors.notFound("Archived product not found.");
      return product;
    },
  );

  // --- Admin: product groups (variants) -----------------------------------------------------
  app.get(
    "/v1/catalog/admin/product-groups",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Product groups that hold variants (admin)",
        response: { 200: listProductGroupsResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return { items: await repository.listProductGroups() };
    },
  );

  app.post(
    "/v1/catalog/admin/product-groups",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Make a product group, then give products its id and a variant label (admin)",
        body: createProductGroupBodySchema,
        response: { 201: productGroupSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      return reply.status(201).send(await repository.createProductGroup(request.body));
    },
  );

  // --- Admin: product photos -----------------------------------------------------------------
  app.post(
    "/v1/catalog/admin/products/:id/images",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Add a photo after the others (admin)",
        params: productParamsSchema,
        body: addProductImageBodySchema,
        response: { 201: listProductImagesResponseSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      const items = await repository.addProductImage(request.params.id, request.body);
      if (!items) throw app.httpErrors.notFound("Product not found.");
      return reply.status(201).send({ items });
    },
  );

  app.put(
    "/v1/catalog/admin/products/:id/images/order",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Set the order of the extra photos (admin)",
        params: productParamsSchema,
        body: reorderProductImagesBodySchema,
        response: { 200: listProductImagesResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const items = await repository.reorderProductImages(request.params.id, request.body.ids);
      if (!items) throw app.httpErrors.notFound("Product not found.");
      return { items };
    },
  );

  app.post(
    "/v1/catalog/admin/products/:id/images/:imageId/primary",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Make a photo the main one (admin)",
        params: productImageParamsSchema,
        response: { 200: listProductImagesResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const items = await repository.makePrimaryImage(request.params.id, request.params.imageId);
      if (!items) throw app.httpErrors.notFound("Photo not found.");
      return { items };
    },
  );

  app.delete(
    "/v1/catalog/admin/products/:id/images/:imageId",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Remove an extra photo (admin)",
        params: productImageParamsSchema,
        response: { 200: z.object({ id: z.string(), deleted: z.literal(true) }) },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      if (!(await repository.removeProductImage(request.params.id, request.params.imageId))) {
        throw app.httpErrors.notFound("Photo not found.");
      }
      return { id: request.params.imageId, deleted: true as const };
    },
  );

  // --- Admin: CSV import and export ----------------------------------------------------------
  app.addContentTypeParser(
    "text/csv",
    { parseAs: "string", bodyLimit: MAX_IMPORT_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.post(
    "/v1/catalog/admin/import",
    {
      preValidation: adminOnly,
      bodyLimit: MAX_IMPORT_BYTES,
      schema: {
        tags: ["admin"],
        summary: "Import products from CSV, all or nothing. ?dryRun=true only checks (admin)",
        querystring: catalogImportQuerySchema,
        response: { 200: catalogImportResultSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      if (typeof request.body !== "string") {
        throw new CatalogError(400, "Send the file as text/csv.");
      }
      const { rows, errors: fileErrors } = parseImportCsv(request.body);
      const dryRun = request.query.dryRun;
      if (dryRun) {
        const plan = await repository.planImport(rows);
        const errors = [...fileErrors, ...plan.errors].sort((a, b) => a.line - b.line);
        return {
          dryRun: true,
          ok: errors.length === 0,
          rows: rows.length + new Set(fileErrors.filter((e) => e.line > 1).map((e) => e.line)).size,
          creates: plan.creates,
          updates: plan.updates,
          groupsCreated: plan.groupsCreated,
          errors,
        };
      }
      if (fileErrors.length > 0) {
        throw new CatalogError(400, "The file has problems. Nothing was imported.", fileErrors);
      }
      const plan = await repository.applyImport(rows);
      return {
        dryRun: false,
        ok: true,
        rows: rows.length,
        creates: plan.creates,
        updates: plan.updates,
        groupsCreated: plan.groupsCreated,
        errors: [],
      };
    },
  );

  app.get(
    "/v1/catalog/admin/export",
    {
      preValidation: adminOnly,
      schema: { tags: ["admin"], summary: "Every product on sale as CSV (admin)" },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      const csv = productsToCsv(await repository.exportProducts());
      return reply
        .type("text/csv; charset=utf-8")
        .header("content-disposition", 'attachment; filename="catalog.csv"')
        .send(csv);
    },
  );

  // --- Admin: categories ---------------------------------------------------------------------
  app.post(
    "/v1/catalog/categories",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Add a category (admin)",
        body: createCategoryBodySchema,
        response: { 201: categorySchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      return reply.status(201).send(await repository.createCategory(request.body));
    },
  );

  app.patch(
    "/v1/catalog/categories/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Edit a category (admin)",
        params: categoryParamsSchema,
        body: updateCategoryBodySchema,
        response: { 200: categorySchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const category = await repository.updateCategory(request.params.id, request.body);
      if (!category) throw app.httpErrors.notFound("Category not found.");
      return category;
    },
  );

  app.delete(
    "/v1/catalog/categories/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Remove an empty category (admin)",
        params: categoryParamsSchema,
        response: { 200: z.object({ id: z.string(), deleted: z.literal(true) }) },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      if (!(await repository.deleteCategory(request.params.id))) {
        throw app.httpErrors.notFound("Category not found.");
      }
      return { id: request.params.id, deleted: true as const };
    },
  );

  // --- Banners -------------------------------------------------------------------------------
  app.get(
    "/v1/catalog/banners",
    {
      schema: {
        tags: ["catalog"],
        summary: "Banners on show right now, in display order",
        response: { 200: listBannersResponseSchema },
      },
    },
    async () => ({ items: await repository.listLiveBanners(new Date()) }),
  );

  app.get(
    "/v1/catalog/admin/banners",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Every banner, including inactive and scheduled ones (admin)",
        response: { 200: listBannersResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return { items: await repository.listAllBanners() };
    },
  );

  app.post(
    "/v1/catalog/banners",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Add a banner (admin)",
        body: createBannerBodySchema,
        response: { 201: bannerSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      return reply.status(201).send(await repository.createBanner(request.body));
    },
  );

  app.patch(
    "/v1/catalog/banners/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Edit a banner (admin)",
        params: bannerParamsSchema,
        body: updateBannerBodySchema,
        response: { 200: bannerSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      const banner = await repository.updateBanner(request.params.id, request.body);
      if (!banner) throw app.httpErrors.notFound("Banner not found.");
      return banner;
    },
  );

  app.delete(
    "/v1/catalog/banners/:id",
    {
      preValidation: adminOnly,
      schema: {
        tags: ["admin"],
        summary: "Delete a banner (admin)",
        params: bannerParamsSchema,
        response: { 200: z.object({ id: z.string(), deleted: z.literal(true) }) },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      if (!(await repository.deleteBanner(request.params.id))) {
        throw app.httpErrors.notFound("Banner not found.");
      }
      return { id: request.params.id, deleted: true as const };
    },
  );

  // Internal: the order service prices an order from the catalog, never from the client
  app.get(
    "/internal/products",
    {
      schema: {
        tags: ["internal"],
        summary: "Get several products by id (up to 100)",
        querystring: z.object({
          ids: z
            .string()
            .min(1)
            .transform((value) => [
              ...new Set(
                value
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean),
              ),
            ])
            .pipe(z.array(z.string()).min(1).max(100)),
        }),
        response: { 200: listProductsResponseSchema.pick({ items: true }) },
      },
    },
    async (request) => {
      const found = await Promise.all(request.query.ids.map((id) => repository.getProduct(id)));
      return { items: found.filter((product) => product !== null) };
    },
  );
}
