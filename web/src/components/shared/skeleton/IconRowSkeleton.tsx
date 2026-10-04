import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

type IconRowSkeletonProps = {
  nameWidth: string;
  aboutWidth: string;
};

export function IconRowSkeleton({
  nameWidth,
  aboutWidth,
}: IconRowSkeletonProps) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <SkeletonLine className={cn(nameWidth, 'text-sm')} />
        <SkeletonLine className={cn(aboutWidth, 'text-xs')} />
      </div>
    </div>
  );
}
