import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import type { HarnessResponseDto } from '@/lib/api';
import { spentIn } from '@/lib/inbox';
import { countShown } from '@/lib/insights';
import {
  OUTCOME_MEASURES,
  type OutcomeMeasure,
  outcomeShown,
  type SetupOutcome,
  setupKey,
  setupShown,
} from '@/lib/insights-changes';

type SetupTableProps = {
  setups: readonly SetupOutcome[];
  measure: OutcomeMeasure;
  harnesses: readonly HarnessResponseDto[] | undefined;
  judged: boolean;
};

export function SetupTable({
  setups,
  measure,
  harnesses,
  judged,
}: SetupTableProps) {
  const columns: InsightsColumn<SetupOutcome>[] = [
    {
      id: 'setup',
      header: 'Setup',
      cell: (setup) => (
        <>
          {setupShown(setup, harnesses)}
          {setup.frontier.includes(measure) && (
            <span className="ml-1.5 text-primary">frontier</span>
          )}
        </>
      ),
    },
    {
      id: 'runs',
      header: 'Runs',
      numeric: true,
      cell: (setup) => countShown(setup.tally.runs),
    },
    {
      id: 'cost',
      header: 'Cost per run',
      numeric: true,
      cell: (setup) =>
        setup.costPerRun === null || !setup.currency
          ? '–'
          : spentIn(setup.costPerRun, setup.currency),
    },
    ...OUTCOME_MEASURES.filter((each) => each.id !== 'judge' || judged).map(
      (each): InsightsColumn<SetupOutcome> => ({
        id: each.id,
        header: each.label,
        numeric: true,
        cell: (setup) => outcomeShown(setup.outcomes[each.id]),
      }),
    ),
  ];

  return (
    <InsightsTable
      label="Harness, model, effort and profile"
      columns={columns}
      rows={setups}
      rowKey={setupKey}
    />
  );
}
