import { History } from 'lucide-react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StateBox } from '@/components/features/replays/StateBox';
import { OutcomeBar } from '@/components/features/replays/set/OutcomeBar';
import { SetRunRow } from '@/components/features/replays/set/SetRunRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import {
  type ReplayedStation,
  type ReplaySet,
  SET_RUN_HEADINGS,
  type SetComposition,
} from '@/lib/replay';
import {
  formatBalanceWarning,
  formatEndedSpan,
  formatOrigin,
  ORIGINS_LABEL,
} from '@/lib/replay-words';

const RUNS_NOTE =
  'Past runs of the station that Spotlight keeps in the set. Each replay reruns all of them.';

const compositionNote = (composition: SetComposition): string =>
  [
    RUNS_NOTE,
    formatEndedSpan(composition),
    `${ORIGINS_LABEL}: ${composition.origins
      .map((each) => `${formatOrigin(each.origin)} ${each.count}`)
      .join(' · ')}`,
  ]
    .filter(Boolean)
    .join(' ');

type SetRunsProps = {
  at: ReplayedStation;
  set: ReplaySet;
  frozen: boolean;
};

export function SetRuns({ at, set, frozen }: SetRunsProps) {
  const { composition } = set;

  return (
    <InsightsCard
      tableOnly
      title="Runs"
      description={
        set.entries.length > 0 ? compositionNote(composition) : RUNS_NOTE
      }
      actions={
        composition.balanceWarning && (
          <WarningTooltip
            tone="warning"
            label="Unbalanced set"
            tooltip={formatBalanceWarning(composition.balanceWarning)}
          />
        )
      }
    >
      {set.entries.length === 0 ? (
        <StateBox flat>
          <EmptyState icon={History} title="No runs in this set">
            Spotlight adds the station’s replayable runs when it refreshes the
            set.
          </EmptyState>
        </StateBox>
      ) : (
        <div className="flex flex-col gap-3">
          <div data-slot="set-composition">
            <OutcomeBar outcomes={composition.outcomes} />
          </div>
          <NestedTable
            label="Runs in the set"
            headings={SET_RUN_HEADINGS}
            trailing
            compact
          >
            {set.entries.map((entry) => (
              <SetRunRow
                key={entry.runId}
                at={at}
                setId={set.id}
                entry={entry}
                frozen={frozen}
              />
            ))}
          </NestedTable>
        </div>
      )}
    </InsightsCard>
  );
}
