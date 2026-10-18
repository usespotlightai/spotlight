import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import type {
  ConfigMarker,
  DaySpending,
} from '@insights/domain/services/daily-output';
import type {
  HeadlineCounts,
  ResolvedDelivery,
} from '@insights/domain/services/headline';
import type { OverviewCounts } from '@insights/domain/services/overview-counts';
import type { TallyCounts } from '@insights/domain/services/run-tally';
import { configMarkers } from '@insights/infrastructure/persistence/drizzle/readers/insights/config-markers.sql';
import {
  asUtc,
  atWithin,
  dateOf,
  factsInPeriod,
  isCurrent,
  iso,
  msOf,
  ran,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  failingIn,
  stationCountsIn,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/station-counts.sql';
import {
  ofTeamTaskPullRequests,
  teamActivity,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  runFact,
  taskHumanAction,
  taskPullRequest,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { sql } from 'drizzle-orm';

interface TasksRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly tasks: number;
}

interface HumanActionsRow extends Record<string, unknown> {
  readonly is_current: boolean;
  readonly human_actions: number;
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

const humanActionsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly HumanActionsRow[]> => {
  const { current, previous } = team.period;
  const at = sql`(act.value->>'at')::timestamptz`;
  const result = await db.execute<HumanActionsRow>(sql`
    with worked as (
      select distinct ${runFact.taskId} as task_id, ${isCurrent} as is_current
      from ${factsInPeriod(team)}
      where ${ran}
    )
    select worked.is_current, count(*)::int as human_actions
    from worked
    join ${taskHumanAction}
      on ${taskHumanAction.taskId} = worked.task_id
      and ${taskHumanAction.workspaceId} = ${team.workspaceId.value}
    cross join lateral jsonb_array_elements(${taskHumanAction.actions}) as act(value)
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
  const { current, previous } = team.period;
  const result = await db.execute<PersonRow>(sql`
    select distinct activity.person, activity.at >= ${asUtc(current.from)} as is_current
    from ${teamActivity(team)}
    where ${atWithin(sql`activity.at`, { from: previous.from, to: current.to })}
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
      ${taskPullRequest.taskId} as task_id,
      ${taskPullRequest.state} = 'merged' as merged,
      ${msOf(sql`${taskPullRequest.closedAt}`)} as closed_ms,
      ${msOf(sql`${taskHumanAction.openedAt}`)} as task_opened_ms
    from ${taskPullRequest}
    left join ${taskHumanAction} on ${taskHumanAction.taskId} = ${taskPullRequest.taskId}
    where ${ofTeamTaskPullRequests(team)}
      and ${taskPullRequest.state} <> 'open'
      and ${taskPullRequest.closedAt} >= ${iso(previous.from)}::timestamp
      and ${taskPullRequest.closedAt} < ${iso(current.to)}::timestamp
    order by ${taskPullRequest.openedAt} desc, ${taskPullRequest.taskId} desc
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
  const result = await db.execute<MarkerRow>(sql`
    select
      markers.line_id,
      markers.station_id,
      markers.fingerprint,
      markers.previous_fingerprint,
      ${msOf(sql`markers.began_at`)} as began_ms,
      markers.run_id
    from (${configMarkers(team, team.period.current)}) as markers
    order by markers.began_at, markers.run_id collate "C"
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
  humanActions: HumanActionsRow | undefined,
  people: readonly string[],
): HeadlineCounts => ({
  runs: tally.runs,
  tasks: tasks?.tasks ?? 0,
  spend: tally.cost,
  unpriced: tally.unpriced,
  mixedCurrencies: tally.mixedCurrencies,
  humanActions: humanActions?.human_actions ?? 0,
  people: [...people].sort(),
});

export const overviewCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<OverviewCounts> => {
  const stations = await stationCountsIn(db, team);
  const tasks = await tasksIn(db, team);
  const humanActions = await humanActionsIn(db, team);
  const people = await peopleIn(db, team);
  const resolved = await resolvedIn(db, team);
  const markers = await markersIn(db, team);
  const failingBefore = await failingIn(db, team, team.period.previous);
  const headlineOf = (current: boolean, tally: TallyCounts) =>
    headlineCountsFrom(
      tally,
      tasks.find((each) => each.is_current === current),
      humanActions.find((each) => each.is_current === current),
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
