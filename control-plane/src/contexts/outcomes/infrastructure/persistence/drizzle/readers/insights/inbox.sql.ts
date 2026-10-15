import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import { atWithin } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { ofTeamTouches } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import { taskTouches } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { type SQL, sql } from 'drizzle-orm';

export const inboxWaits = (team: TeamInPeriod, from: Date, to: Date): SQL => {
  const askedAt = sql`(ask.value->>'at')::timestamptz`;

  return sql`(
    select
      asks.task_id,
      asks.touched_at,
      asks.station_id,
      asks.asked_at,
      (
        select min((act.value->>'at')::timestamptz)
        from jsonb_array_elements(asks.acts) as act(value)
        where (act.value->>'at')::timestamptz >= asks.asked_at
          and (asks.next_at is null or (act.value->>'at')::timestamptz < asks.next_at)
      ) as answered_at
    from (
      select
        ${taskTouches.taskId} as task_id,
        ${taskTouches.touchedAt} as touched_at,
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
    ) as asks
    where ${atWithin(sql`asks.asked_at`, { from, to })}
  ) as waits`;
};
