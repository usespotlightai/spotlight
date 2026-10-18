import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import { atWithin } from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { ofTeamHumanActions } from '@insights/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import { taskHumanAction } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { type SQL, sql } from 'drizzle-orm';

export const inboxWaits = (team: TeamInPeriod, from: Date, to: Date): SQL => {
  const askedAt = sql`(ask.value->>'at')::timestamptz`;

  return sql`(
    select
      asks.task_id,
      asks.last_action_at,
      asks.station_id,
      asks.asked_at,
      (
        select min((act.value->>'at')::timestamptz)
        from jsonb_array_elements(asks.actions) as act(value)
        where (act.value->>'at')::timestamptz >= asks.asked_at
          and (asks.next_at is null or (act.value->>'at')::timestamptz < asks.next_at)
      ) as answered_at
    from (
      select
        ${taskHumanAction.taskId} as task_id,
        ${taskHumanAction.lastActionAt} as last_action_at,
        ask.value->>'stationId' as station_id,
        ${askedAt} as asked_at,
        lead(${askedAt}) over (
          partition by ${taskHumanAction.taskId}
          order by ${askedAt}, ask.position
        ) as next_at,
        ${taskHumanAction.actions} as actions
      from ${taskHumanAction}
      cross join lateral jsonb_array_elements(${taskHumanAction.asks})
        with ordinality as ask(value, position)
      where ${ofTeamHumanActions(team)}
    ) as asks
    where ${atWithin(sql`asks.asked_at`, { from, to })}
  ) as waits`;
};
