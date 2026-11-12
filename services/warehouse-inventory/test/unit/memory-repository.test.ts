import {
  createInMemoryInventoryRepository,
  seedStock,
  seedWarehouses,
} from "../../src/modules/inventory";
import { inventoryRepositoryContract } from "../shared/inventory-repository.contract";

inventoryRepositoryContract("in memory", () =>
  createInMemoryInventoryRepository(
    seedWarehouses.map((w) => ({ ...w })),
    seedStock.map((s) => ({ ...s })),
  ),
);
