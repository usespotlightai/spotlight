import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const COLUMNS = [
  'Outcome',
  'Failure',
  'Station',
  'Person',
  'Harness',
  'Model',
  'Took',
  'Cost',
  'Ended',
];

const ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

export function RunsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the runs"
      className="overflow-x-auto rounded-xl border border-border bg-card p-3"
    >
      <div className="grid min-w-max grid-cols-9 gap-3 text-xs">
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
