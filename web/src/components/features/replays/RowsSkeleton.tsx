import { CardList } from '@/components/features/replays/CardList';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function RowsSkeleton({ label }: { label: string }) {
  return (
    <CardList label={label} loading>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 text-sm">
        <SkeletonLine className="w-28" />
        <SkeletonLine className="w-16 text-xs" />
      </div>
    </CardList>
  );
}
