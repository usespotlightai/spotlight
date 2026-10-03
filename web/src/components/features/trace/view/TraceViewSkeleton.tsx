import type { CSSProperties } from 'react';
import { TraceGrid } from '@/components/features/trace/view/TraceGrid';
import {
  type TraceRowShape,
  TraceRowSkeleton,
} from '@/components/features/trace/view/TraceRowSkeleton';
import { TraceScale } from '@/components/features/trace/view/TraceScale';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { NAMES_PANE } from '@/lib/trace';

const WATERFALL: readonly TraceRowShape[] = [
  { depth: 0, holding: true, name: 'w-16', left: 0, width: 7 },
  { depth: 1, holding: false, name: 'w-16', left: 0, width: 1 },
  { depth: 1, holding: true, name: 'w-28', left: 1, width: 6 },
  { depth: 2, holding: false, name: 'w-40', left: 1.5, width: 1 },
  { depth: 2, holding: false, name: 'w-24', left: 2.5, width: 1 },
  { depth: 2, holding: false, name: 'w-32', left: 3.5, width: 1 },
  { depth: 1, holding: false, name: 'w-14', left: 7, width: 1 },
  { depth: 0, holding: true, name: 'w-28', left: 45, width: 40 },
  { depth: 1, holding: false, name: 'w-16', left: 45, width: 1 },
  { depth: 1, holding: true, name: 'w-28', left: 46, width: 38 },
  { depth: 2, holding: false, name: 'w-36', left: 47, width: 20 },
  { depth: 2, holding: false, name: 'w-32', left: 69, width: 4 },
  { depth: 1, holding: false, name: 'w-14', left: 85, width: 1 },
];

export function TraceViewSkeleton() {
  const names = usePaneWidth<HTMLDivElement>(NAMES_PANE);

  return (
    <div
      role="status"
      aria-label="Loading the trace"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        className="relative min-h-0 min-w-0 flex-1"
        style={{ '--names': `${names.width}px` } as CSSProperties}
      >
        <div className="flex h-full flex-col overflow-auto scrollbar-hide">
          <TraceScale label={() => <SkeletonLine className="w-5" />} />

          <div className="relative flex-1 px-1.5">
            <TraceGrid />

            <ul className="relative flex flex-col pt-2 pb-6">
              {WATERFALL.map((row) => (
                <TraceRowSkeleton
                  key={`${row.depth}-${row.left}-${row.name}`}
                  {...row}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
