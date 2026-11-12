import type { AdminRider } from "@qc/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Badge, PageHeader, TableShell, td, th } from "../../components/ui";
import { ACCESS_COOKIE, GATEWAY_URL } from "../../lib/session";

const STATUS: Record<AdminRider["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  online: { label: "Online", tone: "green" },
  on_delivery: { label: "On a delivery", tone: "amber" },
  offline: { label: "Offline", tone: "gray" },
};

// Always fresh: this is a live view of who is working
export const dynamic = "force-dynamic";

async function loadRiders(): Promise<AdminRider[] | "expired" | "failed"> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/delivery/admin/riders`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return "expired";
    if (!res.ok) return "failed";
    return ((await res.json()) as { items: AdminRider[] }).items;
  } catch {
    return "failed";
  }
}

export default async function RidersPage() {
  const riders = await loadRiders();
  if (riders === "expired") redirect("/session/refresh?next=/riders");
  if (riders === "failed") {
    return (
      <>
        <PageHeader title="Riders" />
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          Could not load riders. Check that the delivery service is running, then reload.
        </p>
      </>
    );
  }

  const active = riders.filter((r) => r.status !== "offline").length;
  return (
    <>
      <PageHeader
        title="Riders"
        subtitle={`${active} of ${riders.length} riders are working right now.`}
      />
      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Rider", "Phone", "Vehicle", "Status", "Today", "Rating", "Warehouse"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riders.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-brand-50/40">
                <td className={`${td} font-bold`}>{r.name}</td>
                <td className={`${td} tabular-nums`}>{r.phone ?? ""}</td>
                <td className={td}>{r.vehicle}</td>
                <td className={td}>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </td>
                <td className={`${td} tabular-nums`}>{r.deliveriesToday} deliveries</td>
                <td className={`${td} tabular-nums`}>{r.rating.toFixed(1)}</td>
                <td className={td}>{r.warehouseId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}
