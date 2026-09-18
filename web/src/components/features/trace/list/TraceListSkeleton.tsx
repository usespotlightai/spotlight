import { TraceHead } from '@/components/features/trace/list/TraceHead';
import { TraceLegend } from '@/components/features/trace/list/TraceLegend';
import { TraceRowSkeleton } from '@/components/features/trace/list/TraceRowSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function TraceListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the traces"
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <div className="px-2 pt-2 pb-1">
        <TraceLegend />
        <Skeleton className="mx-2 h-45 rounded-md" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        <TraceHead />

        <ul className="flex flex-col">
          <TraceRowSkeleton />
        </ul>
      </div>
    </div>
  );
}
