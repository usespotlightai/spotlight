import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function TokenRowSkeleton() {
  return (
    <div className="flex min-h-12 items-center px-4 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <SkeletonLine className="w-16 text-sm" />
        <SkeletonLine className="w-56 text-xs" />
      </div>
    </div>
  );
}
