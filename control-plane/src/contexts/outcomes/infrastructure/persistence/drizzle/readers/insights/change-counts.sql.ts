import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type { ChangeCounts } from '@outcomes/domain/services/before-after';
import {
  type GroupCounts,
  NO_GROUP,
} from '@outcomes/domain/services/change-verdict';
import type { RubricShares } from '@outcomes/domain/services/judge-shares';
import {
  configMarkers,
  precedes,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/config-markers.sql';
import { shareOfScore } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/judge-share.sql';
import {
  type GroupColumns,
  groupCountsOf,
  inEndOrder,
  iso,
  msOf,
  onTeam,
  settledColumns,
  tallyColumns,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  runFact,
  score,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

type Side = 'before' | 'after';

interface MarkerRow extends Record<string, unknown> {
  readonly line_id: string;
  readonly station_id: string;
  readonly fingerprint: string;
  readonly previous_fingerprint: string;
  readonly began_ms: number;
  readonly run_id: string;
}

interface SideRow extends GroupColumns, Record<string, unknown> {
  readonly marker: string;
  readonly side: Side;
}

interface RubricRow extends Record<string, unknown> {
  readonly marker: string;
  readonly side: Side;
  readonly rubric_version: string;
  readonly sum: number;
  readonly judged: number;
}

const shownMarkers = (team: TeamInPeriod): SQL => {
  const { current, lookback } = team.period;

  return sql`
    facts as (
      select ${runFact}.* from ${runFact}
      where ${onTeam(team)}
        and ${runFact.beganAt} >= ${iso(lookback.from)}::timestamp
        and ${runFact.beganAt} < ${iso(lookback.to)}::timestamp
    ),
    markers as (${configMarkers(team, lookback)}),
    placed as (
      select
        markers.*,
        lag(markers.began_at) over along as from_at,
        lag(markers.run_id) over along as from_run,
        lead(markers.began_at) over along as to_at,
        lead(markers.run_id) over along as to_run
      from markers
      window along as (
        partition by markers.station_id
        order by markers.began_at, markers.run_id collate "C"
      )
    ),
    shown as (
      select * from placed
      where placed.began_at >= ${iso(current.from)}::timestamp
        and placed.began_at < ${iso(current.to)}::timestamp
    )`;
};

const sidesOf = (team: TeamInPeriod): SQL => {
  const place = (of: string): readonly [SQL, SQL] => [
    sql.raw(`${of}.began_at`),
    sql.raw(`${of}.run_id`),
  ];
  const [at, run] = place('fact');
  const sinceFrom = sql`(shown.from_at is null or not ${precedes(at, run, sql`shown.from_at`, sql`shown.from_run`)})`;
  const beforeChange = precedes(
    at,
    run,
    sql`shown.began_at`,
    sql`shown.run_id`,
  );

  return sql`
    with ${shownMarkers(team)},
    sides as (
      select shown.run_id as marker, 'before' as side, fact.*
      from shown
      join facts as fact on fact.station_id = shown.station_id
      where ${sinceFrom}
        and ${beforeChange}
        and fact.fingerprint = shown.previous_fingerprint
      union all
      select shown.run_id as marker, 'after' as side, fact.*
      from shown
      join facts as fact on fact.station_id = shown.station_id
      where ${sinceFrom}
        and (shown.to_at is null or ${precedes(at, run, sql`shown.to_at`, sql`shown.to_run`)})
        and fact.fingerprint = shown.fingerprint
        and (not (fact.ran and fact.started_at is not null) or not ${beforeChange})
    )`;
};

const markersIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly MarkerRow[]> => {
  const result = await db.execute<MarkerRow>(sql`
    with ${shownMarkers(team)}
    select
      shown.line_id,
      shown.station_id,
      shown.fingerprint,
      shown.previous_fingerprint,
      ${msOf(sql`shown.began_at`)} as began_ms,
      shown.run_id
    from shown
    order by shown.began_at, shown.run_id collate "C"
  `);

  return result.rows;
};

const sidesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly SideRow[]> => {
  const result = await db.execute<SideRow>(sql`
    ${sidesOf(team)}
    select
      ${runFact}.marker,
      ${runFact}.side,
      ${tallyColumns},
      ${settledColumns}
    from sides as ${runFact}
    group by ${runFact}.marker, ${runFact}.side
  `);

  return result.rows;
};

const rubricsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RubricRow[]> => {
  const result = await db.execute<RubricRow>(sql`
    ${sidesOf(team)}
    select
      ${runFact}.marker,
      ${runFact}.side,
      ${score.rubricVersion} as rubric_version,
      sum(${shareOfScore} order by ${inEndOrder})::float8 as sum,
      count(*)::int as judged
    from sides as ${runFact}
    join ${score}
      on ${score.runId} = ${runFact.runId}
      and ${score.source} = 'judge'
      and ${score.rubricVersion} is not null
      and ${score.stationId} = ${runFact.stationId}
    group by ${runFact}.marker, ${runFact}.side, ${score.rubricVersion}
    order by ${score.rubricVersion} collate "C"
  `);

  return result.rows;
};

export const changeCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly ChangeCounts[]> => {
  const markers = await markersIn(db, team);
  const sides = await sidesIn(db, team);
  const rubrics = await rubricsIn(db, team);
  const keyOf = (marker: string, side: Side) => JSON.stringify([marker, side]);
  const sidesBy = new Map(
    sides.map((each) => [keyOf(each.marker, each.side), groupCountsOf(each)]),
  );
  const judgedBy = new Map<string, RubricShares[]>();

  for (const each of rubrics) {
    const key = keyOf(each.marker, each.side);
    const entries = judgedBy.get(key) ?? [];

    entries.push({
      rubricVersion: each.rubric_version,
      sum: each.sum,
      judged: each.judged,
    });
    judgedBy.set(key, entries);
  }

  const sideOf = (marker: string, side: Side): GroupCounts =>
    sidesBy.get(keyOf(marker, side)) ?? NO_GROUP;
  const judgedOf = (marker: string, side: Side): readonly RubricShares[] =>
    judgedBy.get(keyOf(marker, side)) ?? [];

  return markers.map((row) => ({
    marker: {
      lineId: row.line_id,
      stationId: row.station_id,
      fingerprint: row.fingerprint,
      previousFingerprint: row.previous_fingerprint,
      firstRunAt: new Date(row.began_ms),
      runId: row.run_id,
    },
    before: sideOf(row.run_id, 'before'),
    after: sideOf(row.run_id, 'after'),
    judgedBefore: judgedOf(row.run_id, 'before'),
    judgedAfter: judgedOf(row.run_id, 'after'),
  }));
};
