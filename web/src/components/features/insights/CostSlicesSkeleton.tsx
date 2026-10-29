import {
  DONUT_RING,
  DONUT_SIZE,
} from '@/components/features/insights/CostDonut';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const SLICES = 4;

const HOLE = DONUT_SIZE / 2 - DONUT_RING;

export function CostSlicesSkeleton() {
  return (
    <div className="flex items-center gap-4 pb-3">
      <Skeleton
        className="rounded-full"
        style={{
          width: DONUT_SIZE,
          height: DONUT_SIZE,
          mask: `radial-gradient(circle, transparent ${HOLE}px, #000 ${HOLE}px)`,
        }}
      />
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {Array.from({ length: SLICES }, (_, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder slices have no identity
          <li key={at} className="flex items-center gap-2 text-xs">
            <Skeleton className="size-2" />
            <span className="min-w-0 flex-1">
              <SkeletonLine className="w-24" />
            </span>
            <SkeletonLine className="w-10" />
            <SkeletonLine className="w-16" />
          </li>
        ))}
      </ul>
    </div>
  );
}
