import { PageHeader } from "../../components/kit";
import { CatalogTabs } from "./catalog-tabs";

export const metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="What we sell: products, prices and categories. Stock lives under Inventory."
      />
      <CatalogTabs />
    </>
  );
}
