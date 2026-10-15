import type {
  PullRequestListing,
  PullRequestPage,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { PullRequestFilter } from '@outcomes/domain/services/pull-request-filter';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  mergedIn,
  roundBucket,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-request-counts.sql';
import {
  atIn,
  lowerCasedIn,
  pullRequestsNamedIn,
  reachedPullRequests,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-requests.sql';
import { iso } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface PageRow extends Record<string, unknown> {
  readonly total: number;
  readonly page: readonly string[];
}

const openBefore = (window: Window): SQL =>
  sql`state = 'open' and opened_at < ${iso(window.to)}::timestamp`;

const inStateOf = (filter: PullRequestFilter, window: Window): SQL => {
  if (filter.state === null) {
    return sql`((${atIn(sql`opened_at`, window)}) or (${atIn(sql`closed_at`, window)}) or ${openBefore(window)})`;
  }

  if (filter.state === 'open') {
    return openBefore(window);
  }

  return sql`state = ${filter.state} and ${atIn(sql`closed_at`, window)}`;
};

const listedOf = (filter: PullRequestFilter, window: Window): SQL =>
  sql.join(
    [
      inStateOf(filter, window),
      ...(filter.week ? [atIn(sql`closed_at`, filter.week)] : []),
      ...(filter.repositories
        ? [sql`repository_key in ${lowerCasedIn(filter.repositories)}`]
        : []),
      ...(filter.compared
        ? [sql`repository_key in (select repository_key from compared)`]
        : []),
      ...(filter.author ? [sql`made_by = ${filter.author}`] : []),
      ...(filter.type ? [sql`type = ${filter.type}`] : []),
      ...(filter.reverted ? [sql`reverted`] : []),
      ...(filter.rounds ? [sql`${roundBucket} = ${filter.rounds}`] : []),
    ],
    sql` and `,
  );

const offsetOf = ({ page, size }: PullRequestListing): number =>
  Math.min((page - 1) * size, Number.MAX_SAFE_INTEGER);

const lastFirst = sql`last_at desc, pull_request collate "C"`;

export const pullRequestPageIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  listing: PullRequestListing,
): Promise<PullRequestPage> => {
  const window = team.period.current;
  const result = await db.execute<PageRow>(sql`
    with reached as (${reachedPullRequests(team, listing.repositories, window.from)}),
    compared as (
      select distinct repository_key from reached
      where ${mergedIn(window)} and made_by = 'spotlight'
    ),
    listed as (
      select pull_request, coalesce(closed_at, opened_at) as last_at
      from reached
      where ${listedOf(listing.filter, window)}
    )
    select
      (select count(*)::int from listed) as total,
      (
        select coalesce(json_agg(pull_request order by ${lastFirst}), '[]'::json)
        from (
          select * from listed
          order by ${lastFirst}
          limit ${listing.size} offset ${offsetOf(listing)}
        ) as paged
      ) as page
  `);
  const [row] = result.rows;

  if (!row) {
    throw new Error('The pull request page query returned no row');
  }

  return {
    total: row.total,
    pullRequests: await pullRequestsNamedIn(db, team, row.page),
  };
};
