import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const COLUMNS = [
  'Pull request',
  'Repository',
  'Written by',
  'Type',
  'State',
  'To merge',
  'Rounds',
  'Comments',
  'Cost',
];

const ROWS = ['first', 'second', 'third', 'fourth'];

export function PullRequestListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the pull request list"
      className="overflow-x-auto"
    >
      <div className="grid min-w-max grid-cols-9 gap-4 text-xs">
        {COLUMNS.map((column) => (
          <span key={column} className="text-muted-foreground">
            {column}
          </span>
        ))}
        {ROWS.map((row) =>
          COLUMNS.map((column) => (
            <SkeletonLine key={`${row}:${column}`} className="w-12" />
          )),
        )}
      </div>
    </div>
  );
}
