import { Play } from 'lucide-react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { OutcomeRow } from '@/components/features/stations/outcomes/OutcomeRow';
import { RecentRunsSkeleton } from '@/components/features/stations/overview/RecentRunsSkeleton';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationOutcomes } from '@/hooks/api/useStationOutcomes';
import { DEFAULT_PERIOD, insightsPath } from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { RECENT_RUN_HEADINGS, recentRuns } from '@/lib/station-outcomes';

const SHOWN = 8;

type StationRecentRunsProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationRecentRuns({
  slug,
  teamId,
  lineId,
  stationId,
}: StationRecentRunsProps) {
  const outcomes = useStationOutcomes(teamId, lineId, stationId);
  const runs = recentRuns(outcomes.data?.groups ?? [], SHOWN);
  const all = insightsPath(slug, teamId, {
    tab: 'runs',
    period: DEFAULT_PERIOD,
    filter: { stationId },
    page: 1,
  });

  if (loading(outcomes)) {
    return <RecentRunsSkeleton />;
  }

  return (
    <InsightsCard
      tableOnly
      title="Recent runs"
      actions={runs.length > 0 && <SectionLink to={all}>All runs</SectionLink>}
    >
      {failed(outcomes) ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <MembersOnlyOrCouldNotLoad
            membersOnly="Only team members can see this station’s runs"
            what="The station’s runs"
            query={outcomes}
          />
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <EmptyState
            icon={Play}
            title="No runs yet"
            action={<CreateTaskLink slug={slug} teamId={teamId} />}
          >
            Latest runs show here once tasks reach this station.
          </EmptyState>
        </div>
      ) : (
        <NestedTable label="Recent runs" headings={RECENT_RUN_HEADINGS}>
          {runs.map((run) => (
            <OutcomeRow
              key={run.runId}
              run={run}
              to={runPath(slug, teamId, run.runId)}
            />
          ))}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
