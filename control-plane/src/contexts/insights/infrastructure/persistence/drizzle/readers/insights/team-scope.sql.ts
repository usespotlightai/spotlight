import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import {
  endedIn,
  iso,
  onTeam,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  chatRecord,
  pullRequestRecord,
  runFact,
  taskAction,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { type SQL, sql } from 'drizzle-orm';

const endedInLookback = (team: TeamInPeriod): SQL =>
  sql`select ${runFact.taskId} from ${runFact} where ${onTeam(team)} and ${endedIn(team.period.lookback.from, team.period.lookback.to)}`;

export const ofTeamTaskPullRequests = (team: TeamInPeriod): SQL =>
  sql`(
    ${pullRequestRecord.ownerTeamId} = ${team.teamId.value}
    or ${pullRequestRecord.ownerTaskId} in (${endedInLookback(team)})
  )`;

export const ofTeamTaskActions = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`${taskAction.workspaceId} = ${team.workspaceId.value}
    and (
      (
        ${taskAction.teamId} = ${team.teamId.value}
        and ${taskAction.lastActionAt} >= ${iso(lookback.from)}::timestamptz
        and ${taskAction.openedAt} < ${iso(lookback.to)}::timestamptz
      )
      or ${taskAction.taskId} in (${endedInLookback(team)})
    )`;
};

export const teamActivity = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`(
    with acted as (
      select ${taskAction.openedById} as opened_by, ${taskAction.openedAt} as opened_at, ${taskAction.actions} as actions
      from ${taskAction}
      where ${ofTeamTaskActions(team)}
    )
    select acted.opened_by as person, 'opened' as kind, acted.opened_at as at
    from acted
    where acted.opened_by is not null and acted.opened_at is not null
    union all
    select act.value->>'by', 'acted', (act.value->>'at')::timestamptz
    from acted
    cross join lateral jsonb_array_elements(acted.actions) as act(value)
    union all
    select ${chatRecord.startedById}, 'chatted', ${chatRecord.startedAt}
    from ${chatRecord}
    where ${chatRecord.workspaceId} = ${team.workspaceId.value}
      and ${chatRecord.teamId} = ${team.teamId.value}
      and ${chatRecord.startedAt} >= ${iso(lookback.from)}::timestamptz
      and ${chatRecord.startedAt} < ${iso(lookback.to)}::timestamptz
  ) as activity`;
};
