import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import { inboxWaits } from '@insights/infrastructure/persistence/drizzle/readers/insights/inbox.sql';
import {
  endedIn,
  iso,
  msOf,
  onTeam,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { ofTeamTaskActions } from '@insights/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  runFact,
  taskAction,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { type SQL, sql } from 'drizzle-orm';

export const openedFor = (team: TeamInPeriod, taskIds: SQL): SQL => sql`
  select ${taskAction.taskId} as task_id, ${taskAction.openedAt} as opened_at
  from ${taskAction}
  where ${ofTeamTaskActions(team)}
    and ${taskAction.taskId} in (${taskIds})
    and ${taskAction.openedAt} >= ${iso(team.period.lookback.from)}::timestamptz`;

export const ranOfOpened = (team: TeamInPeriod): SQL => sql`
  select ${runFact}.*
  from ${runFact}
  where ${onTeam(team)}
    and ${endedIn(team.period.lookback.from, team.period.lookback.to)}
    and ${runFact.taskId} in (select opened.task_id from opened)`;

export const stationTimeOfOpened = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;
  const queuedMs = sql`facts.queued_ms::float8`;
  const runningMs = sql`facts.running_ms::float8`;
  const answerMs = msOf(sql`waits.acted_at - waits.asked_at`);

  return sql`
    with ran as (
      select
        facts.task_id,
        facts.station_id,
        coalesce(sum(${queuedMs}), 0) as queued,
        coalesce(sum(${runningMs}), 0) as running
      from (${ranOfOpened(team)}) as facts
      group by facts.task_id, facts.station_id
    ),
    answered as materialized (
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
      and answered.station_id = ran.station_id`;
};
