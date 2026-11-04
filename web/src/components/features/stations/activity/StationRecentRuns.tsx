import { Play } from 'lucide-react';
import { RecentRunsSkeleton } from '@/components/features/stations/activity/RecentRunsSkeleton';
import { OutcomeRow } from '@/components/features/stations/outcomes/OutcomeRow';
import { TabSection } from '@/components/features/stations/TabSection';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { DEFAULT_PERIOD, insightsPath } from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import {
  hasRuns,
  RECENT_RUN_HEADINGS,
  RECENT_RUNS_TITLE,
  recentRuns,
} from '@/lib/station-insights';

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
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const groups = outcomes.data?.groups ?? [];
  const runs = recentRuns(groups, SHOWN);
  const ran = hasRuns(groups);
  const all = insightsPath(slug, teamId, {
    tab: 'traces',
    period: DEFAULT_PERIOD,
    filter: { stationId },
    page: 1,
  });

  if (loading(outcomes)) {
    return <RecentRunsSkeleton />;
  }

  return (
    <TabSection
      title={RECENT_RUNS_TITLE}
      action={ran && <SectionLink to={all}>All runs</SectionLink>}
    >
      {failed(outcomes) ? (
        <div className="flex justify-center py-10">
          <MembersOnlyOrCouldNotLoad
            membersOnly="Only team members can see this station’s runs"
            what="The station’s runs"
            query={outcomes}
          />
        </div>
      ) : runs.length === 0 ? (
        <div className="flex justify-center py-10">
          {ran ? (
            <EmptyState icon={Play} title="No runs on this config yet">
              Runs on earlier configs are under All runs.
            </EmptyState>
          ) : (
            <EmptyState
              icon={Play}
              title="No runs yet"
              action={<CreateTaskLink slug={slug} teamId={teamId} />}
            >
              Latest runs show here once tasks reach this station.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="-mx-3">
          <NestedTable label={RECENT_RUNS_TITLE} headings={RECENT_RUN_HEADINGS}>
            {runs.map((run) => (
              <OutcomeRow
                key={run.runId}
                run={run}
                to={runPath(slug, teamId, run.runId)}
              />
            ))}
          </NestedTable>
        </div>
      )}
    </TabSection>
  );
}
