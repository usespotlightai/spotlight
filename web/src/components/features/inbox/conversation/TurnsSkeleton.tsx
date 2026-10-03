import { ChevronRight } from 'lucide-react';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function TurnsSkeleton() {
  return (
    <ol className="mt-6 flex flex-col gap-6">
      <li className="flex justify-center text-xs">
        <SkeletonLine className="w-28" />
      </li>

      <li className="flex flex-col gap-1.5">
        <StationNameSkeleton />

        <div className="py-1.5">
          <span className="flex items-center gap-1 py-0.5 text-muted-foreground text-xs">
            <ChevronRight className="size-3" aria-hidden />
            <SkeletonLine className="w-40" />
          </span>
        </div>

        <SkeletonLine className="w-3/5 text-sm leading-6" />
      </li>
    </ol>
  );
}
