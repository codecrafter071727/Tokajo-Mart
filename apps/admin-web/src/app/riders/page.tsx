import { PageHeader } from "../../components/kit";
import { Riders } from "./riders";

export const metadata = { title: "Riders" };

export default function RidersPage() {
  return (
    <>
      <PageHeader
        title="Riders"
        subtitle="Who is working right now, and the people who can sign in to the rider app."
      />
      <Riders />
    </>
  );
}
