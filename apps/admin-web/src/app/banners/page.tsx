import { PageHeader } from "../../components/ui";
import { BannersPanel } from "./banners-panel";

export default function BannersPage() {
  return (
    <>
      <PageHeader
        title="Banners"
        subtitle="The promotions strip at the top of the customer home screen."
      />
      <BannersPanel />
    </>
  );
}
