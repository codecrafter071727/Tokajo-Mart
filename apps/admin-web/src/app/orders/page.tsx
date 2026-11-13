import { Suspense } from "react";
import { ListPageSkeleton } from "../../components/ui/skeleton";
import { OrdersView } from "./orders-view";

export const metadata = { title: "Live orders" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <OrdersView />
    </Suspense>
  );
}
