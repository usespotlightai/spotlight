import type {
  SetupFilter,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import { SIZE_BOUNDS } from '@outcomes/domain/services/run-size';
import type {
  RubricShares,
  SetupComparisonCounts,
  SetupCounts,
} from '@outcomes/domain/services/setup-comparison';
import {
  SCORE_KINDS,
  ScoreScale,
} from '@outcomes/domain/value-objects/score-scale.vo';
import {
  counted,
  endedIn,
  type GroupColumns,
  groupCountsOf,
  inEndOrder,
  onTeam,
  ran,
  type StationRow,
  settledColumns,
  stationsInEndOrder,
  tallyColumns,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  runFact,
  score,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface SetupRow extends GroupColumns, Record<string, unknown> {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile_key: string | null;
  readonly answered: number;
}

interface RubricRow extends Record<string, unknown> {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile_key: string | null;
  readonly rubric_version: string;
  readonly sum: number;
  readonly judged: number;
}

const sizedBy = (count: SQL, most: 'mostLines' | 'mostSteps'): SQL => {
  const bounded = SIZE_BOUNDS.flatMap((bound) => {
    const limit = bound[most];

    return limit === null
      ? []
      : [sql`when ${count} <= ${limit} then ${bound.size}`];
  });
  const open = SIZE_BOUNDS.find((bound) => bound[most] === null);

  return sql`case ${sql.join(bounded, sql` `)} else ${open?.size ?? 'large'} end`;
};

const sizeOfRun = sql`case
  when not ${runFact.digested} then null
  when ${runFact.changedLines} > 0 then ${sizedBy(sql`${runFact.changedLines}`, 'mostLines')}
  else ${sizedBy(sql`${runFact.steps}`, 'mostSteps')}
end`;

const shareOfScore = sql`case ${sql.join(
  SCORE_KINDS.map((kind) => {
    const values = ScoreScale.of(kind).values;
    const lowest = Math.min(...values);
    const highest = Math.max(...values);

    return highest === lowest
      ? sql`when ${score.kind} = ${kind} then 0::float8`
      : sql`when ${score.kind} = ${kind} then (${score.value} - ${lowest}::float8) / ${highest - lowest}::float8`;
  }),
  sql` `,
)} end`;

const endedFor = (team: TeamInPeriod, filter: SetupFilter): SQL => {
  const { current } = team.period;

  return sql`
    select ${runFact}.* from ${runFact}
    where ${onTeam(team)}
      and ${endedIn(current.from, current.to)}
      ${filter.stationId === null ? sql`` : sql`and ${runFact.stationId} = ${filter.stationId}`}
      ${filter.size === null ? sql`` : sql`and ${sizeOfRun} = ${filter.size}`}`;
};

const setupColumns = sql`${runFact.harness}, ${runFact.model}, ${runFact.effort}, ${runFact.profileKey}`;

const inSetupOrder = sql`
  ${runFact.harness} collate "C",
  ${runFact.model} collate "C" nulls first,
  ${runFact.effort} collate "C" nulls first,
  ${runFact.profileKey} collate "C" nulls first`;

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: SetupFilter,
): Promise<readonly StationRow[]> => {
  const result = await db.execute<StationRow>(
    stationsInEndOrder(endedFor(team, filter)),
  );

  return result.rows;
};

const setupsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: SetupFilter,
): Promise<readonly SetupRow[]> => {
  const result = await db.execute<SetupRow>(sql`
    select
      ${runFact.harness} as harness,
      ${runFact.model} as model,
      ${runFact.effort} as effort,
      ${runFact.profileKey} as profile_key,
      ${tallyColumns},
      ${settledColumns},
      ${counted(sql`${ran} and (${runFact.nextAct} is not null or ${runFact.handedOnTo} is not null)`)} as answered
    from (${endedFor(team, filter)}) as ${runFact}
    where ${ran}
    group by ${setupColumns}
    order by ${inSetupOrder}
  `);

  return result.rows;
};

const rubricsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: SetupFilter,
  stationId: string,
): Promise<readonly RubricRow[]> => {
  const result = await db.execute<RubricRow>(sql`
    select
      ${runFact.harness} as harness,
      ${runFact.model} as model,
      ${runFact.effort} as effort,
      ${runFact.profileKey} as profile_key,
      ${score.rubricVersion} as rubric_version,
      sum(${shareOfScore} order by ${inEndOrder})::float8 as sum,
      count(*)::int as judged
    from (${endedFor(team, filter)}) as ${runFact}
    join ${score}
      on ${score.runId} = ${runFact.runId}
      and ${score.source} = 'judge'
      and ${score.rubricVersion} is not null
      and ${score.stationId} = ${stationId}
    where ${ran}
    group by ${setupColumns}, ${score.rubricVersion}
    order by ${inSetupOrder}, ${score.rubricVersion} collate "C"
  `);

  return result.rows;
};

const sameSetup = (row: RubricRow, setup: SetupRow): boolean =>
  row.harness === setup.harness &&
  row.model === setup.model &&
  row.effort === setup.effort &&
  row.profile_key === setup.profile_key;

export const setupCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: SetupFilter,
): Promise<SetupComparisonCounts> => {
  const stations = await stationsIn(db, team, filter);
  const setups = await setupsIn(db, team, filter);
  const rubrics =
    filter.stationId === null
      ? []
      : await rubricsIn(db, team, filter, filter.stationId);

  return {
    stations: stations.map((row) => ({
      lineId: row.line_id,
      stationId: row.station_id,
    })),
    setups: setups.map(
      (row): SetupCounts => ({
        harness: row.harness,
        model: row.model,
        effort: row.effort,
        profileKey: row.profile_key,
        counts: groupCountsOf(row),
        answered: row.answered,
        rubrics: rubrics
          .filter((each) => sameSetup(each, row))
          .map(
            (each): RubricShares => ({
              rubricVersion: each.rubric_version,
              sum: each.sum,
              judged: each.judged,
            }),
          ),
      }),
    ),
  };
};
