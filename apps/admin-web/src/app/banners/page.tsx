import { PageHeader } from "../../components/kit";
import { BannersPanel } from "./banners-panel";

export const metadata = { title: "Banners" };

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
