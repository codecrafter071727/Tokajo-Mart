import { PageHeader } from "../../components/kit";
import { Inventory } from "./inventory";

export const metadata = { title: "Inventory" };

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
