import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { GLANCE_COLUMNS } from '@/lib/station-outcomes';

export function GlanceSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-3 gap-4 sm:grid-cols-6">
      {GLANCE_COLUMNS.map((column) => (
        <div key={column.label} className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
