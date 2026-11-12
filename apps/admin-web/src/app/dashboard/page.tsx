import { PageHeader } from "../../components/ui";
import { Dashboard } from "./dashboard";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="How the network is doing. Days are India local days."
      />
      <Dashboard />
    </>
  );
}
