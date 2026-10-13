import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StateBox } from '@/components/features/replays/StateBox';
import { CheckRow } from '@/components/features/replays/set/CheckRow';
import { GuardsChangesToggle } from '@/components/features/replays/set/GuardsChangesToggle';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { PanelActions } from '@/components/shared/PanelActions';
import { Button } from '@/components/ui/button';
import { useReplaySetChecks } from '@/hooks/api/useReplaySetChecks';
import { failed, loading } from '@/lib/query';
import { type ReplaySet, SET_CHECK_HEADINGS } from '@/lib/replay';
import { type LineReplayCheck, replayCheckNote } from '@/lib/search';

type SetChecksProps = {
  teamId: string;
  set: ReplaySet;
  replayCheck: LineReplayCheck | null | undefined;
};

export function SetChecks({ teamId, set, replayCheck }: SetChecksProps) {
  const checks = useReplaySetChecks(teamId, set.id);
  const listed = checks.data?.pages.flat() ?? [];

  let body: ReactNode;

  if (loading(checks)) {
    body = (
      <NestedTableSkeleton
        label="Loading the checks"
        headings={SET_CHECK_HEADINGS}
        compact
      />
    );
  } else if (failed(checks)) {
    body = (
      <StateBox flat>
        <CouldNotLoad
          what="The set’s checks"
          retrying={checks.isFetching}
          onRetry={() => void checks.refetch()}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox flat>
        <EmptyState icon={ShieldCheck} title="No checks yet">
          {set.guardsChanges
            ? 'Pull requests that change this station are checked here.'
            : 'Set doesn’t guard config changes.'}
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2">
        <NestedTable label="Checks" headings={SET_CHECK_HEADINGS} compact>
          {listed.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </NestedTable>
        {checks.hasNextPage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-center"
            disabled={checks.isFetchingNextPage}
            onClick={() => void checks.fetchNextPage()}
          >
            {checks.isFetchingNextPage ? 'Loading…' : 'Show older checks'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <InsightsCard
      tableOnly
      title="Checks"
      description={replayCheckNote(replayCheck)}
    >
      {body}
      <PanelActions>
        <GuardsChangesToggle teamId={teamId} set={set} />
      </PanelActions>
    </InsightsCard>
  );
}
