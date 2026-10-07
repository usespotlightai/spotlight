import { DeltaMark } from '@/components/features/insights/DeltaMark';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { SPREAD } from '@/lib/nested-table';
import { comparedRows, type MeasureVerdict } from '@/lib/tally-comparison';
import { cn } from '@/lib/utils';

const HEADINGS = [
  { label: 'Measure', indent: 'edge' as const, size: SPREAD },
  { label: 'Without', numeric: true, size: SPREAD },
  { label: 'With', numeric: true, size: SPREAD },
  { label: 'Change', numeric: true, size: SPREAD },
];

type MemoryComparisonProps = {
  runs: { readonly without: number; readonly with: number };
  verdicts: readonly MeasureVerdict[];
};

export function MemoryComparison({ runs, verdicts }: MemoryComparisonProps) {
  return (
    <NestedTable
      label="Runs without memories against runs with them"
      headings={HEADINGS}
    >
      {comparedRows({ one: runs.without, other: runs.with }, verdicts).map(
        (row) => (
          <li
            key={row.id}
            data-slot="compared-measure"
            className={cn(
              'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
              ROW_DIVIDER,
            )}
          >
            <span
              className={cn(
                'col-span-full min-w-0 text-foreground text-xs @4xl:col-span-1',
                EDGE_INDENT,
              )}
            >
              {row.label}
            </span>
            <NestedCell heading="Without">{row.one}</NestedCell>
            <NestedCell heading="With" strong>
              {row.other}
            </NestedCell>
            <NestedCell heading="Change">
              {row.delta ? <DeltaMark delta={row.delta} /> : '–'}
            </NestedCell>
          </li>
        ),
      )}
    </NestedTable>
  );
}
