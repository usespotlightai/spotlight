import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { comparedRows, type MeasureVerdict } from '@/lib/tally-comparison';

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
  return (
    <table
      aria-label={label}
      data-slot="tally-comparison"
      className="w-full text-xs"
    >
      <thead>
        <tr className="text-left text-muted-foreground">
          <th scope="col" className="py-1 font-normal">
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {oneLabel}
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {otherLabel}
          </th>
          <th scope="col" className="py-1 pl-3 text-right font-normal">
            Change
          </th>
        </tr>
      </thead>
      <tbody>
        {comparedRows(runs, verdicts).map((row) => (
          <tr key={row.id} className="border-border border-t-[0.5px]">
            <th
              scope="row"
              className="py-1.5 text-left font-normal text-muted-foreground"
            >
              {row.label}
            </th>
            <td className="py-1.5 text-right text-foreground tabular-nums">
              {row.one}
            </td>
            <td className="py-1.5 text-right text-foreground tabular-nums">
              {row.other}
            </td>
            <td data-slot="verdict" className="py-1.5 pl-3 text-right">
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
