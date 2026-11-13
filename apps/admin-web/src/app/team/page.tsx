import { PageHeader } from "../../components/kit";
import { Team } from "./team";

export const metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Warehouse staff, managers and admins who sign in with an email and password."
      />
      <Team />
    </>
  );
}
