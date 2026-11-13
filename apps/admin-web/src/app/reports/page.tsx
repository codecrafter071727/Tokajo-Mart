import { Suspense } from "react";
import { ReportsSkeleton } from "./loading";
import { Reports } from "./reports";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  // The page reads its tab and dates from the address, which needs a Suspense boundary
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <Reports />
    </Suspense>
  );
}
