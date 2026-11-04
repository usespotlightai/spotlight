import {
  RECENT_RUN_COLUMNS,
  RecentRunsHead,
} from '@/components/features/stations/activity/RecentRunsHead';
import { TabSection } from '@/components/features/stations/TabSection';
import { SectionLinkSkeleton } from '@/components/shared/skeleton/SectionLinkSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TABLE_ROW } from '@/components/shared/table-rows';
import { cn } from '@/lib/utils';

const ROWS = 5;

export function RecentRunsSkeleton() {
  return (
    <TabSection
      title="Recent runs"
      action={<SectionLinkSkeleton>All runs</SectionLinkSkeleton>}
    >
      <div
        role="status"
        aria-label="Loading the station’s runs"
        className="-mx-3 overflow-hidden"
      >
        <div className="min-w-[46rem]">
          <RecentRunsHead />
          {Array.from({ length: ROWS }, (_, at) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
              key={at}
              className={cn(TABLE_ROW, RECENT_RUN_COLUMNS)}
            >
              <SkeletonLine className="w-20" />
              <SkeletonLine className="w-4" />
              <SkeletonLine className="w-24" />
              <SkeletonLine className="w-16" />
              <SkeletonLine className="w-16" />
              <SkeletonLine className="ml-auto w-12" />
              <SkeletonLine className="ml-auto w-10" />
              <SkeletonLine className="ml-auto w-12" />
            </div>
          ))}
        </div>
      </div>
    </TabSection>
  );
}
