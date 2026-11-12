import { PageHeader } from "../../components/ui";
import { Customers } from "./customers";

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" subtitle="People who have signed in to the customer app." />
      <Customers />
    </>
  );
}
