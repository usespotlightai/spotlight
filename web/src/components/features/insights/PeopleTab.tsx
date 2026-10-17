import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { PeopleSkeleton } from '@/components/features/insights/PeopleSkeleton';
import { PeopleTable } from '@/components/features/insights/PeopleTable';
import { useInsightsPeople } from '@/hooks/api/useInsightsPeople';
import {
  ADOPTION_NOTE,
  changeDelta,
  formatCount,
  formatPer,
  formatShare,
  type InsightsPeriod,
  lasted,
  lastedOrNone,
  tasksFilter,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

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
  const refused = tasksFilter(load.refusedTaskIds);

  if (load.tasks === 0 && adoption.activeCount === 0) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Load on people shows here once they open tasks, answer the inbox or chat
        with the agent.
      </NoRunsInPeriod>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <InsightsSection
        title="What the work asks of people"
        note={`Tasks worked this period: ${formatCount(load.tasks)}`}
      >
        <InsightsTiles label="Human load">
          <InsightsTile
            label="Inbox asks per task"
            value={formatPer(load.asksPerTask)}
            detail={`${formatCount(load.asks)} asks`}
            delta={changeDelta(loadChanges.asksPerTask)}
            drill={{ tab: 'runs', filter: { asked: 'true' } }}
          />
          <InsightsTile
            label="Time to answer"
            value={lastedOrNone(load.toAnswer.p50Ms)}
            detail={[
              ...(load.toAnswer.p90Ms === null
                ? []
                : [`p90 ${lasted(load.toAnswer.p90Ms)}`]),
              `${formatCount(load.unanswered)} unanswered`,
            ].join(' · ')}
            delta={changeDelta(loadChanges.toAnswer)}
            drill={{ tab: 'runs', filter: { asked: 'true' } }}
          />
          <InsightsTile
            label="Sent-back rate"
            value={formatShare(load.sentBackRate)}
            detail={`${formatCount(load.sentBack)} runs sent back`}
            delta={changeDelta(loadChanges.sentBackRate)}
            drill={{ tab: 'runs', filter: { next: 'sent-back' } }}
          />
          <InsightsTile
            label="Refused approvals"
            value={formatCount(load.refused)}
            detail="Tool approvals and permissions"
            delta={changeDelta(loadChanges.refused)}
            drill={refused ? { tab: 'runs', filter: refused } : undefined}
          />
        </InsightsTiles>
      </InsightsSection>

      <InsightsSection title="Who is using Spotlight" note={ADOPTION_NOTE}>
        <InsightsTiles label="Adoption">
          <InsightsTile
            label="Active people"
            value={formatCount(adoption.activeCount)}
            delta={changeDelta(adoption.activeChange)}
          />
          <InsightsTile
            label="New adopters"
            value={formatCount(adoption.newAdopterCount)}
          />
          <InsightsTile
            label="Weekly active"
            value={formatCount(adoption.weeklyCount)}
          />
          <InsightsTile
            label="Monthly active"
            value={formatCount(adoption.monthlyCount)}
            detail={`${formatShare(adoption.stickiness)} of them weekly`}
          />
        </InsightsTiles>
      </InsightsSection>

      {adoption.people.length > 0 && (
        <InsightsCard scrolls title="What each person did" tableOnly>
          <PeopleTable people={adoption.people} />
        </InsightsCard>
      )}
    </div>
  );
}
