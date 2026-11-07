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
  taskPullRequestFact,
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
        and ${taskHumanAction.lastActionAt} >= ${iso(lookback.from)}::timestamptz
        and ${taskHumanAction.openedAt} < ${iso(lookback.to)}::timestamptz
      )
      or ${taskHumanAction.taskId} in (${endedInLookback(team)})
    )`;
};

export const ofTeamTaskPullRequests = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`${taskPullRequestFact.workspaceId} = ${team.workspaceId.value}
    and (
      (
        ${taskPullRequestFact.teamId} = ${team.teamId.value}
        and ${taskPullRequestFact.openedAt} < ${iso(lookback.to)}::timestamptz
        and (
          (
            ${taskPullRequestFact.closedAt} is null
            and (
              ${taskPullRequestFact.openedAt} >= ${iso(lookback.from)}::timestamptz
              or ${taskPullRequestFact.firstReviewAt} >= ${iso(lookback.from)}::timestamptz
            )
          )
          or ${taskPullRequestFact.closedAt} >= ${iso(lookback.from)}::timestamptz
        )
      )
      or ${taskPullRequestFact.taskId} in (${endedInLookback(team)})
    )`;
};

export const teamActivity = (team: TeamInPeriod): SQL => {
  const { lookback } = team.period;

  return sql`(
    with acted as (
      select ${taskHumanAction.openedById} as opened_by, ${taskHumanAction.openedAt} as opened_at, ${taskHumanAction.actions} as actions
      from ${taskHumanAction}
      where ${ofTeamHumanActions(team)}
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
