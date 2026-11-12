import { PageHeader } from "../../components/ui";
import { CatalogTabs } from "./catalog-tabs";

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
