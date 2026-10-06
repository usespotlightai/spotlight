import { Play } from 'lucide-react';
import { CardList } from '@/components/features/replays/CardList';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { OutcomeRow } from '@/components/features/stations/outcomes/OutcomeRow';
import { StationSection } from '@/components/features/stations/StationSection';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationOutcomes } from '@/hooks/api/useStationOutcomes';
import { DEFAULT_PERIOD, insightsPath } from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { recentRuns } from '@/lib/station-outcomes';

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

  return (
    <StationSection
      title="Recent runs"
      action={runs.length > 0 && <SectionLink to={all}>All runs</SectionLink>}
    >
      {loading(outcomes) ? (
        <RowsSkeleton label="Loading the station’s runs" />
      ) : failed(outcomes) ? (
        <StateBox>
          <MembersOnlyOrCouldNotLoad
            membersOnly="Only team members can see this station’s runs"
            what="The station’s runs"
            query={outcomes}
          />
        </StateBox>
      ) : runs.length === 0 ? (
        <StateBox>
          <EmptyState
            icon={Play}
            title="No runs yet"
            action={<CreateTaskLink slug={slug} teamId={teamId} />}
          >
            Latest runs show here once tasks reach this station.
          </EmptyState>
        </StateBox>
      ) : (
        <CardList label="Recent runs">
          {runs.map((run) => (
            <OutcomeRow
              key={run.runId}
              run={run}
              to={runPath(slug, teamId, run.runId)}
            />
          ))}
        </CardList>
      )}
    </StationSection>
  );
}
