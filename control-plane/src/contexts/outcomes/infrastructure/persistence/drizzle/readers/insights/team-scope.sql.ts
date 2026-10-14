import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import {
  endedIn,
  iso,
  onTeam,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  chatRecord,
  runFact,
  taskDelivery,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { type SQL, sql } from 'drizzle-orm';

const endedInLookback = (team: TeamInPeriod): SQL =>
  sql`select ${runFact.taskId} from ${runFact} where ${onTeam(team)} and ${endedIn(team.period.lookback.from, team.period.lookback.to)}`;

export const ofTeamTouches = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`${taskTouches.workspaceId} = ${team.workspaceId.value}
    and (
      (
        ${taskTouches.teamId} = ${team.teamId.value}
        and ${taskTouches.touchedAt} >= ${iso(lookback.from)}::timestamp
        and ${taskTouches.openedAt} < ${iso(lookback.to)}::timestamp
      )
      or ${taskTouches.taskId} in (${endedInLookback(team)})
    )`;
};

export const ofTeamDeliveries = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`${taskDelivery.workspaceId} = ${team.workspaceId.value}
    and (
      (
        ${taskDelivery.teamId} = ${team.teamId.value}
        and ${taskDelivery.openedAt} < ${iso(lookback.to)}::timestamp
        and (
          (
            ${taskDelivery.closedAt} is null
            and ${taskDelivery.openedAt} >= ${iso(lookback.from)}::timestamp
          )
          or ${taskDelivery.closedAt} >= ${iso(lookback.from)}::timestamp
        )
      )
      or ${taskDelivery.taskId} in (${endedInLookback(team)})
    )`;
};

export const teamActivity = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`(
    with touched as (
      select ${taskTouches.openedBy} as opened_by, ${taskTouches.openedAt} as opened_at, ${taskTouches.acts} as acts
      from ${taskTouches}
      where ${ofTeamTouches(team)}
    )
    select touched.opened_by as person, 'opened' as kind, touched.opened_at at time zone 'UTC' as at
    from touched
    where touched.opened_by is not null and touched.opened_at is not null
    union all
    select act.value->>'by', 'acted', (act.value->>'at')::timestamptz
    from touched
    cross join lateral jsonb_array_elements(touched.acts) as act(value)
    union all
    select ${chatRecord.startedBy}, 'chatted', ${chatRecord.startedAt} at time zone 'UTC'
    from ${chatRecord}
    where ${chatRecord.workspaceId} = ${team.workspaceId.value}
      and ${chatRecord.teamId} = ${team.teamId.value}
      and ${chatRecord.startedAt} >= ${iso(lookback.from)}::timestamp
      and ${chatRecord.startedAt} < ${iso(lookback.to)}::timestamp
  ) as activity`;
};
