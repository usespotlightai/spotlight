import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationNameSkeleton() {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <StationIconSkeleton />
      <SkeletonLine className="w-20" />
    </span>
  );
}
