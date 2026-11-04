import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import {
  OVERVIEW_LAYOUT,
  TILE_ROW,
} from '@/components/features/insights/overview-layout';
import { PeopleSkeleton } from '@/components/features/insights/PeopleSkeleton';
import { PeopleTable } from '@/components/features/insights/PeopleTable';
import { useInsightsPeople } from '@/hooks/api/useInsightsPeople';
import {
  ADOPTION_NOTE,
  formatCount,
  formatDuration,
  formatDurationOrNone,
  formatPer,
  formatShare,
  type InsightsPeople,
  type InsightsPeriod,
  shownDeltaOf,
  tasksFilter,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import type { TooltipNote } from '@/lib/tooltip-note';

const adoptionNote = (adoption: InsightsPeople['adoption']): TooltipNote => ({
  body: ADOPTION_NOTE,
  rows: [
    [
      'Against the period before',
      shownDeltaOf(adoption.activeChange)?.shown ?? 'Not known',
    ],
    ['Last 7 days', formatCount(adoption.weeklyCount)],
    ['Last 30 days', formatCount(adoption.monthlyCount)],
    ['Weekly of monthly', formatShare(adoption.stickiness)],
    ['New this period', formatCount(adoption.newAdopterCount)],
  ],
});

type PeopleTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
};

export function PeopleTab({ slug, teamId, period }: PeopleTabProps) {
  const people = useInsightsPeople(teamId, period);

  if (loading(people)) {
    return <PeopleSkeleton />;
  }

  if (failed(people) || !people.data) {
    return <InsightsFailed what="The people" query={people} />;
  }

  const { load, loadChanges, adoption } = people.data;
  const dismissed = tasksFilter(load.dismissedTaskIds);

  if (load.tasks === 0 && adoption.activeCount === 0) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Load on people shows here once they open tasks, answer the inbox or chat
        with the agent.
      </NoRunsInPeriod>
    );
  }

  return (
    <div className={OVERVIEW_LAYOUT}>
      <InsightsSection title="What the work asks of people">
        <InsightsTiles label="Human load" className={TILE_ROW}>
          <InsightsTile
            label="Asks per task"
            value={formatPer(load.asksPerTask)}
            detail={`Over ${formatCount(load.tasks)} ${load.tasks === 1 ? 'task' : 'tasks'}`}
            tooltip={`${formatCount(load.asks)} asks in all`}
            delta={shownDeltaOf(loadChanges.asksPerTask)}
            drill={{ tab: 'traces', filter: { asked: 'true' } }}
          />
          <InsightsTile
            label="Time to answer"
            value={formatDurationOrNone(load.toAnswer.p50Ms)}
            detail={`${formatCount(load.unanswered)} unanswered`}
            tooltip={
              load.toAnswer.p90Ms === null
                ? undefined
                : `Slowest 10%: ${formatDuration(load.toAnswer.p90Ms)}`
            }
            delta={shownDeltaOf(loadChanges.toAnswer)}
            drill={{ tab: 'traces', filter: { asked: 'true' } }}
          />
          <InsightsTile
            label="Sent-back rate"
            value={formatShare(load.sentBackRate)}
            detail={`${formatCount(load.sentBack)} runs`}
            delta={shownDeltaOf(loadChanges.sentBackRate)}
            drill={{ tab: 'traces', filter: { humanAction: 'sent-back' } }}
          />
          <InsightsTile
            label="Dismissed"
            value={formatCount(load.dismissed)}
            tooltip="Tool approvals and permissions that people dismissed"
            delta={shownDeltaOf(loadChanges.dismissed)}
            drill={dismissed ? { tab: 'traces', filter: dismissed } : undefined}
          />
        </InsightsTiles>
      </InsightsSection>

      <InsightsSection
        title="Who is using Spotlight"
        aside={`${formatCount(adoption.activeCount)} active`}
        tooltip={adoptionNote(adoption)}
      >
        {adoption.people.length > 0 && <PeopleTable people={adoption.people} />}
      </InsightsSection>
    </div>
  );
}
