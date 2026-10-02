import { CardList } from '@/components/features/replays/CardList';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function CandidatesSkeleton() {
  return (
    <CardList label="Loading the candidates" loading>
      <div className="flex flex-col gap-1 px-2 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SkeletonLine className="w-28" />
          <SkeletonLine className="w-14 text-xs" />
        </div>
        <SkeletonLine className="w-48 text-xs" />
      </div>
    </CardList>
  );
}
