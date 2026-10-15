import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type {
  AdoptionCounts,
  PersonActivity,
} from '@outcomes/domain/services/adoption';
import type { HumanLoadCounts } from '@outcomes/domain/services/human-load';
import { NO_SPREAD, type Spread } from '@outcomes/domain/services/measures';
import type { PeopleCounts } from '@outcomes/domain/services/people-counts';
import { inboxWaits } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/inbox.sql';
import {
  asUtc,
  atWithin,
  counted,
  factsInPeriod,
  inTouchOrder,
  isCurrent,
  msOf,
  ran,
  sentBack,
  spreadOver,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  ofTeamTouches,
  teamActivity,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  runFact,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { sql } from 'drizzle-orm';

interface AsksRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly asks: number;
  readonly unanswered: number;
  readonly to_answer: Spread;
  readonly task_ids: string[];
}

interface RunsRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly tasks: number;
  readonly runs: number;
  readonly sent_back: number;
}

interface RefusedRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly refused: number;
  readonly task_ids: string[];
}

interface ActivityRow extends Record<string, unknown> {
  readonly person: string;
  readonly opened: number;
  readonly acts: number;
  readonly chats: number;
  readonly last_active_ms: number | null;
  readonly first_ms: number;
  readonly now: boolean;
  readonly before: boolean;
  readonly weekly: boolean;
  readonly monthly: boolean;
}

const asksIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly AsksRow[]> => {
  const { current, previous } = team.period;
  const answerMs = msOf(sql`asked.answered_at - asked.asked_at`);
  const result = await db.execute<AsksRow>(sql`
    with asked as (
      select waits.*, waits.asked_at >= ${asUtc(current.from)} as is_current
      from ${inboxWaits(team, previous.from, current.to)}
    ), tasks as (
      select distinct is_current, task_id, touched_at
      from asked
    )
    select
      asked.is_current,
      count(*)::int as asks,
      count(*) filter (where asked.answered_at is null)::int as unanswered,
      ${spreadOver(answerMs, sql`asked.answered_at is not null`)} as to_answer,
      (
        select ${inTouchOrder(sql`tasks.task_id`, sql`tasks.touched_at`)}
        from tasks
        where tasks.is_current = asked.is_current
      ) as task_ids
    from asked
    group by asked.is_current
  `);

  return result.rows;
};

const runsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RunsRow[]> => {
  const result = await db.execute<RunsRow>(sql`
    select
      ${isCurrent} as is_current,
      count(distinct ${runFact.taskId}) filter (where ${ran})::int as tasks,
      ${counted(ran)} as runs,
      ${counted(sentBack)} as sent_back
    from ${factsInPeriod(team)}
    group by ${isCurrent}
  `);

  return result.rows;
};

const refusedIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RefusedRow[]> => {
  const { current, previous } = team.period;
  const at = sql`(act.value->>'at')::timestamptz`;
  const result = await db.execute<RefusedRow>(sql`
    with refusals as (
      select
        ${taskTouches.taskId} as task_id,
        ${taskTouches.touchedAt} as touched_at,
        ${at} >= ${asUtc(current.from)} as is_current,
        count(*) as acts
      from ${taskTouches}
      cross join lateral jsonb_array_elements(${taskTouches.acts}) as act(value)
      where ${ofTeamTouches(team)}
        and act.value->>'act' = 'refused'
        and ${atWithin(at, { from: previous.from, to: current.to })}
      group by 1, 2, 3
    )
    select
      refusals.is_current,
      sum(refusals.acts)::int as refused,
      ${inTouchOrder(sql`refusals.task_id`, sql`refusals.touched_at`)} as task_ids
    from refusals
    group by refusals.is_current
  `);

  return result.rows;
};

const activityIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly ActivityRow[]> => {
  const { current, previous, lastWeek, lastMonth } = team.period;
  const at = sql`activity.at`;
  const now = atWithin(at, current);
  const result = await db.execute<ActivityRow>(sql`
    select
      activity.person,
      count(*) filter (where ${now} and activity.kind = 'opened')::int as opened,
      count(*) filter (where ${now} and activity.kind = 'acted')::int as acts,
      count(*) filter (where ${now} and activity.kind = 'chatted')::int as chats,
      ${msOf(sql`max(${at}) filter (where ${now})`)} as last_active_ms,
      ${msOf(sql`min(${at})`)} as first_ms,
      bool_or(${now}) as now,
      bool_or(${atWithin(at, previous)}) as before,
      bool_or(${atWithin(at, lastWeek)}) as weekly,
      bool_or(${atWithin(at, lastMonth)}) as monthly
    from ${teamActivity(team)}
    group by activity.person
  `);

  return result.rows;
};

const loadCountsFrom = (
  current: boolean,
  asks: readonly AsksRow[],
  runs: readonly RunsRow[],
  refused: readonly RefusedRow[],
): HumanLoadCounts => {
  const asked = asks.find((each) => each.is_current === current);
  const ran = runs.find((each) => each.is_current === current);
  const refusing = refused.find((each) => each.is_current === current);

  return {
    asks: asked?.asks ?? 0,
    unanswered: asked?.unanswered ?? 0,
    toAnswer: asked?.to_answer ?? NO_SPREAD,
    askedTaskIds: asked?.task_ids ?? [],
    tasks: ran?.tasks ?? 0,
    runs: ran?.runs ?? 0,
    sentBack: ran?.sent_back ?? 0,
    refused: refusing?.refused ?? 0,
    refusedTaskIds: refusing?.task_ids ?? [],
  };
};

const byPerson = (one: PersonActivity, other: PersonActivity): number =>
  one.personId < other.personId ? -1 : one.personId > other.personId ? 1 : 0;

const adoptionCountsFrom = (
  activity: readonly ActivityRow[],
): AdoptionCounts => ({
  people: activity
    .flatMap((row): PersonActivity[] =>
      row.now && row.last_active_ms !== null
        ? [
            {
              personId: row.person,
              opened: row.opened,
              acts: row.acts,
              chats: row.chats,
              lastActiveAt: new Date(row.last_active_ms),
              firstAt: new Date(row.first_ms),
            },
          ]
        : [],
    )
    .sort(byPerson),
  before: activity.filter((row) => row.before).length,
  weekly: activity.filter((row) => row.weekly).length,
  monthly: activity.filter((row) => row.monthly).length,
});

export const peopleCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<PeopleCounts> => {
  const asks = await asksIn(db, team);
  const runs = await runsIn(db, team);
  const refused = await refusedIn(db, team);
  const activity = await activityIn(db, team);

  return {
    load: {
      current: loadCountsFrom(true, asks, runs, refused),
      previous: loadCountsFrom(false, asks, runs, refused),
    },
    adoption: adoptionCountsFrom(activity),
  };
};
