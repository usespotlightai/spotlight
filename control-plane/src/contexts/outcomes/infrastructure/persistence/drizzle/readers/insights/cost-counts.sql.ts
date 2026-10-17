import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import {
  type CacheTotals,
  type CostCounts,
  type CostCountsInPeriod,
  type CostLinkCount,
  type CostPlace,
  type CostShareCount,
} from '@outcomes/domain/services/cost-breakdown';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  endedIn,
  factsInPeriod,
  inEndOrder,
  isCurrent,
  onTeam,
  priced,
  ran,
  type SpendRow,
  spendColumns,
  spendOf,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { runFact } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface SpendingRow extends SpendRow, Record<string, unknown> {
  readonly is_current: boolean;
}

interface ShareRow extends Record<string, unknown> {
  readonly part: CostShareCount['part'];
  readonly key: string | null;
  readonly amount: number;
  readonly runs: number;
  readonly first: [number, number];
}

interface LinkRow extends Record<string, unknown> {
  readonly source_kind: CostLinkCount['source']['kind'];
  readonly source_key: string | null;
  readonly target_kind: CostLinkCount['target']['kind'];
  readonly target_key: string | null;
  readonly amount: number;
  readonly first: [number, number];
}

interface CacheRow extends Record<string, unknown> {
  readonly station_id: string | null;
  readonly all_stations: number;
  readonly first: number;
  readonly known: number;
  readonly input: number | null;
  readonly cache_read: number | null;
  readonly cache_write: number | null;
}

const runsIn = (team: TeamInPeriod, window: Window, matching: SQL): SQL => sql`
  select
    ${runFact}.*,
    row_number() over (order by ${inEndOrder}) as place
  from ${runFact}
  where ${onTeam(team)} and ${endedIn(window.from, window.to)} and ${matching}`;

const sharesOf = sql`
  select repository.value #>> '{}' as key, repository.position, priced.cost / jsonb_array_length(priced.repositories) as amount
  from jsonb_array_elements(priced.repositories) with ordinality as repository(value, position)
  union all
  select null, 1, priced.cost
  where jsonb_array_length(priced.repositories) = 0`;

const firstAt = (offset: SQL): SQL =>
  sql`min(array[priced.place::int, (${offset})::int])`;

const placeOf = ([run, offset]: [number, number]): CostPlace => ({
  run,
  offset,
});

const spendingIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly SpendingRow[]> => {
  const result = await db.execute<SpendingRow>(sql`
    select ${isCurrent} as is_current, ${spendColumns}
    from ${factsInPeriod(team)}
    group by ${isCurrent}
  `);

  return result.rows;
};

const sharesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly CostShareCount[]> => {
  const result = await db.execute<ShareRow>(sql`
    with priced as (${runsIn(team, team.period.current, priced)})
    select 'harness' as part, priced.harness as key, sum(priced.cost order by priced.place) as amount, count(*)::int as runs, ${firstAt(sql`0`)} as first
    from priced group by priced.harness
    union all
    select 'model', priced.model, sum(priced.cost order by priced.place), count(*)::int, ${firstAt(sql`0`)}
    from priced group by priced.model
    union all
    select 'station', priced.station_id, sum(priced.cost order by priced.place), count(*)::int, ${firstAt(sql`1`)}
    from priced group by priced.station_id
    union all
    select 'repository', share.key, sum(share.amount order by priced.place, share.position), count(*)::int, ${firstAt(sql`1 + share.position`)}
    from priced cross join lateral (${sharesOf}) as share
    group by share.key
  `);

  return result.rows.map((row) => ({
    part: row.part,
    key: row.key,
    amount: row.amount,
    runs: row.runs,
    first: placeOf(row.first),
  }));
};

const linksIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly CostLinkCount[]> => {
  const result = await db.execute<LinkRow>(sql`
    with priced as (${runsIn(team, team.period.current, priced)})
    select 'model' as source_kind, priced.model as source_key, 'station' as target_kind, priced.station_id as target_key, sum(priced.cost order by priced.place) as amount, ${firstAt(sql`0`)} as first
    from priced group by priced.model, priced.station_id
    union all
    select 'station', priced.station_id, 'repository', share.key, sum(share.amount order by priced.place, share.position), ${firstAt(sql`share.position`)}
    from priced cross join lateral (${sharesOf}) as share
    group by priced.station_id, share.key
  `);

  return result.rows.map((row) => ({
    source: { kind: row.source_kind, key: row.source_key },
    target: { kind: row.target_kind, key: row.target_key },
    amount: row.amount,
    first: placeOf(row.first),
  }));
};

const cacheIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly CacheRow[]> => {
  const known = sql`ran.input_tokens is not null and ran.cache_read_tokens is not null`;
  const result = await db.execute<CacheRow>(sql`
    with ran as (${runsIn(team, team.period.current, ran)})
    select
      ran.station_id,
      grouping(ran.station_id)::int as all_stations,
      min(ran.place)::float8 as first,
      count(*) filter (where ${known})::int as known,
      sum(ran.input_tokens) filter (where ${known})::float8 as input,
      sum(ran.cache_read_tokens) filter (where ${known})::float8 as cache_read,
      sum(ran.cache_write_tokens) filter (where ${known})::float8 as cache_write
    from ran
    group by grouping sets ((), (ran.station_id))
  `);

  return result.rows;
};

const cacheTotalsOf = (row: CacheRow | undefined): CacheTotals | null =>
  row && row.known > 0
    ? {
        input: row.input ?? 0,
        cacheRead: row.cache_read ?? 0,
        cacheWrite: row.cache_write,
      }
    : null;

export const costCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<CostCountsInPeriod> => {
  const spending = await spendingIn(db, team);
  const shares = await sharesIn(db, team);
  const links = await linksIn(db, team);
  const cache = await cacheIn(db, team);
  const now = spending.find((each) => each.is_current);
  const before = spending.find((each) => !each.is_current);
  const current: CostCounts = {
    spend: now ? spendOf(now) : null,
    unpriced: now?.unpriced ?? 0,
    mixedCurrencies: (now?.currencies ?? 0) > 1,
    shares,
    links,
    cache: cacheTotalsOf(cache.find((each) => each.all_stations === 1)),
    cacheByStation: cache.flatMap((row) =>
      row.all_stations === 0 && row.station_id !== null
        ? [
            {
              stationId: row.station_id,
              first: row.first,
              cache: cacheTotalsOf(row),
            },
          ]
        : [],
    ),
  };

  return { current, spendBefore: before ? spendOf(before) : null };
};
