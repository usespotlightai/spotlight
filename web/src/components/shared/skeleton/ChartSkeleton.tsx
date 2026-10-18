import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function ChartSkeleton({ height }: { height: number }) {
  return <Skeleton className="w-full rounded-md" style={{ height }} />;
}
