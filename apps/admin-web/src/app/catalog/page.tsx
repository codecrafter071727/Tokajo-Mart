import { PageHeader } from "../../components/ui";
import { CatalogTable } from "./catalog-table";

export default function CatalogPage() {
  return (
    <>
      <PageHeader title="Catalog" subtitle="Products, prices and stock across the network." />
      <CatalogTable />
    </>
  );
}
