import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type { BotActivity } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import {
  type Percentiles,
  percentilesOf,
} from '@outcomes/domain/services/measures';
import { weeksOf } from '@outcomes/domain/services/pull-request-insights';
import {
  type ByAuthor,
  type DepthWeekCounts,
  type FlowStageKind,
  type MergeDay,
  type ReviewDay,
  ROLLING_DAYS,
  type ShippedPipeline,
  type ShippingCounts,
  type Stage,
  type Timed,
  type TypeMerge,
} from '@outcomes/domain/services/shipping';
import type { StationPlace } from '@outcomes/domain/services/team-history';
import { ROUND_BUCKETS } from '@outcomes/domain/services/team-pull-requests';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';
import {
  openedFor,
  passagesOfOpened,
  ranOfOpened,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pipeline.sql';
import {
  mergedIn,
  roundBucket,
  toMergeMs,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-request-counts.sql';
import { coveredPullRequests } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pull-requests.sql';
import {
  iso,
  msOf,
  percentilesOver,
  type StationRow,
  stationsInEndOrder,
  textArray,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface MergesRow extends Record<string, unknown> {
  readonly to_merge: ByAuthor;
  readonly to_merge_before: ByAuthor;
  readonly merge_days: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly depth: readonly DepthWeekCounts[];
}

interface ReviewDaysRow extends Record<string, unknown> {
  readonly review_days: readonly ReviewDay[];
}

type BotRow = BotActivity & Record<string, unknown>;

interface StageRow extends Record<string, unknown> {
  readonly kind: FlowStageKind;
  readonly station_id: string | null;
  readonly type: PullRequestType | null;
  readonly total: Percentiles;
  readonly queued: Percentiles;
  readonly running: Percentiles;
  readonly inbox: Percentiles;
}

interface MadeRow extends Record<string, unknown> {
  readonly type: PullRequestType;
  readonly merged: number;
}

const ms = (column: string): SQL => msOf(sql.raw(column));

const lasted = (from: string, to: SQL): SQL =>
  sql`greatest(0, ${msOf(to)} - ${ms(from)})`;

const periodMs = (end: 'from' | 'to'): SQL =>
  msOf(sql.raw(`(period.value->>'${end}')::timestamp`));

const toFirstReviewMs = sql`case
  when ready_for_review_at is not null and first_unblocking_review_at is not null then
    greatest(0, ${lasted('ready_for_review_at', sql.raw('first_unblocking_review_at'))} - coalesce((
      select sum(greatest(0,
        least(${ms('first_unblocking_review_at')}, coalesce(${periodMs('to')}, ${ms('first_unblocking_review_at')}))
        - greatest(${ms('ready_for_review_at')}, ${periodMs('from')})
      ))
      from jsonb_array_elements(draft_periods) as period(value)
    ), 0))
end`;

const approvedOrClosed = sql.raw('least(first_approved_at, closed_at)');

const awaitingAt = (at: SQL): SQL => sql`(
  ready_for_review_at is not null
  and ready_for_review_at <= ${at}
  and not exists (
    select 1 from jsonb_array_elements(draft_periods) as period(value)
    where (period.value->>'from')::timestamp <= ${at}
      and (period.value->>'to' is null or (period.value->>'to')::timestamp > ${at})
  )
  and (first_unblocking_review_at is null or first_unblocking_review_at > ${at})
  and (closed_at is null or closed_at > ${at})
)`;

const byAuthor = (when: SQL): SQL => sql`json_build_object(
  'spotlight', ${percentilesOver(toMergeMs, sql`${when} and made_by = 'spotlight'`)},
  'people', ${percentilesOver(toMergeMs, sql`${when} and made_by = 'people'`)}
)`;

const mergedBetween = (from: SQL, to: SQL): SQL =>
  sql`state = 'merged' and closed_at >= ${from} and closed_at < ${to}`;

const days = (team: TeamInPeriod): SQL => sql`(
  select
    listed.day,
    listed.at,
    listed.day::timestamp as day_from,
    listed.day::timestamp + interval '1 day' as day_to,
    listed.day::timestamp + interval '1 day' - make_interval(days => ${ROLLING_DAYS}) as rolling_from
  from unnest(${textArray(team.period.days)}) with ordinality as listed(day, at)
) as days`;

const comparedTo = (window: Window): SQL => sql`(
  select * from covered
  where made_by = 'spotlight'
    or (
      made_by = 'people'
      and repository_key in (
        select repository_key from covered
        where ${mergedIn(window)} and made_by = 'spotlight'
      )
    )
)`;

const coveredOf = (team: TeamInPeriod, repositories: readonly string[]): SQL =>
  coveredPullRequests(team, repositories, team.period.previous.from);

const mergesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<MergesRow> => {
  const { current, previous } = team.period;
  const result = await db.execute<MergesRow>(sql`
    with covered as (${coveredOf(team, repositories)}),
    compared as ${comparedTo(current)},
    compared_before as ${comparedTo(previous)}
    select
      (select ${byAuthor(mergedIn(current))} from compared) as to_merge,
      (select ${byAuthor(mergedIn(previous))} from compared_before) as to_merge_before,
      (
        select json_agg(json_build_object(
          'day', days.day,
          'daily', daily.by_author,
          'rolling', rolling.by_author
        ) order by days.at)
        from ${days(team)}
        cross join lateral (
          select ${byAuthor(mergedBetween(sql`days.day_from`, sql`days.day_to`))} as by_author
          from compared
        ) as daily
        cross join lateral (
          select ${byAuthor(mergedBetween(sql`days.rolling_from`, sql`days.day_to`))} as by_author
          from compared
        ) as rolling
      ) as merge_days,
      (
        select coalesce(json_agg(json_build_object(
          'type', listed.type,
          'merged', typed.merged,
          'toMerge', typed.by_author
        ) order by listed.at) filter (where typed.merged > 0), '[]'::json)
        from unnest(${textArray(PULL_REQUEST_TYPES)}) with ordinality as listed(type, at)
        cross join lateral (
          select
            (count(*) filter (where ${mergedIn(current)}))::int as merged,
            ${byAuthor(mergedIn(current))} as by_author
          from compared
          where compared.type = listed.type
        ) as typed
      ) as types,
      (
        select json_agg(json_build_object(
          'week', weeks.week,
          'merged', (
            select count(*)::int from compared
            where ${mergedBetween(sql`weeks.week_from`, sql`weeks.week_to`)}
          ),
          'rounds', (
            select json_agg(json_build_object(
              'rounds', buckets.rounds,
              'merged', (
                select count(*)::int from compared
                where ${mergedBetween(sql`weeks.week_from`, sql`weeks.week_to`)}
                  and ${roundBucket} = buckets.rounds
              )
            ) order by buckets.at)
            from unnest(${textArray(ROUND_BUCKETS)}) with ordinality as buckets(rounds, at)
          )
        ) order by weeks.at)
        from (
          select
            listed.week,
            listed.at,
            greatest(listed.week::timestamp, ${iso(current.from)}::timestamp) as week_from,
            least(listed.week::timestamp + interval '7 days', ${iso(current.to)}::timestamp) as week_to
          from unnest(${textArray(weeksOf(current))}) with ordinality as listed(week, at)
        ) as weeks
      ) as depth
  `);
  const [row] = result.rows;

  if (!row) {
    throw new Error('The shipping merges query returned no row');
  }

  return row;
};

const reviewDaysIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<readonly ReviewDay[]> => {
  const firstReviewedBetween = (from: SQL, to: SQL): SQL =>
    sql`first_unblocking_review_at >= ${from} and first_unblocking_review_at < ${to}`;
  const result = await db.execute<ReviewDaysRow>(sql`
    with covered as (${coveredOf(team, repositories)}),
    reviewed as (
      select *, ${toFirstReviewMs} as to_first_review
      from covered
      where made_by <> 'bots'
    )
    select json_agg(json_build_object(
      'day', days.day,
      'toFirstReview', json_build_object('daily', daily.spread, 'rolling', rolling.spread),
      'awaiting', counted.awaiting,
      'humanReviews', counted.human_reviews
    ) order by days.at) as review_days
    from ${days(team)}
    cross join lateral (
      select ${percentilesOver(sql`to_first_review`, firstReviewedBetween(sql`days.day_from`, sql`days.day_to`))} as spread
      from reviewed
    ) as daily
    cross join lateral (
      select ${percentilesOver(sql`to_first_review`, firstReviewedBetween(sql`days.rolling_from`, sql`days.day_to`))} as spread
      from reviewed
    ) as rolling
    cross join lateral (
      select
        (count(*) filter (where ${awaitingAt(sql`days.day_to`)}))::int as awaiting,
        coalesce(sum((
          select count(*) from unnest(human_reviewed_at) as reviewed_at
          where reviewed_at >= days.day_from and reviewed_at < days.day_to
        )), 0)::int as human_reviews
      from reviewed
    ) as counted
  `);

  const [row] = result.rows;

  if (!row) {
    throw new Error('The shipping review days query returned no row');
  }

  return row.review_days;
};

const botsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<readonly BotActivity[]> => {
  const { current } = team.period;
  const result = await db.execute<BotRow>(sql`
    with covered as (${coveredOf(team, repositories)})
    select
      bot.value->>'login' as login,
      sum((bot.value->>'reviews')::int)::int as reviews,
      sum((bot.value->>'comments')::int)::int as comments,
      sum((bot.value->>'threads')::int)::int as threads,
      sum((bot.value->>'resolvedThreads')::int)::int as "resolvedThreads"
    from covered
    cross join lateral jsonb_array_elements(covered.bot_activity) with ordinality as bot(value, at)
    where covered.opened_at < ${iso(current.to)}::timestamp
      and (covered.closed_at is null or covered.closed_at >= ${iso(current.from)}::timestamp)
    group by bot.value->>'login'
    order by min(array[covered.ord, bot.at])
  `);

  return result.rows.map((row) => ({
    login: row.login,
    reviews: row.reviews,
    comments: row.comments,
    threads: row.threads,
    resolvedThreads: row.resolvedThreads,
  }));
};

const shippedOf = (team: TeamInPeriod, repositories: readonly string[]): SQL =>
  sql`covered as (${coveredOf(team, repositories)}),
    shipped as (
      select * from covered
      where ${mergedIn(team.period.current)} and made_by = 'spotlight'
    ),
    opened as (${openedFor(team, sql`select owner_task_id from shipped`)}),
    made as (
      select shipped.*, opened.opened_at as task_opened_at
      from shipped
      join opened on opened.task_id = shipped.owner_task_id
    )`;

const stagesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<readonly StageRow[]> => {
  const none = sql.raw('null::float8');
  const result = await db.execute<StageRow>(sql`
    with ${shippedOf(team, repositories)},
    passages as (${passagesOfOpened(team)}),
    stages as (
      select 'coding' as kind, null::text as station_id, type,
        ${lasted('task_opened_at', sql.raw('opened_at'))} as total,
        ${none} as queued, ${none} as running, ${none} as inbox
      from made
      union all
      select 'station', passages.station_id, made.type,
        passages.queued + passages.running + passages.inbox,
        passages.queued, passages.running, passages.inbox
      from made
      join passages on passages.task_id = made.owner_task_id
      union all
      select 'awaitingReview', null, type, ${toFirstReviewMs}, ${none}, ${none}, ${none}
      from made
      union all
      select 'inReview', null, type,
        case when first_unblocking_review_at is not null and ${approvedOrClosed} is not null
          then ${lasted('first_unblocking_review_at', approvedOrClosed)} end,
        ${none}, ${none}, ${none}
      from made
      union all
      select 'awaitingMerge', null, type,
        case when ${approvedOrClosed} is not null and closed_at is not null
          then greatest(0, ${ms('closed_at')} - ${msOf(approvedOrClosed)}) end,
        ${none}, ${none}, ${none}
      from made
    )
    select
      kind,
      station_id,
      case when grouping(type) = 0 then type end as type,
      ${percentilesOver(sql`total`, sql`true`)} as total,
      ${percentilesOver(sql`queued`, sql`true`)} as queued,
      ${percentilesOver(sql`running`, sql`true`)} as running,
      ${percentilesOver(sql`inbox`, sql`true`)} as inbox
    from stages
    where total is not null
    group by grouping sets ((kind, station_id), (kind, station_id, type))
  `);

  return result.rows;
};

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<readonly StationPlace[]> => {
  const result = await db.execute<StationRow>(sql`
    with ${shippedOf(team, repositories)}
    ${stationsInEndOrder(ranOfOpened(team))}
  `);

  return result.rows.map((row) => ({
    lineId: row.line_id,
    stationId: row.station_id,
  }));
};

const madeIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<readonly MadeRow[]> => {
  const result = await db.execute<MadeRow>(sql`
    with ${shippedOf(team, repositories)}
    select made.type, count(*)::int as merged
    from made
    group by made.type
  `);

  return result.rows;
};

const inTypeOrder = <Row extends { readonly type: PullRequestType | null }, T>(
  rows: readonly Row[],
  map: (row: Row & { readonly type: PullRequestType }) => T,
): readonly T[] =>
  PULL_REQUEST_TYPES.flatMap((type) => {
    const found = rows.find((each) => each.type === type);

    return found ? [map({ ...found, type })] : [];
  });

const timedOf = (row: StageRow | undefined, parted: boolean): Timed => {
  const none = percentilesOf([]);

  return {
    total: row?.total ?? none,
    parts: parted
      ? {
          queued: row?.queued ?? none,
          running: row?.running ?? none,
          inbox: row?.inbox ?? none,
        }
      : null,
  };
};

const stageOf = (
  rows: readonly StageRow[],
  kind: FlowStageKind,
  place: StationPlace | null,
): Stage<Timed> => {
  const here = rows.filter(
    (each) =>
      each.kind === kind && each.station_id === (place?.stationId ?? null),
  );
  const parted = kind === 'station';

  return {
    kind,
    place,
    times: {
      all: timedOf(
        here.find((each) => each.type === null),
        parted,
      ),
      types: inTypeOrder(here, (each) => ({
        type: each.type,
        times: timedOf(each, parted),
      })),
    },
  };
};

const pipelineIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<ShippedPipeline> => {
  const rows = await stagesIn(db, team, repositories);
  const stations = await stationsIn(db, team, repositories);
  const made = await madeIn(db, team, repositories);

  return {
    merged: made.reduce((sum, each) => sum + each.merged, 0),
    types: inTypeOrder(made, (each) => ({
      type: each.type,
      merged: each.merged,
    })),
    coding: stageOf(rows, 'coding', null),
    stations: stations.map((place) => stageOf(rows, 'station', place)),
    review: (['awaitingReview', 'inReview', 'awaitingMerge'] as const).map(
      (kind) => stageOf(rows, kind, null),
    ),
  };
};

export const shippingCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  repositories: readonly string[],
): Promise<ShippingCounts> => {
  const merges = await mergesIn(db, team, repositories);

  return {
    toMerge: merges.to_merge,
    toMergeBefore: merges.to_merge_before,
    mergeDays: merges.merge_days,
    types: merges.types,
    depth: merges.depth,
    reviewDays: await reviewDaysIn(db, team, repositories),
    bots: await botsIn(db, team, repositories),
    pipeline: await pipelineIn(db, team, repositories),
  };
};
