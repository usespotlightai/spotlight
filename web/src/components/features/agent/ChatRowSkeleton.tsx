import { SinceSkeleton } from '@/components/features/team/SinceSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function ChatRowSkeleton() {
  return (
    <li className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm">
      <Skeleton className="size-3.5 rounded-full" />
      <SkeletonLine className="w-36" />
      <SinceSkeleton />
    </li>
  );
}
