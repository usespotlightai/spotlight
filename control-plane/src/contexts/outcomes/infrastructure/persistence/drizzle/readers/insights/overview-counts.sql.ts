import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type {
  ConfigMarker,
  DaySpending,
} from '@outcomes/domain/services/daily-output';
import type {
  HeadlineCounts,
  ResolvedDelivery,
} from '@outcomes/domain/services/headline';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { TallyCounts } from '@outcomes/domain/services/run-tally';
import {
  asUtc,
  dateOf,
  factsInPeriod,
  isCurrent,
  iso,
  msOf,
  onTeam,
  ran,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  failingIn,
  stationCountsIn,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/station-counts.sql';
import {
  ofTeamDeliveries,
  ofTeamTouches,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  chatRecord,
  runFact,
  taskDelivery,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

interface TasksRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly tasks: number;
}

interface TouchesRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly touches: number;
}

interface PersonRow extends Record<string, unknown> {
  readonly person: string;
  readonly is_current: boolean;
}

interface ResolvedRow extends Record<string, unknown> {
  readonly task_id: string;
  readonly merged: boolean;
  readonly closed_ms: number;
  readonly task_opened_ms: number | null;
}

interface MarkerRow extends Record<string, unknown> {
  readonly line_id: string;
  readonly station_id: string;
  readonly fingerprint: string;
  readonly previous_fingerprint: string;
  readonly began_ms: number;
  readonly run_id: string;
}

const tasksIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly TasksRow[]> => {
  const result = await db.execute<TasksRow>(sql`
    select
      ${isCurrent} as is_current,
      count(distinct ${runFact.taskId})::int as tasks
    from ${factsInPeriod(team)}
    where ${ran}
    group by ${isCurrent}
  `);

  return result.rows;
};

const touchesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly TouchesRow[]> => {
  const { current, previous } = team.period;
  const at = sql`(act.value->>'at')::timestamptz`;
  const result = await db.execute<TouchesRow>(sql`
    with worked as (
      select distinct ${runFact.taskId} as task_id, ${isCurrent} as is_current
      from ${factsInPeriod(team)}
      where ${ran}
    )
    select worked.is_current, count(*)::int as touches
    from worked
    join ${taskTouches}
      on ${taskTouches.taskId} = worked.task_id
      and ${taskTouches.workspaceId} = ${team.workspaceId.value}
    cross join lateral jsonb_array_elements(${taskTouches.acts}) as act(value)
    where ${at} >= case when worked.is_current then ${asUtc(current.from)} else ${asUtc(previous.from)} end
      and ${at} < case when worked.is_current then ${asUtc(current.to)} else ${asUtc(previous.to)} end
    group by worked.is_current
  `);

  return result.rows;
};

const peopleIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly PersonRow[]> => {
  const { current, previous, lookback } = team.period;
  const result = await db.execute<PersonRow>(sql`
    with touched as (
      select ${taskTouches.openedBy} as opened_by, ${taskTouches.openedAt} as opened_at, ${taskTouches.acts} as acts
      from ${taskTouches}
      where ${ofTeamTouches(team)}
    ), activity as (
      select opened_by as person, opened_at at time zone 'UTC' as at
      from touched
      where opened_by is not null and opened_at is not null
      union all
      select act.value->>'by', (act.value->>'at')::timestamptz
      from touched
      cross join lateral jsonb_array_elements(touched.acts) as act(value)
      union all
      select ${chatRecord.startedBy}, ${chatRecord.startedAt} at time zone 'UTC'
      from ${chatRecord}
      where ${chatRecord.workspaceId} = ${team.workspaceId.value}
        and ${chatRecord.teamId} = ${team.teamId.value}
        and ${chatRecord.startedAt} >= ${iso(lookback.from)}::timestamp
        and ${chatRecord.startedAt} < ${iso(lookback.to)}::timestamp
    )
    select distinct person, at >= ${asUtc(current.from)} as is_current
    from activity
    where at >= ${asUtc(previous.from)} and at < ${asUtc(current.to)}
  `);

  return result.rows;
};

const resolvedIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly ResolvedDelivery[]> => {
  const { current, previous } = team.period;
  const result = await db.execute<ResolvedRow>(sql`
    select
      ${taskDelivery.taskId} as task_id,
      ${taskDelivery.state} = 'merged' as merged,
      ${msOf(sql`${taskDelivery.closedAt}`)} as closed_ms,
      ${msOf(sql`${taskTouches.openedAt}`)} as task_opened_ms
    from ${taskDelivery}
    left join ${taskTouches} on ${taskTouches.taskId} = ${taskDelivery.taskId}
    where ${ofTeamDeliveries(team)}
      and ${taskDelivery.state} <> 'open'
      and ${taskDelivery.closedAt} >= ${iso(previous.from)}::timestamp
      and ${taskDelivery.closedAt} < ${iso(current.to)}::timestamp
    order by ${taskDelivery.openedAt} desc, ${taskDelivery.taskId} desc
  `);

  return result.rows.map((row) => ({
    taskId: row.task_id,
    merged: row.merged,
    closedAt: new Date(row.closed_ms),
    taskOpenedAt: dateOf(row.task_opened_ms),
  }));
};

const markersIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly ConfigMarker[]> => {
  const { current } = team.period;
  const earlier = alias(runFact, 'earlier');
  const configRun = (of: typeof runFact | typeof earlier): SQL =>
    sql`${of.ran} and ${of.startedAt} is not null and ${of.fingerprint} is not null`;
  const result = await db.execute<MarkerRow>(sql`
    select
      ${runFact.lineId} as line_id,
      ${runFact.stationId} as station_id,
      ${runFact.fingerprint} as fingerprint,
      previous.fingerprint as previous_fingerprint,
      ${msOf(sql`${runFact.beganAt}`)} as began_ms,
      ${runFact.runId} as run_id
    from ${runFact}
    cross join lateral (
      select ${earlier.fingerprint} as fingerprint
      from ${runFact} as ${earlier}
      where ${earlier.workspaceId} = ${runFact.workspaceId}
        and ${earlier.teamId} = ${runFact.teamId}
        and ${earlier.stationId} = ${runFact.stationId}
        and ${configRun(earlier)}
        and (
          ${earlier.beganAt} < ${runFact.beganAt}
          or (
            ${earlier.beganAt} = ${runFact.beganAt}
            and ${earlier.runId} collate "C" < ${runFact.runId} collate "C"
          )
        )
      order by ${earlier.beganAt} desc, ${earlier.runId} collate "C" desc
      limit 1
    ) as previous
    where ${onTeam(team)}
      and ${configRun(runFact)}
      and ${runFact.beganAt} >= ${iso(current.from)}::timestamp
      and ${runFact.beganAt} < ${iso(current.to)}::timestamp
      and previous.fingerprint <> ${runFact.fingerprint}
    order by ${runFact.beganAt}, ${runFact.runId} collate "C"
  `);

  return result.rows.map((row) => ({
    lineId: row.line_id,
    stationId: row.station_id,
    fingerprint: row.fingerprint,
    previousFingerprint: row.previous_fingerprint,
    firstRunAt: new Date(row.began_ms),
    runId: row.run_id,
  }));
};

const headlineCountsFrom = (
  tally: TallyCounts,
  tasks: TasksRow | undefined,
  touches: TouchesRow | undefined,
  people: readonly string[],
): HeadlineCounts => ({
  runs: tally.runs,
  tasks: tasks?.tasks ?? 0,
  spend: tally.cost,
  unpriced: tally.unpriced,
  mixedCurrencies: tally.mixedCurrencies,
  touches: touches?.touches ?? 0,
  people: [...people].sort(),
});

export const overviewCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<OverviewCounts> => {
  const stations = await stationCountsIn(db, team);
  const tasks = await tasksIn(db, team);
  const touches = await touchesIn(db, team);
  const people = await peopleIn(db, team);
  const resolved = await resolvedIn(db, team);
  const markers = await markersIn(db, team);
  const failingBefore = await failingIn(db, team, team.period.previous);
  const headlineOf = (current: boolean, tally: TallyCounts) =>
    headlineCountsFrom(
      tally,
      tasks.find((each) => each.is_current === current),
      touches.find((each) => each.is_current === current),
      people
        .filter((each) => each.is_current === current)
        .map((each) => each.person),
    );

  return {
    current: headlineOf(true, stations.team.current),
    previous: headlineOf(false, stations.team.previous),
    resolved,
    spending: new Map(
      [...stations.team.byDay].flatMap(
        ([day, tally]): [string, DaySpending][] =>
          tally.runs > 0
            ? [
                [
                  day,
                  {
                    runs: tally.runs,
                    spend: tally.cost,
                    unpriced: tally.unpriced,
                    mixedCurrencies: tally.mixedCurrencies,
                  },
                ],
              ]
            : [],
      ),
    ),
    markers,
    stations,
    failingBefore,
  };
};
