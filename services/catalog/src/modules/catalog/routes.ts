import {
  listCategoriesResponseSchema,
  listProductsQuerySchema,
  listProductsResponseSchema,
  productParamsSchema,
  productSchema,
} from "@qc/contracts";
import type { ServiceApp } from "@qc/service-kit";
import type { CatalogRepository } from "./repository";

function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  const offset = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  return Number.isInteger(offset) && offset >= 0 ? offset : null;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

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
        summary: "Get one product",
        params: productParamsSchema,
        response: { 200: productSchema },
      },
    },
    async (request) => {
      const product = await repository.getProduct(request.params.id);
      if (!product) {
        throw app.httpErrors.notFound("Product not found.");
      }
      return product;
    },
  );
}
