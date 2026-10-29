import { Play } from 'lucide-react';
import { OutcomeGroup } from '@/components/features/stations/outcomes/OutcomeGroup';
import { StationRunOutcomesSkeleton } from '@/components/features/stations/outcomes/StationRunOutcomesSkeleton';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { OUTCOME_HEADINGS } from '@/lib/station-insights';

const BOX = 'flex justify-center py-10';

type StationRunOutcomesProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationRunOutcomes({
  slug,
  teamId,
  lineId,
  stationId,
}: StationRunOutcomesProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const groups = outcomes.data?.groups ?? [];
  const collapsibles = useCollapsibles();

  return (
    <>
      {loading(outcomes) ? (
        <StationRunOutcomesSkeleton />
      ) : failed(outcomes) && notFound(outcomes.error) ? (
        <div className={BOX}>
          <MembersOnly title="Only team members can see this station’s runs" />
        </div>
      ) : failed(outcomes) ? (
        <div className={BOX}>
          <CouldNotLoad
            what="The station’s runs"
            retrying={outcomes.isFetching}
            onRetry={() => void outcomes.refetch()}
          />
        </div>
      ) : groups.length === 0 ? (
        <div className={BOX}>
          <EmptyState
            icon={Play}
            title="No runs yet"
            action={<CreateTaskLink slug={slug} teamId={teamId} />}
          >
            Runs show here by config once tasks reach this station.
          </EmptyState>
        </div>
      ) : (
        <NestedTable
          label="Runs by config"
          headings={OUTCOME_HEADINGS}
          trailing
        >
          {groups.map((group) => (
            <OutcomeGroup
              key={group.firstRunId}
              slug={slug}
              teamId={teamId}
              stationId={stationId}
              group={group}
              collapsibles={collapsibles}
            />
          ))}
        </NestedTable>
      )}
    </>
  );
}
