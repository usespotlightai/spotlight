import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type { PipelineCounts } from '@outcomes/domain/services/shipping';
import { inboxWaits } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/inbox.sql';
import {
  endedIn,
  iso,
  msOf,
  onTeam,
  type StationRow,
  stationsInEndOrder,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { ofTeamTouches } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  runFact,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface OpeningRow extends Record<string, unknown> {
  readonly task_id: string;
  readonly opened_ms: number;
}

interface PassageRow extends Record<string, unknown> {
  readonly task_id: string;
  readonly station_id: string;
  readonly queued: number;
  readonly running: number;
  readonly inbox: number;
}

const openedIn = (team: TeamInPeriod, taskIds: readonly string[]): SQL => sql`
  select ${taskTouches.taskId} as task_id, ${taskTouches.openedAt} as opened_at
  from ${taskTouches}
  where ${ofTeamTouches(team)}
    and ${taskTouches.taskId} in (
      select jsonb_array_elements_text(${JSON.stringify(taskIds)}::jsonb)
    )
    and ${taskTouches.openedAt} >= ${iso(team.period.lookback.from)}::timestamp`;

const ranIn = (team: TeamInPeriod): SQL => sql`
  select ${runFact}.*
  from ${runFact}
  where ${onTeam(team)}
    and ${endedIn(team.period.lookback.from, team.period.lookback.to)}
    and ${runFact.taskId} in (select opened.task_id from opened)`;

const openingsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  taskIds: readonly string[],
): Promise<readonly OpeningRow[]> => {
  const result = await db.execute<OpeningRow>(sql`
    with opened as (${openedIn(team, taskIds)})
    select opened.task_id, ${msOf(sql`opened.opened_at`)} as opened_ms
    from opened
    order by opened.task_id collate "C"
  `);

  return result.rows;
};

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  taskIds: readonly string[],
): Promise<readonly StationRow[]> => {
  const result = await db.execute<StationRow>(sql`
    with opened as (${openedIn(team, taskIds)})
    ${stationsInEndOrder(ranIn(team))}
  `);

  return result.rows;
};

const passagesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  taskIds: readonly string[],
): Promise<readonly PassageRow[]> => {
  const { lookback } = team.period;
  const queuedMs = msOf(sql`facts.started_at - facts.queued_at`);
  const runningMs = msOf(sql`facts.ended_at - facts.started_at`);
  const answerMs = msOf(sql`waits.answered_at - waits.asked_at`);
  const result = await db.execute<PassageRow>(sql`
    with opened as (${openedIn(team, taskIds)}),
    ran as (
      select
        facts.task_id,
        facts.station_id,
        coalesce(sum(${queuedMs}), 0) as queued,
        coalesce(sum(${runningMs}), 0) as running
      from (${ranIn(team)}) as facts
      group by facts.task_id, facts.station_id
    ),
    answered as (
      select waits.task_id, waits.station_id, sum(${answerMs}) as inbox
      from ${inboxWaits(team, lookback.from, lookback.to)}
      where waits.task_id in (select opened.task_id from opened)
      group by waits.task_id, waits.station_id
    )
    select
      ran.task_id,
      ran.station_id,
      ran.queued::float8 as queued,
      ran.running::float8 as running,
      coalesce(answered.inbox, 0)::float8 as inbox
    from ran
    left join answered
      on answered.task_id = ran.task_id
      and answered.station_id = ran.station_id
    order by ran.task_id collate "C", ran.station_id collate "C"
  `);

  return result.rows;
};

export const pipelineCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  taskIds: readonly string[],
): Promise<PipelineCounts> => {
  if (taskIds.length === 0) {
    return { openings: [], stations: [], passages: [] };
  }

  const openings = await openingsIn(db, team, taskIds);
  const stations = await stationsIn(db, team, taskIds);
  const passages = await passagesIn(db, team, taskIds);

  return {
    openings: openings.map((row) => ({
      taskId: row.task_id,
      openedAt: new Date(row.opened_ms),
    })),
    stations: stations.map((row) => ({
      lineId: row.line_id,
      stationId: row.station_id,
    })),
    passages: passages.map((row) => ({
      taskId: row.task_id,
      stationId: row.station_id,
      queued: row.queued,
      running: row.running,
      inbox: row.inbox,
    })),
  };
};
