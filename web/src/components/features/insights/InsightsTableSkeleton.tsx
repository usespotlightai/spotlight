import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { columnTemplate, SPREAD } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

const ROW = 'col-span-full grid grid-cols-subgrid items-center pr-2';

type InsightsTableSkeletonProps = {
  label: string;
  headers: readonly (string | null)[];
  rows?: number;
};

export function InsightsTableSkeleton({
  label,
  headers,
  rows = 2,
}: InsightsTableSkeletonProps) {
  const template = columnTemplate(
    headers.map((header, at) => ({
      label: header ?? `${at}`,
      size: at === 0 ? 'minmax(8rem,2fr)' : SPREAD,
    })),
    [],
    false,
  );

  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <div
        aria-hidden
        className="grid min-w-min gap-x-6 text-xs"
        style={{ gridTemplateColumns: template }}
      >
        <div
          className={cn(
            ROW,
            'border-border border-y bg-surface py-1.5 text-[0.7rem] text-muted-foreground',
          )}
        >
          {headers.map((header, at) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: columns keep their place
              key={at}
              className={cn(
                'block truncate',
                at === 0 ? EDGE_INDENT : 'text-right',
              )}
            >
              {header ?? <SkeletonLine className="ml-auto w-10" />}
            </span>
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            key={row}
            className={cn(ROW, 'py-2', ROW_DIVIDER)}
          >
            {headers.map((_, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns keep their place
              <span key={at} className={cn(at === 0 && EDGE_INDENT)}>
                <SkeletonLine className={at === 0 ? 'w-24' : 'ml-auto w-10'} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
