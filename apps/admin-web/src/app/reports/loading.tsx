import { HeaderSkeleton, Skeleton } from "../../components/ui/skeleton";
import { ReportSkeleton } from "./report-ui";

export function ReportsSkeleton() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="mb-6 flex gap-3 border-b border-line pb-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <ReportSkeleton />
    </div>
  );
}

export default function Loading() {
  return <ReportsSkeleton />;
}
