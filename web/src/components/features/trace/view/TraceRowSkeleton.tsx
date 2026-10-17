import { ChevronRight } from 'lucide-react';
import { LABEL_ROOM } from '@/components/features/trace/view/TraceBar';
import { INDENT } from '@/components/features/trace/view/TraceRow';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export type TraceRowShape = {
  depth: number;
  hasChildren: boolean;
  name: string;
  left: number;
  width: number;
};

export function TraceRowSkeleton({
  depth,
  hasChildren,
  name,
  left,
  width,
}: TraceRowShape) {
  return (
    <li className="relative flex h-7 items-center rounded-md text-sm">
      <div
        className="flex min-w-0 shrink-0 items-center gap-1 pr-3"
        style={{ width: 'var(--names)', paddingLeft: depth * INDENT + 8 }}
      >
        {hasChildren ? (
          <ChevronRight
            className="size-3 shrink-0 rotate-90 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <span className="size-3 shrink-0" aria-hidden />
        )}

        <SkeletonLine className={name} />
      </div>

      <div
        className="relative min-w-0 flex-1 self-stretch"
        style={{ marginRight: LABEL_ROOM }}
      >
        <Skeleton
          className="-translate-y-1/2 absolute top-1/2 h-2 rounded-[2px]"
          style={{ left: `${left}%`, width: `${width}%` }}
        />

        <span
          className="-translate-y-1/2 absolute top-1/2 flex pl-1.5 text-xs"
          style={{ left: `${left + width}%` }}
        >
          <SkeletonLine className="w-8" />
        </span>
      </div>
    </li>
  );
}
