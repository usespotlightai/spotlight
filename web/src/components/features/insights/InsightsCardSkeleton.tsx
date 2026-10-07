import { Skeleton } from '@/components/shared/skeleton/Skeleton';

const HEADER = 52;
const ROW = 32;

export function InsightsCardSkeleton({ rows }: { rows: number }) {
  return (
    <Skeleton
      className="w-full rounded-lg"
      style={{ height: HEADER + rows * ROW }}
    />
  );
}
