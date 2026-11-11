import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import {
  type TeamPullRequest,
  teamPullRequestFrom,
} from '@insights/domain/services/team-pull-requests';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import { seenOfRow } from '@insights/infrastructure/persistence/drizzle/mappers/pull-request-seen.mapper';
import {
  inEndOrder,
  iso,
  spendOf,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  pullRequestFact,
  pullRequestRecord,
  runFact,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { inList } from '@platform/persistence/drizzle/in-list';
import { getTableColumns, type SQL, type SQLWrapper, sql } from 'drizzle-orm';

const factOfRecord = sql`${pullRequestFact.workspaceId} = ${pullRequestRecord.workspaceId} and ${pullRequestFact.pullRequest} = ${pullRequestRecord.pullRequest}`;

const pricedRun = sql`${runFact.cost} is not null and coalesce(${runFact.currency}, '') <> ''`;

const seenRecord = sql`${pullRequestRecord.seenVersion} is not null
  and ${pullRequestRecord.repository} is not null
  and ${pullRequestRecord.number} is not null
  and ${pullRequestRecord.title} is not null
  and ${pullRequestRecord.openedAt} is not null
  and ${pullRequestRecord.updatedAt} is not null
  and ${pullRequestRecord.state} is not null`;

const spent = sql`(
  select
    sum(${runFact.cost}::float8 order by ${inEndOrder}) filter (where ${pricedRun}) as amount,
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
  sql`${column} >= ${iso(window.from)}::timestamptz and ${column} < ${iso(window.to)}::timestamptz`;

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
    and ${pullRequestRecord.openedAt} < ${iso(team.period.current.to)}::timestamptz
    and (
      ${pullRequestRecord.closedAt} is null
      or ${pullRequestRecord.closedAt} >= ${iso(from)}::timestamptz
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
    ${pullRequestFact.madeBy}::text as made_by,
    ${pullRequestFact.type}::text as type,
    ${pullRequestFact.rounds}::text as rounds,
    ${pullRequestFact.mergedAt} as merged_at,
    spent.amount as spend_amount,
    spent.currency as spend_currency,
    spent.currencies,
    spent.priced,
    spent.runs,
    row_number() over (order by ${newestFirst}) as ord
  from ${pullRequestRecord}
  join ${pullRequestFact} on ${factOfRecord}
  left join lateral ${spent} on true
  where ${coverageOf(team, repositories, from)}`;

const teamPullRequestsWhere = async (
  db: DrizzleDatabase,
  where: SQL,
): Promise<readonly TeamPullRequest[]> => {
  const rows = await db
    .select({
      ...getTableColumns(pullRequestRecord),
      type: pullRequestFact.type,
      madeBy: pullRequestFact.madeBy,
      spend_amount: sql<number | null>`spent.amount`,
      spend_currency: sql<string | null>`spent.currency`,
      currencies: sql<number>`spent.currencies`,
      priced: sql<number>`spent.priced`,
      runs: sql<number>`spent.runs`,
    })
    .from(pullRequestRecord)
    .innerJoin(pullRequestFact, factOfRecord)
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
            by: row.madeBy,
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
