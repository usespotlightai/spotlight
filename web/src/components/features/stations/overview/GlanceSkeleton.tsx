import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { GLANCE_COLUMNS } from '@/lib/station-outcomes';

export function GlanceSkeleton() {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="font-medium text-foreground text-xs">
        Latest runs on this config
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {GLANCE_COLUMNS.map((column) => (
          <Skeleton key={column.label} className="h-36 rounded-lg" />
        ))}
      </div>
    </section>
  );
}
