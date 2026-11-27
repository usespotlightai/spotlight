import { ComparedLabel } from '@/components/features/insights/ComparedLabel';
import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
import {
  type ComparedRow,
  comparedRows,
  type MeasureVerdict,
} from '@/lib/tally-comparison';
import { cn } from '@/lib/utils';

type TallyComparisonProps = {
  label: string;
  oneLabel: string;
  otherLabel: string;
  runs: { readonly one: number; readonly other: number };
  verdicts: readonly MeasureVerdict[];
  extra?: readonly ComparedRow[];
};

export function TallyComparison({
  label,
  oneLabel,
  otherLabel,
  runs,
  verdicts,
  extra = [],
}: TallyComparisonProps) {
  return (
    <table
      aria-label={label}
      data-slot="tally-comparison"
      className="w-full text-xs"
    >
      <thead>
        <tr className="text-left text-muted-foreground">
          <th scope="col" className={cn('py-1 font-normal')}>
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col" className={cn('py-1 text-right font-normal')}>
            {oneLabel}
          </th>
          <th scope="col" className={cn('py-1 text-right font-normal')}>
            {otherLabel}
          </th>
          <th scope="col" className={cn('py-1 pl-3 text-right font-normal')}>
            Change
          </th>
        </tr>
      </thead>
      <tbody>
        {[...comparedRows(runs, verdicts), ...extra].map((row) => (
          <tr key={row.id} className={cn('border-border border-t-[0.5px]')}>
            <th
              scope="row"
              className={cn(
                'py-1.5 text-left font-normal text-muted-foreground',
              )}
            >
              <ComparedLabel row={row} />
            </th>
            <td
              className={cn('py-1.5 text-right text-foreground tabular-nums')}
            >
              {row.one}
            </td>
            <td
              className={cn('py-1.5 text-right text-foreground tabular-nums')}
            >
              {row.other}
            </td>
            <td data-slot="verdict" className={cn('py-1.5 pl-3 text-right')}>
              {row.delta ? (
                <DeltaGlyph delta={row.delta} />
              ) : (
                <span className="text-muted-foreground">–</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
