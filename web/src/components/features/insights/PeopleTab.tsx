import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { PeopleSkeleton } from '@/components/features/insights/PeopleSkeleton';
import { PeopleTable } from '@/components/features/insights/PeopleTable';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { useInsightsPeople } from '@/hooks/api/useInsightsPeople';
import {
  countShown,
  deltaOf,
  type InsightsPeriod,
  lasted,
  lastedOrNone,
  perShown,
  shareShown,
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

  const { load, loadBefore, adoption, truncated } = people.data;
  const refused = tasksFilter(load.refusedTaskIds);

  if (load.tasks === 0 && adoption.active.length === 0) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Load on people shows here once they open tasks, answer the inbox or chat
        with the agent.
      </NoRunsInPeriod>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {truncated && <TruncatedNote />}

      <InsightsSection
        title="What the work asks of people"
        note={`Tasks worked this period: ${countShown(load.tasks)}`}
      >
        <InsightsTiles label="Human load">
          <InsightsTile
            label="Inbox asks per task"
            value={perShown(load.asksPerTask)}
            detail={`${countShown(load.asks)} asks`}
            delta={deltaOf(load.asksPerTask, loadBefore.asksPerTask, 'down')}
            drill={{ tab: 'runs', filter: { asked: 'true' } }}
          />
          <InsightsTile
            label="Time to answer"
            value={lastedOrNone(load.toAnswer.p50Ms)}
            detail={[
              ...(load.toAnswer.p90Ms === null
                ? []
                : [`p90 ${lasted(load.toAnswer.p90Ms)}`]),
              `${countShown(load.unanswered)} unanswered`,
            ].join(' · ')}
            delta={deltaOf(
              load.toAnswer.p50Ms,
              loadBefore.toAnswer.p50Ms,
              'down',
            )}
            drill={{ tab: 'runs', filter: { asked: 'true' } }}
          />
          <InsightsTile
            label="Sent-back rate"
            value={shareShown(load.sentBackRate)}
            detail={`${countShown(load.sentBack)} runs sent back`}
            delta={deltaOf(load.sentBackRate, loadBefore.sentBackRate, 'down')}
            drill={{ tab: 'runs', filter: { next: 'sent-back' } }}
          />
          <InsightsTile
            label="Refused approvals"
            value={countShown(load.refused)}
            detail="Tool approvals and permissions"
            delta={deltaOf(load.refused, loadBefore.refused, 'down')}
            drill={refused ? { tab: 'runs', filter: refused } : undefined}
          />
        </InsightsTiles>
      </InsightsSection>

      <InsightsSection
        title="Who is using Spotlight"
        note="Weekly and monthly always count the last 7 and 30 days."
      >
        <InsightsTiles label="Adoption">
          <InsightsTile
            label="Active people"
            value={countShown(adoption.active.length)}
            delta={deltaOf(
              adoption.active.length,
              adoption.activeBefore.length,
              'up',
            )}
          />
          <InsightsTile
            label="New adopters"
            value={countShown(adoption.newAdopters.length)}
          />
          <InsightsTile
            label="Weekly active"
            value={countShown(adoption.weekly.length)}
          />
          <InsightsTile
            label="Monthly active"
            value={countShown(adoption.monthly.length)}
            detail={`${shareShown(adoption.stickiness)} of them weekly`}
          />
        </InsightsTiles>
      </InsightsSection>

      {adoption.people.length > 0 && (
        <InsightsCard title="What each person did" tableOnly>
          <PeopleTable people={adoption.people} />
        </InsightsCard>
      )}
    </div>
  );
}
