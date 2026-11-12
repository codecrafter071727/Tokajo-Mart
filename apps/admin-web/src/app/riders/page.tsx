import { Badge, DemoNotice, PageHeader, TableShell, td, th } from "../../components/ui";
import { riders, type RiderStatus } from "../../lib/demo";

const STATUS: Record<RiderStatus, { label: string; tone: "green" | "amber" | "gray" }> = {
  online: { label: "Online", tone: "green" },
  on_delivery: { label: "On a delivery", tone: "amber" },
  offline: { label: "Offline", tone: "gray" },
};

export default function RidersPage() {
  const active = riders.filter((r) => r.status !== "offline").length;
  return (
    <>
      <PageHeader
        title="Riders"
        subtitle={`${active} of ${riders.length} riders are working right now.`}
      />
      <DemoNotice>Demo data. This page connects to the delivery service once it exists.</DemoNotice>
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
                <td className={`${td} tabular-nums`}>{r.phone}</td>
                <td className={td}>{r.vehicle}</td>
                <td className={td}>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </td>
                <td className={`${td} tabular-nums`}>{r.deliveriesToday} deliveries</td>
                <td className={`${td} tabular-nums`}>{r.rating.toFixed(1)}</td>
                <td className={td}>{r.warehouse}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}
