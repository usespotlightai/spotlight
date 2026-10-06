import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const MOST_LINES = 12;

const WIDTHS = ['w-2/3', 'w-1/2', 'w-5/6', 'w-1/3', 'w-3/4', 'w-2/5'];

export function FileDiffSkeleton({ lines }: { lines: number }) {
  const shown = Math.max(1, Math.min(lines, MOST_LINES));

  return (
    <div
      role="status"
      aria-label="Loading the changes"
      data-slot="file-diff-skeleton"
      className="flex flex-col px-3 py-2 text-xs leading-5"
    >
      {Array.from({ length: shown }, (_, at) => (
        <SkeletonLine
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder lines have nothing to name them but their place
          key={at}
          className={WIDTHS[at % WIDTHS.length]}
        />
      ))}
    </div>
  );
}
