import { RiderDetail } from "./rider-detail";

export const metadata = { title: "Rider" };

export default async function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RiderDetail id={id} />;
}
