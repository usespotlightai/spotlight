import { PillSkeleton } from '@/components/shared/skeleton/PillSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const ROWS = 6;

export function BeforeAfterSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the change"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <SkeletonLine className="w-24 text-xs" />
        <SkeletonLine className="w-56 text-xs" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: ROWS }, (_, at) => (
          <SkeletonLine
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            key={at}
            className="w-full text-xs"
          />
        ))}
      </div>
      <div className="flex gap-2">
        <PillSkeleton className="w-28" />
        <PillSkeleton className="w-36" />
      </div>
    </div>
  );
}
