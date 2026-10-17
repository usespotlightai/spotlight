import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type {
  MergedCounts,
  MergedTally,
  PullRequestCounts,
  RoundsShare,
} from '@outcomes/domain/services/pull-request-insights';
import { ROUND_BUCKETS } from '@outcomes/domain/services/team-pull-requests';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';
import {
  atIn,
  coveredPullRequests,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-requests.sql';
import {
  msOf,
  spendOf,
  spreadOver,
  textArray,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface TypeRow {
  readonly type: PullRequestType;
  readonly spotlight: number;
  readonly people: number;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly currencies: number;
  readonly unpriced: number;
  readonly mixed: boolean;
}

interface CountsRow extends Record<string, unknown> {
  readonly covered: number;
  readonly tallies: readonly MergedTally[];
  readonly named: readonly string[];
  readonly compared: readonly string[];
  readonly spotlight: MergedCounts;
  readonly people: MergedCounts;
  readonly types: readonly TypeRow[];
  readonly depth: readonly RoundsShare[];
}

export const mergedIn = (window: Window): SQL =>
  sql`state = 'merged' and ${atIn(sql`closed_at`, window)}`;

export const roundBucket = sql`case
  when review_rounds >= 3 then '3+'
  when review_rounds = 2 then '2'
  when review_rounds = 1 then '1'
  else '0'
end`;

const firstSpellings = (pullRequests: SQL): SQL => sql`
  select
    repository_key,
    (array_agg(repository order by ord))[1] as spelling,
    min(ord) as first
  from ${pullRequests}
  group by repository_key`;

export const toMergeMs = sql`(${msOf(sql`closed_at`)} - ${msOf(sql`opened_at`)})`;

const measured = sql`json_build_object(
  'merged', count(*)::int,
  'toMerge', ${spreadOver(toMergeMs, sql`true`)},
  'inReview', ${spreadOver(sql`(${msOf(sql`closed_at`)} - ${msOf(sql`first_review_at`)})`, sql`true`)},
  'rounds', coalesce(sum(review_rounds), 0)::int,
  'comments', coalesce(sum(review_comments), 0)::int,
  'reverted', (count(*) filter (where reverted))::int
)`;

const pricedPullRequest = sql`currencies = 1`;

export const pullRequestCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<PullRequestCounts> => {
  const window = team.period.current;
  const result = await db.execute<CountsRow>(sql`
    with covered as (${coveredPullRequests(team, repositories, window.from)}),
    merged as (select * from covered where ${mergedIn(window)}),
    made as (select * from merged where made_by = 'spotlight'),
    compared as (${firstSpellings(sql`made`)}),
    people as (
      select * from merged
      where made_by = 'people'
        and repository_key in (select repository_key from compared)
    )
    select
      (select count(*)::int from covered) as covered,
      (
        select coalesce(json_agg(json_build_object(
          'repository', repository_key,
          'week', week,
          'by', made_by,
          'merged', merged
        ) order by repository_key collate "C", week collate "C", made_by collate "C"), '[]'::json)
        from (
          select
            repository_key,
            to_char(date_trunc('week', closed_at), 'YYYY-MM-DD') as week,
            made_by,
            count(*)::int as merged
          from merged
          group by 1, 2, 3
        ) as tallied
      ) as tallies,
      (
        select coalesce(json_agg(spelling order by first), '[]'::json)
        from (${firstSpellings(sql`merged`)}) as named
      ) as named,
      (select coalesce(json_agg(spelling order by first), '[]'::json) from compared) as compared,
      (select ${measured} from made) as spotlight,
      (select ${measured} from people) as people,
      (
        select json_agg(json_build_object(
          'type', listed.type,
          'spotlight', (select count(*)::int from made where made.type = listed.type),
          'people', (select count(*)::int from people where people.type = listed.type),
          'amount', typed.amount,
          'currency', typed.currency,
          'currencies', typed.currencies,
          'unpriced', typed.unpriced,
          'mixed', typed.mixed
        ) order by listed.at)
        from unnest(${textArray(PULL_REQUEST_TYPES)}) with ordinality as listed(type, at)
        cross join lateral (
          select
            (sum(spend_amount order by ord) filter (where ${pricedPullRequest}))::float8 as amount,
            min(spend_currency) filter (where ${pricedPullRequest}) as currency,
            (count(distinct spend_currency) filter (where ${pricedPullRequest}))::int as currencies,
            coalesce(sum(runs - priced), 0)::int as unpriced,
            coalesce(bool_or(currencies > 1), false) as mixed
          from made
          where made.type = listed.type
        ) as typed
      ) as types,
      (
        select json_agg(json_build_object(
          'rounds', listed.rounds,
          'spotlight', (select count(*)::int from made where ${roundBucket} = listed.rounds),
          'people', (select count(*)::int from people where ${roundBucket} = listed.rounds)
        ) order by listed.at)
        from unnest(${textArray(ROUND_BUCKETS)}) with ordinality as listed(rounds, at)
      ) as depth
  `);
  const [row] = result.rows;

  if (!row) {
    throw new Error('The pull request counts query returned no row');
  }

  return {
    covered: row.covered,
    tallies: row.tallies,
    named: row.named,
    compared: row.compared,
    spotlight: row.spotlight,
    people: row.people,
    types: row.types.map((each) => ({
      type: each.type,
      spotlight: each.spotlight,
      people: each.people,
      spend: spendOf(each),
      unpriced: each.unpriced,
      mixedCurrencies: each.currencies > 1 || each.mixed,
    })),
    depth: row.depth,
  };
};
