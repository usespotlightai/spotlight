import { Skeleton } from '@/components/shared/skeleton/Skeleton';

const FRAME = 58;
const HEADINGS = 31;
const FOOTER = 40;

type InsightsTableCardSkeletonProps = {
  rows: number;
  rowHeight?: number;
  footer?: boolean;
};

export function InsightsTableCardSkeleton({
  rows,
  rowHeight = 41,
  footer = false,
}: InsightsTableCardSkeletonProps) {
  return (
    <div aria-hidden className="flex">
      <Skeleton
        className="w-full rounded-lg"
        style={{
          minHeight:
            FRAME + HEADINGS + rows * rowHeight + (footer ? FOOTER : 0),
        }}
      />
    </div>
  );
}
