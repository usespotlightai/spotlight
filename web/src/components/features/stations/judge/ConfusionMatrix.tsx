import { useId } from 'react';
import type { RubricVersion } from '@/lib/judge';
import { cn } from '@/lib/utils';

const AXIS = 'font-normal text-muted-foreground';

const shadeOf = (count: number, most: number): string =>
  count === 0 || most === 0
    ? 'var(--muted)'
    : `color-mix(in oklab, var(--chart-primary) ${Math.round((count / most) * 85)}%, transparent)`;

export function ConfusionMatrix({
  confusion,
}: {
  confusion: RubricVersion['confusion'];
}) {
  const captionId = useId();
  const most = Math.max(0, ...confusion.cells.flat());
  const size = confusion.labels.length;

  return (
    <div className="text-xs">
      <p id={captionId} className="sr-only">
        The judge’s scores down, people’s across
      </p>
      <table
        data-slot="confusion-matrix"
        aria-labelledby={captionId}
        className="border-separate border-spacing-0.5 tabular-nums"
      >
        <thead>
          <tr>
            <td colSpan={2} />
            <th
              scope="colgroup"
              colSpan={size}
              className={cn(AXIS, 'pb-1 text-center')}
            >
              People
            </th>
          </tr>
          <tr>
            <td colSpan={2} />
            {confusion.labels.map((label) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  AXIS,
                  'w-11 max-w-11 pb-1 text-center leading-tight',
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {confusion.cells.map((row, at) => {
            const label = confusion.labels[at] ?? '';

            return (
              <tr key={label}>
                {at === 0 && (
                  <th
                    scope="rowgroup"
                    rowSpan={size}
                    className={cn(AXIS, 'w-6 pr-1 align-middle')}
                  >
                    <span className="inline-block rotate-180 [writing-mode:vertical-rl]">
                      Judge
                    </span>
                  </th>
                )}
                <th
                  scope="row"
                  className={cn(AXIS, 'pr-2 text-right leading-tight')}
                >
                  {label}
                </th>
                {row.map((count, column) => (
                  <td
                    key={confusion.labels[column]}
                    style={{ background: shadeOf(count, most) }}
                    className={cn(
                      'size-11 rounded-sm text-center',
                      count === 0
                        ? 'text-muted-foreground'
                        : count > most / 2
                          ? 'font-medium text-white'
                          : 'text-foreground',
                    )}
                  >
                    {count}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
