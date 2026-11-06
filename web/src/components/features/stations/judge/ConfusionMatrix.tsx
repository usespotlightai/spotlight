import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  confusionCellNote,
  formatAxisLabel,
  type RubricVersion,
  type ScoreKind,
} from '@/lib/judge';
import { cn } from '@/lib/utils';

const AXIS = 'font-normal text-muted-foreground text-xs';
const CELL = 'size-12 p-0';
const TOTAL = 'text-center text-muted-foreground text-xs';

const inkOf = (
  agree: boolean,
  count: number,
  max: number,
  measured: boolean,
): string => {
  if (count === 0) {
    return 'transparent';
  }
  if (!measured) {
    return 'color-mix(in oklab, var(--muted-foreground) 14%, transparent)';
  }
  const strength = Math.round((agree ? 8 : 12) + (count / max) * 30);

  return `color-mix(in oklab, var(${agree ? '--muted-foreground' : '--outcome-failed'}) ${strength}%, transparent)`;
};

type ConfusionMatrixProps = {
  kind: ScoreKind;
  measured: boolean;
  confusion: RubricVersion['confusion'];
  distribution: RubricVersion['distribution'];
};

export function ConfusionMatrix({
  kind,
  measured,
  confusion,
  distribution,
}: ConfusionMatrixProps) {
  const max = Math.max(1, ...confusion.cells.flat());
  const totals = new Map(distribution.map((each) => [each.label, each]));

  return (
    <table
      data-slot="confusion-matrix"
      aria-label="Judge scores against people’s scores"
      className="self-start border-separate border-spacing-1 text-sm tabular-nums"
    >
      <thead>
        <tr>
          <td />
          <th
            scope="colgroup"
            colSpan={confusion.labels.length}
            className={cn(AXIS, 'pb-0.5 text-center')}
          >
            People
          </th>
          <td />
        </tr>
        <tr>
          <th scope="col" className={cn(AXIS, 'pr-3 text-left')}>
            Judge
          </th>
          {confusion.labels.map((label) => (
            <th
              key={label}
              scope="col"
              className="whitespace-nowrap px-1 pb-0.5 text-center font-normal text-foreground"
            >
              {formatAxisLabel(label)}
            </th>
          ))}
          <th scope="col" className={cn(TOTAL, 'pl-2 font-normal')}>
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
                className="whitespace-nowrap pr-3 text-left font-normal text-foreground"
              >
                {formatAxisLabel(label)}
              </th>
              {row.map((count, column) => {
                const agree = column === at;
                const people = confusion.labels[column] ?? '';

                return (
                  <td
                    key={people}
                    data-agree={agree}
                    style={{ background: inkOf(agree, count, max, measured) }}
                    className={cn(CELL, 'rounded-md')}
                  >
                    <WithTooltip
                      tooltip={confusionCellNote(kind, label, people, count)}
                    >
                      <span
                        className={cn(
                          'flex size-full cursor-default items-center justify-center',
                          count === 0
                            ? 'text-muted-foreground'
                            : 'text-foreground',
                          count > 0 && !agree && 'font-medium',
                        )}
                      >
                        {count}
                      </span>
                    </WithTooltip>
                  </td>
                );
              })}
              <td className={cn(TOTAL, 'pl-2')}>
                {totals.get(label)?.judge ?? 0}
              </td>
            </tr>
          );
        })}
        <tr>
          <th scope="row" className={cn(TOTAL, 'pr-3 text-left font-normal')}>
            Total
          </th>
          {confusion.labels.map((label) => (
            <td key={label} className={cn(TOTAL, 'pt-0.5')}>
              {totals.get(label)?.people ?? 0}
            </td>
          ))}
          <td />
        </tr>
      </tbody>
    </table>
  );
}
