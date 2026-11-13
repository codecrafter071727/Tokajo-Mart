import { PageHeader } from "../../components/kit";
import { Customers } from "./customers";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" subtitle="People who have signed in to the customer app." />
      <Customers />
    </>
  );
}
