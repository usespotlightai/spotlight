import {
  CardTitle,
  useCardHeading,
} from '@/components/features/insights/CardHeading';
import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { comparedRows, type MeasureVerdict } from '@/lib/tally-comparison';
import { cn } from '@/lib/utils';

type TallyComparisonProps = {
  label: string;
  oneLabel: string;
  otherLabel: string;
  runs: { readonly one: number; readonly other: number };
  verdicts: readonly MeasureVerdict[];
};

export function TallyComparison({
  label,
  oneLabel,
  otherLabel,
  runs,
  verdicts,
}: TallyComparisonProps) {
  const heading = useCardHeading();
  const cell = heading ? 'px-2.5' : '';

  return (
    <table
      aria-label={label}
      data-slot="tally-comparison"
      className="w-full text-xs"
    >
      <thead>
        <tr
          className={cn(
            'text-left text-muted-foreground',
            heading && 'h-8 border-border border-b bg-muted/40 text-[0.7rem]',
          )}
        >
          <th scope="col" className={cn('py-1 font-normal', cell)}>
            {heading && <CardTitle heading={heading} />}
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col" className={cn('py-1 text-right font-normal', cell)}>
            {oneLabel}
          </th>
          <th scope="col" className={cn('py-1 text-right font-normal', cell)}>
            {otherLabel}
          </th>
          <th
            scope="col"
            className={cn('py-1 pl-3 text-right font-normal', cell)}
          >
            Change
          </th>
        </tr>
      </thead>
      <tbody>
        {comparedRows(runs, verdicts).map((row) => (
          <tr
            key={row.id}
            className={cn(
              heading ? 'even:bg-muted/30' : 'border-border border-t-[0.5px]',
            )}
          >
            <th
              scope="row"
              className={cn(
                'py-1.5 text-left font-normal text-muted-foreground',
                cell,
              )}
            >
              {row.label}
            </th>
            <td
              className={cn(
                'py-1.5 text-right text-foreground tabular-nums',
                cell,
              )}
            >
              {row.one}
            </td>
            <td
              className={cn(
                'py-1.5 text-right text-foreground tabular-nums',
                cell,
              )}
            >
              {row.other}
            </td>
            <td
              data-slot="verdict"
              className={cn('py-1.5 pl-3 text-right', cell)}
            >
              {row.delta ? (
                <DeltaShown delta={row.delta} against={null} />
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
