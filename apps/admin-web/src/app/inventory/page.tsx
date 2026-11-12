import { PageHeader } from "../../components/ui";
import { Inventory } from "./inventory";

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Stock on hand per warehouse. Receive deliveries, write off damage and fix counts."
      />
      <Inventory />
    </>
  );
}
