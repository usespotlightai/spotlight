import { Play } from 'lucide-react';
import { OutcomeIcon } from '@/components/features/stations/activity/OutcomeIcon';
import {
  RECENT_RUN_COLUMNS,
  RecentRunsHead,
} from '@/components/features/stations/activity/RecentRunsHead';
import { RecentRunsSkeleton } from '@/components/features/stations/activity/RecentRunsSkeleton';
import { TabSection } from '@/components/features/stations/TabSection';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { SectionLink } from '@/components/shared/SectionLink';
import { TABLE_ROW } from '@/components/shared/table-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { DEFAULT_PERIOD, insightsPath } from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { since } from '@/lib/since';
import {
  formatChecks,
  formatEnding,
  formatHumanAction,
  formatPullRequestState,
  formatRunDuration,
  hasRuns,
  outcomeTone,
  recentRuns,
  runSpent,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

const SHOWN = 8;

const TITLE = 'Recent runs';

const MUTED = 'truncate text-muted-foreground';

const NUMBER = 'truncate text-right tabular-nums';

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
      title={TITLE}
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
        <div className="-mx-3 overflow-x-auto [scrollbar-width:none]">
          <div className="min-w-[46rem]">
            <RecentRunsHead />
            <ul aria-label={TITLE}>
              {runs.map((run) => (
                <li
                  key={run.runId}
                  className={cn(
                    TABLE_ROW,
                    RECENT_RUN_COLUMNS,
                    'transition-colors hover:bg-accent',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <OutcomeIcon tone={outcomeTone(run)} />
                    <TrailLink
                      to={runPath(slug, teamId, run.runId)}
                      className="truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
                    >
                      {formatEnding(run.ending)}
                    </TrailLink>
                    {run.failure && (
                      <span className="relative z-10 flex">
                        <InfoTooltip tooltip={run.failure} />
                      </span>
                    )}
                  </span>
                  <span className={cn(MUTED, 'tabular-nums')}>{run.visit}</span>
                  <span className={MUTED}>{formatChecks(run.checks)}</span>
                  <span className={MUTED}>
                    {formatHumanAction(run.firstHumanAction)}
                  </span>
                  <span className={MUTED}>
                    {formatPullRequestState(run.pullRequestState)}
                  </span>
                  <span className={cn(NUMBER, 'text-muted-foreground')}>
                    {formatRunDuration(run.usage)}
                  </span>
                  <span className={cn(NUMBER, 'text-foreground')}>
                    {runSpent(run.usage)}
                  </span>
                  <span className={cn(NUMBER, 'text-muted-foreground')}>
                    {since(run.endedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </TabSection>
  );
}
