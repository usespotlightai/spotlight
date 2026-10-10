import { Skeleton } from '@/components/shared/skeleton/Skeleton';

const FRAME = 58;
const HEADINGS = 31;
const FOOTER = 40;

type ImproveCardSkeletonProps = {
  label: string;
  rows: number;
  rowHeight?: number;
  footer?: boolean;
};

export function ImproveCardSkeleton({
  label,
  rows,
  rowHeight = 33,
  footer = false,
}: ImproveCardSkeletonProps) {
  return (
    <div role="status" aria-label={label} className="flex">
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
