import {
  createInMemoryCatalogRepository,
  seedCategories,
  seedProducts,
} from "../../src/modules/catalog";
import { catalogRepositoryContract } from "../shared/catalog-repository.contract";

catalogRepositoryContract("in memory", () =>
  createInMemoryCatalogRepository(seedCategories, seedProducts),
);
