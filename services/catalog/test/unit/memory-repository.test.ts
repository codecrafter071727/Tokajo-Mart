import {
  createInMemoryCatalogRepository,
  seedBanners,
  seedCategories,
  seedProductGroups,
  seedProductImages,
  seedProducts,
} from "../../src/modules/catalog";
import { catalogRepositoryContract } from "../shared/catalog-repository.contract";

catalogRepositoryContract("in memory", () =>
  createInMemoryCatalogRepository(
    seedCategories,
    seedProducts,
    seedBanners,
    seedProductGroups,
    seedProductImages,
  ),
);
