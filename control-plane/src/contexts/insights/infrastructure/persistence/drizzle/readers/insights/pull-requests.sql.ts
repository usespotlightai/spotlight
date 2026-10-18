import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import {
  type TeamPullRequest,
  teamPullRequestFrom,
} from '@insights/domain/services/team-pull-requests';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import type { PullRequestType } from '@insights/domain/value-objects/pull-request-type';
import { seenOfRow } from '@insights/infrastructure/persistence/drizzle/mappers/pull-request-seen.mapper';
import { pullRequestTypeSql } from '@insights/infrastructure/persistence/drizzle/readers/insights/pull-request-type.sql';
import {
  inEndOrder,
  iso,
  spendOf,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  pullRequestRecord,
  runFact,
  taskChangeShape,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { inList } from '@platform/persistence/drizzle/in-list';
import { getTableColumns, type SQL, type SQLWrapper, sql } from 'drizzle-orm';

const owned = sql`${pullRequestRecord.ownerTaskId} is not null and ${pullRequestRecord.ownerTeamId} is not null`;

const pricedRun = sql`${runFact.cost} is not null and coalesce(${runFact.currency}, '') <> ''`;

const seenRecord = sql`${pullRequestRecord.seenVersion} is not null
  and ${pullRequestRecord.repository} is not null
  and ${pullRequestRecord.number} is not null
  and ${pullRequestRecord.title} is not null
  and ${pullRequestRecord.openedAt} is not null
  and ${pullRequestRecord.updatedAt} is not null
  and ${pullRequestRecord.state} is not null`;

const typeColumn = sql<PullRequestType>`${pullRequestTypeSql({
  title: sql`${pullRequestRecord.title}`,
  branch: sql`${pullRequestRecord.branch}`,
  changeTitles: sql`case when ${owned} then ${taskChangeShape.changeTitles} end`,
  changeIntents: sql`case when ${owned} then ${taskChangeShape.changeIntents} end`,
})}`;

const madeByColumn = sql`case
  when ${owned} then 'spotlight'
  when cardinality(${pullRequestRecord.reviewTaskIds}) > 0 then 'reviewed'
  when ${pullRequestRecord.authorIsBot} then 'bots'
  else 'people'
end`;

const spent = sql`(
  select
    (sum(${runFact.cost} order by ${inEndOrder}) filter (where ${pricedRun}))::float8 as amount,
    min(${runFact.currency}) filter (where ${pricedRun}) as currency,
    count(distinct ${runFact.currency}) filter (where ${pricedRun})::int as currencies,
    count(*) filter (where ${pricedRun})::int as priced,
    count(*)::int as runs
  from ${runFact}
  where ${runFact.taskId} = ${pullRequestRecord.ownerTaskId}
) as spent`;

export const inLowerCase = (
  column: SQLWrapper,
  values: readonly string[],
): SQL =>
  inList(
    column,
    values.map((each) => each.toLowerCase()),
  );

export const atIn = (column: SQL, window: Window): SQL =>
  sql`${column} >= ${iso(window.from)}::timestamp and ${column} < ${iso(window.to)}::timestamp`;

const coverageOf = (
  team: TeamInPeriod,
  repositories: readonly string[],
  from: Date,
): SQL =>
  sql`${pullRequestRecord.workspaceId} = ${team.workspaceId.value}
    and ${seenRecord}
    and (
      ${pullRequestRecord.ownerTeamId} = ${team.teamId.value}
      or ${inLowerCase(pullRequestRecord.repository, repositories)}
    )
    and ${pullRequestRecord.openedAt} < ${iso(team.period.current.to)}::timestamp
    and (
      ${pullRequestRecord.closedAt} is null
      or ${pullRequestRecord.closedAt} >= ${iso(from)}::timestamp
    )`;

const newestFirst = sql`${pullRequestRecord.openedAt} desc, ${pullRequestRecord.pullRequest} collate "C" desc`;

export const coveredPullRequests = (
  team: TeamInPeriod,
  repositories: readonly string[],
  from: Date,
): SQL => sql`
  select
    ${pullRequestRecord.pullRequest} as pull_request,
    ${pullRequestRecord.repository} as repository,
    lower(${pullRequestRecord.repository}) as repository_key,
    ${pullRequestRecord.state}::text as state,
    ${pullRequestRecord.openedAt} as opened_at,
    ${pullRequestRecord.closedAt} as closed_at,
    ${pullRequestRecord.firstReviewAt} as first_review_at,
    ${pullRequestRecord.readyForReviewAt} as ready_for_review_at,
    ${pullRequestRecord.firstUnblockingReviewAt} as first_unblocking_review_at,
    ${pullRequestRecord.firstApprovedAt} as first_approved_at,
    ${pullRequestRecord.draftPeriods} as draft_periods,
    ${pullRequestRecord.humanReviewedAt} as human_reviewed_at,
    ${pullRequestRecord.botActivity} as bot_activity,
    ${pullRequestRecord.ownerTaskId} as owner_task_id,
    ${pullRequestRecord.reviewRounds} as review_rounds,
    ${pullRequestRecord.reviewComments} as review_comments,
    ${pullRequestRecord.revertedBy} is not null as reverted,
    ${madeByColumn} as made_by,
    ${typeColumn} as type,
    spent.amount as spend_amount,
    spent.currency as spend_currency,
    spent.currencies,
    spent.priced,
    spent.runs,
    row_number() over (order by ${newestFirst}) as ord
  from ${pullRequestRecord}
  left join ${taskChangeShape} on ${taskChangeShape.taskId} = ${pullRequestRecord.ownerTaskId}
  left join lateral ${spent} on true
  where ${coverageOf(team, repositories, from)}`;

const teamPullRequestsWhere = async (
  db: DrizzleDatabase,
  where: SQL,
): Promise<readonly TeamPullRequest[]> => {
  const rows = await db
    .select({
      ...getTableColumns(pullRequestRecord),
      type: typeColumn,
      spend_amount: sql<number | null>`spent.amount`,
      spend_currency: sql<string | null>`spent.currency`,
      currencies: sql<number>`spent.currencies`,
      priced: sql<number>`spent.priced`,
      runs: sql<number>`spent.runs`,
    })
    .from(pullRequestRecord)
    .leftJoin(
      taskChangeShape,
      sql`${taskChangeShape.taskId} = ${pullRequestRecord.ownerTaskId}`,
    )
    .leftJoinLateral(spent, sql`true`)
    .where(where)
    .orderBy(newestFirst);

  return rows.flatMap((row) => {
    const seen = seenOfRow(row);

    return seen
      ? [
          teamPullRequestFrom({
            pullRequest: row.pullRequest,
            seen,
            ownerTaskId:
              row.ownerTaskId && row.ownerTeamId ? row.ownerTaskId : null,
            reviewTaskIds: row.reviewTaskIds,
            type: row.type,
            spending: {
              spend: spendOf({
                amount: row.spend_amount,
                currency: row.spend_currency,
                currencies: row.currencies,
                unpriced: row.runs - row.priced,
              }),
              priced: row.priced,
              unpriced: row.runs - row.priced,
              mixedCurrencies: row.currencies > 1,
            },
          }),
        ]
      : [];
  });
};

export const pullRequestsNamedIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  named: readonly string[],
): Promise<readonly TeamPullRequest[]> => {
  const found = await teamPullRequestsWhere(
    db,
    sql`${pullRequestRecord.workspaceId} = ${team.workspaceId.value}
      and ${inList(pullRequestRecord.pullRequest, named)}`,
  );
  const byName = new Map(found.map((each) => [each.pullRequest, each]));

  return named.flatMap((each) => {
    const pullRequest = byName.get(each);

    return pullRequest ? [pullRequest] : [];
  });
};
