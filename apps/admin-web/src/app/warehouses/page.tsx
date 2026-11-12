import { PageHeader } from "../../components/ui";
import { Warehouses } from "./warehouses";

export default function WarehousesPage() {
  return (
    <>
      <PageHeader
        title="Warehouses"
        subtitle="Each warehouse serves the area within its radius. Closing one stops new orders to it."
      />
      <Warehouses />
    </>
  );
}
