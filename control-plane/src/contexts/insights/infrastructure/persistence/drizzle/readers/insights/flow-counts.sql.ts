import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import type {
  DeliveryMoments,
  FlowCounts,
  FlowWindowCounts,
  StationInboxCounts,
  StationRunCounts,
} from '@insights/domain/services/flow';
import { NO_SPREAD, type Spread } from '@insights/domain/services/measures';
import { inboxWaits } from '@insights/infrastructure/persistence/drizzle/readers/insights/inbox.sql';
import {
  asUtc,
  dateOf,
  factsInPeriod,
  inEndOrder,
  isCurrent,
  iso,
  msOf,
  periodFacts,
  ran,
  type StationRow,
  spreadOver,
  stationsInEndOrder,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { ofTeamTaskPullRequests } from '@insights/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  runFact,
  taskHumanAction,
  taskPullRequest,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface RunsRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly station_id: string;
  readonly runs: number;
  readonly task_ids: string[];
  readonly queued: Spread;
  readonly running: Spread;
}

interface InboxRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly station_id: string;
  readonly asks: number;
  readonly unanswered: number;
  readonly inbox: Spread;
}

interface DeliveryRow extends Record<string, unknown> {
  readonly task_id: string;
  readonly opened_ms: number;
  readonly first_review_ms: number | null;
  readonly closed_ms: number | null;
  readonly merged: boolean;
  readonly task_opened_ms: number | null;
}

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly StationRow[]> => {
  const result = await db.execute<StationRow>(
    stationsInEndOrder(periodFacts(team), isCurrent),
  );

  return result.rows;
};

const runsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RunsRow[]> => {
  const queuedMs = msOf(sql`ran_here.started_at - ran_here.queued_at`);
  const runningMs = msOf(sql`ran_here.ended_at - ran_here.started_at`);
  const result = await db.execute<RunsRow>(sql`
    with ran_here as (
      select
        ${runFact}.*,
        row_number() over (
          partition by ${isCurrent}, ${runFact.stationId}
          order by ${inEndOrder}
        ) as place
      from ${factsInPeriod(team)}
      where ${ran}
    ), tasks as (
      select is_current, station_id, task_id, min(place) as first
      from ran_here
      group by is_current, station_id, task_id
    )
    select
      ran_here.is_current,
      ran_here.station_id,
      count(*)::int as runs,
      (
        select array_agg(tasks.task_id order by tasks.first)
        from tasks
        where tasks.is_current = ran_here.is_current
          and tasks.station_id = ran_here.station_id
      ) as task_ids,
      ${spreadOver(queuedMs, sql`ran_here.queued_at is not null and ran_here.started_at is not null`)} as queued,
      ${spreadOver(runningMs, sql`ran_here.started_at is not null`)} as running
    from ran_here
    group by ran_here.is_current, ran_here.station_id
  `);

  return result.rows;
};

const inboxIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly InboxRow[]> => {
  const { current, previous } = team.period;
  const answerMs = msOf(sql`waits.answered_at - waits.asked_at`);
  const result = await db.execute<InboxRow>(sql`
    select
      waits.asked_at >= ${asUtc(current.from)} as is_current,
      waits.station_id,
      count(*)::int as asks,
      count(*) filter (where waits.answered_at is null)::int as unanswered,
      ${spreadOver(answerMs, sql`waits.answered_at is not null`)} as inbox
    from ${inboxWaits(team, previous.from, current.to)}
    group by 1, 2
  `);

  return result.rows;
};

const deliveriesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly DeliveryMoments[]> => {
  const { current, previous } = team.period;
  const between = (column: SQL): SQL =>
    sql`${column} >= ${iso(previous.from)}::timestamp and ${column} < ${iso(current.to)}::timestamp`;
  const result = await db.execute<DeliveryRow>(sql`
    select
      ${taskPullRequest.taskId} as task_id,
      ${msOf(sql`${taskPullRequest.openedAt}`)} as opened_ms,
      ${msOf(sql`${taskPullRequest.firstReviewAt}`)} as first_review_ms,
      ${msOf(sql`${taskPullRequest.closedAt}`)} as closed_ms,
      ${taskPullRequest.state} = 'merged' as merged,
      ${msOf(sql`${taskHumanAction.openedAt}`)} as task_opened_ms
    from ${taskPullRequest}
    left join ${taskHumanAction} on ${taskHumanAction.taskId} = ${taskPullRequest.taskId}
    where ${ofTeamTaskPullRequests(team)}
      and (
        ${between(sql`${taskPullRequest.openedAt}`)}
        or ${between(sql`${taskPullRequest.firstReviewAt}`)}
        or (${taskPullRequest.state} = 'merged' and ${between(sql`${taskPullRequest.closedAt}`)})
      )
    order by ${taskPullRequest.openedAt} desc, ${taskPullRequest.taskId} desc
  `);

  return result.rows.map((row) => ({
    taskId: row.task_id,
    openedAt: new Date(row.opened_ms),
    firstReviewAt: dateOf(row.first_review_ms),
    closedAt: dateOf(row.closed_ms),
    merged: row.merged,
    taskOpenedAt: dateOf(row.task_opened_ms),
  }));
};

const windowOf = (
  current: boolean,
  stations: readonly StationRow[],
  runs: readonly RunsRow[],
  inbox: readonly InboxRow[],
): FlowWindowCounts => ({
  stations: stations
    .filter((each) => each.part === current)
    .map((station): StationRunCounts => {
      const here = runs.find(
        (each) =>
          each.is_current === current && each.station_id === station.station_id,
      );

      return {
        lineId: station.line_id,
        stationId: station.station_id,
        taskIds: here?.task_ids ?? [],
        runs: here?.runs ?? 0,
        queued: here?.queued ?? NO_SPREAD,
        running: here?.running ?? NO_SPREAD,
      };
    }),
  inbox: inbox
    .filter((each) => each.is_current === current)
    .map(
      (each): StationInboxCounts => ({
        stationId: each.station_id,
        asks: each.asks,
        unanswered: each.unanswered,
        inbox: each.inbox,
      }),
    ),
});

export const flowCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<FlowCounts> => {
  const stations = await stationsIn(db, team);
  const runs = await runsIn(db, team);
  const inbox = await inboxIn(db, team);
  const deliveries = await deliveriesIn(db, team);

  return {
    current: windowOf(true, stations, runs, inbox),
    previous: windowOf(false, stations, runs, inbox),
    deliveries,
  };
};
