import { PageHeader } from "../../components/ui";
import { Team } from "./team";

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
