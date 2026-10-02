import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type SearchSkeletonProps = {
  known: readonly BreadcrumbSegment[];
};

const TERMS = ['Budget', 'Agent', 'Progress', 'Spent', 'Best'] as const;

export function SearchSkeleton({ known }: SearchSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the search"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader title={<TrailSkeleton known={known} />} />

      <StationLayout>
        <div className="flex flex-col gap-3">
          <SkeletonLine className="w-32 font-semibold text-2xl leading-8 tracking-tight" />
          <SkeletonLine className="w-56 text-xs" />
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
            {TERMS.map((term) => (
              <div key={term} className="contents">
                <span className="text-muted-foreground text-xs">{term}</span>
                <SkeletonLine className="w-40 text-xs" />
              </div>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <ReplaysHeading title="Tasks" level="h2" />
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <SkeletonLine className="w-36" />
            <SkeletonLine className="w-64 text-xs" />
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <SkeletonLine className="w-32 text-sm" />
          <SkeletonLine className="w-72 text-xs" />
        </section>

        <section className="flex flex-col gap-3">
          <ReplaysHeading title="Candidates" level="h2" />
          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm">
            <SkeletonLine className="w-28" />
            <SkeletonLine className="w-48 text-xs" />
          </div>
        </section>
      </StationLayout>
    </div>
  );
}
