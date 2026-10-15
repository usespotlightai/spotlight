import type {
  PullRequestReach,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import {
  type TeamPullRequest,
  teamPullRequestFrom,
} from '@outcomes/domain/services/team-pull-requests';
import type { PullRequestType } from '@outcomes/domain/value-objects/pull-request-type';
import { seenOfRow } from '@outcomes/infrastructure/persistence/drizzle/mappers/pull-request-seen.mapper';
import { pullRequestTypeSql } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-request-type.sql';
import {
  inEndOrder,
  iso,
  spendOf,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  pullRequestRecord,
  runFact,
  taskChangeShape,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { getTableColumns, sql } from 'drizzle-orm';

const owned = sql`${pullRequestRecord.ownerTaskId} is not null and ${pullRequestRecord.ownerTeamId} is not null`;

const pricedRun = sql`${runFact.cost} is not null and coalesce(${runFact.currency}, '') <> ''`;

export const pullRequestsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  reach: PullRequestReach,
): Promise<readonly TeamPullRequest[]> => {
  const repositories = reach.repositories.map((each) => each.toLowerCase());
  const rows = await db
    .select({
      ...getTableColumns(pullRequestRecord),
      type: sql<PullRequestType>`${pullRequestTypeSql({
        title: sql`${pullRequestRecord.title}`,
        branch: sql`${pullRequestRecord.branch}`,
        changeTitles: sql`case when ${owned} then ${taskChangeShape.changeTitles} end`,
        changeIntents: sql`case when ${owned} then ${taskChangeShape.changeIntents} end`,
      })}`,
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
    .leftJoinLateral(
      sql`(
        select
          (sum(${runFact.cost} order by ${inEndOrder}) filter (where ${pricedRun}))::float8 as amount,
          min(${runFact.currency}) filter (where ${pricedRun}) as currency,
          count(distinct ${runFact.currency}) filter (where ${pricedRun})::int as currencies,
          count(*) filter (where ${pricedRun})::int as priced,
          count(*)::int as runs
        from ${runFact}
        where ${runFact.taskId} = ${pullRequestRecord.ownerTaskId}
      ) as spent`,
      sql`true`,
    )
    .where(
      sql`${pullRequestRecord.workspaceId} = ${team.workspaceId.value}
        and ${pullRequestRecord.seenVersion} is not null
        and (
          ${pullRequestRecord.ownerTeamId} = ${team.teamId.value}
          or ${pullRequestRecord.repository} in (
            select jsonb_array_elements_text(${JSON.stringify(repositories)}::jsonb)
          )
        )
        and ${pullRequestRecord.openedAt} < ${iso(team.period.current.to)}::timestamp
        and (
          ${pullRequestRecord.closedAt} is null
          or ${pullRequestRecord.closedAt} >= ${iso(reach.from)}::timestamp
        )`,
    )
    .orderBy(
      sql`${pullRequestRecord.openedAt} desc, ${pullRequestRecord.pullRequest} desc`,
    )
    .limit(reach.most);

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
