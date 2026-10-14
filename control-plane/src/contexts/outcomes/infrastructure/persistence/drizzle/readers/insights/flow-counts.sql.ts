import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type {
  DeliveryMoments,
  FlowCounts,
  FlowWindowCounts,
  StationInboxCounts,
  StationRunCounts,
} from '@outcomes/domain/services/flow';
import type { Spread } from '@outcomes/domain/services/measures';
import {
  asUtc,
  dateOf,
  factsInPeriod,
  inEndOrder,
  isCurrent,
  iso,
  medianOver,
  msOf,
  p90Over,
  ran,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  ofTeamDeliveries,
  ofTeamTouches,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  runFact,
  taskDelivery,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface StationRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly station_id: string;
  readonly line_id: string;
}

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

const spreadOver = (ms: SQL, when: SQL): SQL => sql`json_build_object(
  'p50', ${medianOver(ms, when)},
  'p90', ${p90Over(ms, when)},
  'count', count(${ms}) filter (where ${when})
)`;

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly StationRow[]> => {
  const result = await db.execute<StationRow>(sql`
    select is_current, station_id, line_id from (
      select distinct on (${isCurrent}, ${runFact.stationId})
        ${isCurrent} as is_current,
        ${runFact.stationId} as station_id,
        ${runFact.lineId} as line_id,
        ${runFact.endedAt} as ended_at,
        ${runFact.runId} as run_id
      from ${factsInPeriod(team)}
      order by ${isCurrent}, ${runFact.stationId}, ${inEndOrder}
    ) as first
    order by is_current, ended_at, run_id collate "C"
  `);

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
  const askedAt = sql`(ask.value->>'at')::timestamptz`;
  const answerMs = msOf(sql`waits.answered_at - waits.asked_at`);
  const result = await db.execute<InboxRow>(sql`
    with asks as (
      select
        ask.value->>'stationId' as station_id,
        ${askedAt} as asked_at,
        lead(${askedAt}) over (
          partition by ${taskTouches.taskId}
          order by ${askedAt}, ask.position
        ) as next_at,
        ${taskTouches.acts} as acts
      from ${taskTouches}
      cross join lateral jsonb_array_elements(${taskTouches.asks})
        with ordinality as ask(value, position)
      where ${ofTeamTouches(team)}
    ), waits as (
      select
        asks.station_id,
        asks.asked_at,
        (
          select min((act.value->>'at')::timestamptz)
          from jsonb_array_elements(asks.acts) as act(value)
          where (act.value->>'at')::timestamptz >= asks.asked_at
            and (asks.next_at is null or (act.value->>'at')::timestamptz < asks.next_at)
        ) as answered_at
      from asks
      where asks.asked_at >= ${asUtc(previous.from)}
        and asks.asked_at < ${asUtc(current.to)}
    )
    select
      waits.asked_at >= ${asUtc(current.from)} as is_current,
      waits.station_id,
      count(*)::int as asks,
      count(*) filter (where waits.answered_at is null)::int as unanswered,
      ${spreadOver(answerMs, sql`waits.answered_at is not null`)} as inbox
    from waits
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
      ${taskDelivery.taskId} as task_id,
      ${msOf(sql`${taskDelivery.openedAt}`)} as opened_ms,
      ${msOf(sql`${taskDelivery.firstReviewAt}`)} as first_review_ms,
      ${msOf(sql`${taskDelivery.closedAt}`)} as closed_ms,
      ${taskDelivery.state} = 'merged' as merged,
      ${msOf(sql`${taskTouches.openedAt}`)} as task_opened_ms
    from ${taskDelivery}
    left join ${taskTouches} on ${taskTouches.taskId} = ${taskDelivery.taskId}
    where ${ofTeamDeliveries(team)}
      and (
        ${between(sql`${taskDelivery.openedAt}`)}
        or ${between(sql`${taskDelivery.firstReviewAt}`)}
        or (${taskDelivery.state} = 'merged' and ${between(sql`${taskDelivery.closedAt}`)})
      )
    order by ${taskDelivery.openedAt} desc, ${taskDelivery.taskId} desc
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

const NO_SPREAD: Spread = { p50: null, p90: null, count: 0 };

const windowOf = (
  current: boolean,
  stations: readonly StationRow[],
  runs: readonly RunsRow[],
  inbox: readonly InboxRow[],
): FlowWindowCounts => ({
  stations: stations
    .filter((each) => each.is_current === current)
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
