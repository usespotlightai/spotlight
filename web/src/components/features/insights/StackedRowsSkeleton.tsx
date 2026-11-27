import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const LENGTHS = ['w-3/4', 'w-full', 'w-2/3', 'w-5/6', 'w-1/2', 'w-3/5'];

export function StackedRowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, at) => (
        <li
          key={at}
          className="grid h-7 grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3"
        >
          <SkeletonLine className="w-10 text-xs" />
          <span className="flex h-3 min-w-0">
            <Skeleton
              className={`h-full rounded-[2px] ${LENGTHS[at % LENGTHS.length]}`}
            />
          </span>
          <SkeletonLine className="ml-auto w-14 text-sm" />
        </li>
      ))}
    </ul>
  );
}
