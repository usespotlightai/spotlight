import { useId } from 'react';
import { formatPercent, type RubricVersion } from '@/lib/judge';
import { cn } from '@/lib/utils';

const AXIS = 'font-normal text-muted-foreground text-left';
const CELL = 'size-11 rounded-sm text-center';
const TOTAL_COLUMN = 'h-11 w-14 pl-3 text-center text-muted-foreground';
const TOTAL_ROW = 'h-14 w-11 pt-3 text-center text-muted-foreground';

const inkOf = (agree: boolean, count: number, max: number): string => {
  if (count === 0) {
    return 'transparent';
  }
  if (agree) {
    return 'color-mix(in oklab, var(--outcome-sent-back) 14%, transparent)';
  }

  return `color-mix(in oklab, var(--chart-primary) ${Math.round(16 + (count / max) * 24)}%, transparent)`;
};

type ConfusionMatrixProps = {
  confusion: RubricVersion['confusion'];
  distribution: RubricVersion['distribution'];
  observed: number | null;
  pairs: number;
};

export function ConfusionMatrix({
  confusion,
  distribution,
  observed,
  pairs,
}: ConfusionMatrixProps) {
  const captionId = useId();
  const misses = confusion.cells.flatMap((row, at) =>
    row.filter((_, column) => column !== at),
  );
  const max = Math.max(1, ...misses);
  const totals = new Map(distribution.map((each) => [each.label, each]));

  return (
    <figure className="flex flex-col gap-3 text-xs">
      <table
        data-slot="confusion-matrix"
        aria-labelledby={captionId}
        className="self-start border-separate border-spacing-0.5 tabular-nums"
      >
        <thead>
          <tr>
            <th scope="col" className={cn(AXIS, 'pr-4 pb-1 align-bottom')}>
              Judge said
            </th>
            <th
              scope="colgroup"
              colSpan={confusion.labels.length}
              className={cn(AXIS, 'pb-1 pl-1')}
            >
              People said
            </th>
            <td />
          </tr>
          <tr>
            <td />
            {confusion.labels.map((label) => (
              <th
                key={label}
                scope="col"
                className="w-11 pb-1 text-center font-normal text-foreground"
              >
                {label}
              </th>
            ))}
            <th
              scope="col"
              className="w-14 pb-1 pl-3 text-center font-normal text-muted-foreground"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {confusion.cells.map((row, at) => {
            const label = confusion.labels[at] ?? '';

            return (
              <tr key={label}>
                <th
                  scope="row"
                  className="pr-4 text-left font-normal text-foreground"
                >
                  {label}
                </th>
                {row.map((count, column) => {
                  const agree = column === at;

                  return (
                    <td
                      key={confusion.labels[column]}
                      data-agree={agree}
                      style={{ background: inkOf(agree, count, max) }}
                      className={cn(
                        CELL,
                        count === 0 && 'text-muted-foreground',
                        count > 0 && 'text-foreground',
                        count > 0 && !agree && 'font-medium',
                      )}
                    >
                      {count}
                    </td>
                  );
                })}
                <td className={TOTAL_COLUMN}>
                  {totals.get(label)?.judge ?? 0}
                </td>
              </tr>
            );
          })}
          <tr>
            <th
              scope="row"
              className="pt-3 pr-4 text-left font-normal text-muted-foreground"
            >
              Total
            </th>
            {confusion.labels.map((label) => (
              <td key={label} className={TOTAL_ROW}>
                {totals.get(label)?.people ?? 0}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
      <figcaption id={captionId} className="text-muted-foreground text-sm">
        They give the same score on {formatPercent(observed)} of the {pairs}{' '}
        runs both scored.
      </figcaption>
    </figure>
  );
}
