import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import type { PullRequestDelivery } from '@insights/domain/services/pull-request-delivery';
import {
  dateOf,
  iso,
  msOf,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { ofTeamTaskPullRequests } from '@insights/infrastructure/persistence/drizzle/readers/insights/team-scope.sql';
import {
  pullRequestRecord,
  taskHumanAction,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface DeliveryRow extends Record<string, unknown> {
  readonly task_id: string;
  readonly pull_request: string;
  readonly opened_ms: number;
  readonly first_review_ms: number | null;
  readonly closed_ms: number | null;
  readonly merged: boolean;
  readonly task_opened_ms: number | null;
}

export const pullRequestDeliveriesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly PullRequestDelivery[]> => {
  const { current, previous } = team.period;
  const between = (column: SQL): SQL =>
    sql`${column} >= ${iso(previous.from)}::timestamptz and ${column} < ${iso(current.to)}::timestamptz`;
  const result = await db.execute<DeliveryRow>(sql`
    select
      ${pullRequestRecord.ownerTaskId} as task_id,
      ${pullRequestRecord.pullRequest} as pull_request,
      ${msOf(sql`${pullRequestRecord.ownerOpenedAt}`)} as opened_ms,
      ${msOf(sql`${pullRequestRecord.firstReviewAt}`)} as first_review_ms,
      ${msOf(sql`${pullRequestRecord.closedAt}`)} as closed_ms,
      coalesce(${pullRequestRecord.state} = 'merged', false) as merged,
      ${msOf(sql`${taskHumanAction.openedAt}`)} as task_opened_ms
    from ${pullRequestRecord}
    left join ${taskHumanAction} on ${taskHumanAction.taskId} = ${pullRequestRecord.ownerTaskId}
    where ${pullRequestRecord.workspaceId} = ${team.workspaceId.value}
      and ${pullRequestRecord.ownerTaskId} is not null
      and ${pullRequestRecord.ownerOpenedAt} is not null
      and ${ofTeamTaskPullRequests(team)}
      and (
        ${between(sql`${pullRequestRecord.ownerOpenedAt}`)}
        or ${between(sql`${pullRequestRecord.firstReviewAt}`)}
        or (${pullRequestRecord.state} <> 'open' and ${between(sql`${pullRequestRecord.closedAt}`)})
      )
    order by ${pullRequestRecord.ownerOpenedAt} desc, ${pullRequestRecord.pullRequest} collate "C" desc
  `);

  return result.rows.map((row) => ({
    taskId: row.task_id,
    pullRequest: row.pull_request,
    openedAt: new Date(row.opened_ms),
    firstReviewAt: dateOf(row.first_review_ms),
    closedAt: dateOf(row.closed_ms),
    merged: row.merged,
    taskOpenedAt: dateOf(row.task_opened_ms),
  }));
};
