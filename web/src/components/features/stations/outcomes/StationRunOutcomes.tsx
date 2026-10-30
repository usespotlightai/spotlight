import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { NoStationRuns } from '@/components/features/stations/outcomes/NoStationRuns';
import { OutcomeGroup } from '@/components/features/stations/outcomes/OutcomeGroup';
import { StationRunOutcomesSkeleton } from '@/components/features/stations/outcomes/StationRunOutcomesSkeleton';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import { notFound } from '@/lib/error';
import { RUNS_BY_CONFIG_NOTE } from '@/lib/insights';
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

  if (outcomes.data && groups.length === 0) {
    return <NoStationRuns slug={slug} teamId={teamId} />;
  }

  return (
    <InsightsCard
      scrolls
      title="Runs by config"
      description={RUNS_BY_CONFIG_NOTE}
    >
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
    </InsightsCard>
  );
}
