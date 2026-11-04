import { SummaryTile } from '@/components/features/stations/activity/SummaryTile';
import { TabSection } from '@/components/features/stations/TabSection';
import { SectionLinkSkeleton } from '@/components/shared/skeleton/SectionLinkSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  SUMMARY_COLUMNS,
  SUMMARY_GRID,
  SUMMARY_TITLE,
} from '@/lib/station-insights';

export function SummarySkeleton() {
  return (
    <TabSection
      title={SUMMARY_TITLE}
      action={<SectionLinkSkeleton>See in Insights</SectionLinkSkeleton>}
    >
      <dl className={SUMMARY_GRID}>
        {SUMMARY_COLUMNS.map((column) => (
          <SummaryTile
            key={column.label}
            label={column.label}
            value={<SkeletonLine className="w-14" />}
          >
            {column.visual !== 'none' && <Skeleton className="h-8 w-full" />}
          </SummaryTile>
        ))}
      </dl>
    </TabSection>
  );
}
