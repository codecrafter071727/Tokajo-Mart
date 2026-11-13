import { WarehouseDetail } from "./warehouse-detail";

export const metadata = { title: "Warehouse" };

export default async function WarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WarehouseDetail id={decodeURIComponent(id)} />;
}
