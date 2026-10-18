import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import {
  endedIn,
  iso,
  onTeam,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  chatRecord,
  runFact,
  taskHumanAction,
  taskPullRequest,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { type SQL, sql } from 'drizzle-orm';

const endedInLookback = (team: TeamInPeriod): SQL =>
  sql`select ${runFact.taskId} from ${runFact} where ${onTeam(team)} and ${endedIn(team.period.lookback.from, team.period.lookback.to)}`;

export const ofTeamHumanActions = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`${taskHumanAction.workspaceId} = ${team.workspaceId.value}
    and (
      (
        ${taskHumanAction.teamId} = ${team.teamId.value}
        and ${taskHumanAction.lastActionAt} >= ${iso(lookback.from)}::timestamp
        and ${taskHumanAction.openedAt} < ${iso(lookback.to)}::timestamp
      )
      or ${taskHumanAction.taskId} in (${endedInLookback(team)})
    )`;
};

export const ofTeamTaskPullRequests = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`${taskPullRequest.workspaceId} = ${team.workspaceId.value}
    and (
      (
        ${taskPullRequest.teamId} = ${team.teamId.value}
        and ${taskPullRequest.openedAt} < ${iso(lookback.to)}::timestamp
        and (
          (
            ${taskPullRequest.closedAt} is null
            and (
              ${taskPullRequest.openedAt} >= ${iso(lookback.from)}::timestamp
              or ${taskPullRequest.firstReviewAt} >= ${iso(lookback.from)}::timestamp
            )
          )
          or ${taskPullRequest.closedAt} >= ${iso(lookback.from)}::timestamp
        )
      )
      or ${taskPullRequest.taskId} in (${endedInLookback(team)})
    )`;
};

export const teamActivity = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`(
    with acted as (
      select ${taskHumanAction.openedBy} as opened_by, ${taskHumanAction.openedAt} as opened_at, ${taskHumanAction.actions} as actions
      from ${taskHumanAction}
      where ${ofTeamHumanActions(team)}
    )
    select acted.opened_by as person, 'opened' as kind, acted.opened_at at time zone 'UTC' as at
    from acted
    where acted.opened_by is not null and acted.opened_at is not null
    union all
    select act.value->>'by', 'acted', (act.value->>'at')::timestamptz
    from acted
    cross join lateral jsonb_array_elements(acted.actions) as act(value)
    union all
    select ${chatRecord.startedBy}, 'chatted', ${chatRecord.startedAt} at time zone 'UTC'
    from ${chatRecord}
    where ${chatRecord.workspaceId} = ${team.workspaceId.value}
      and ${chatRecord.teamId} = ${team.teamId.value}
      and ${chatRecord.startedAt} >= ${iso(lookback.from)}::timestamp
      and ${chatRecord.startedAt} < ${iso(lookback.to)}::timestamp
  ) as activity`;
};
