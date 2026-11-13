import { PageHeader } from "../../components/kit";
import { Warehouses } from "./warehouses";

export const metadata = { title: "Warehouses" };

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
