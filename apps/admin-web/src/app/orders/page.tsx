import { PageHeader } from "../../components/ui";
import { OrdersTable } from "./orders-table";

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" subtitle="Everything placed across the network, newest first." />
      <OrdersTable />
    </>
  );
}
