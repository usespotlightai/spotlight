import type {
  AgentConfigFilter,
  TeamInPeriod,
} from '@insights/application/ports/insights-reader.port';
import type {
  AgentConfigComparisonCounts,
  AgentConfigCounts,
} from '@insights/domain/services/agent-config-comparison';
import type { RubricRates } from '@insights/domain/services/judge-rates';
import { SIZE_BOUNDS } from '@insights/domain/services/run-size';
import { rateOfScore } from '@insights/infrastructure/persistence/drizzle/readers/insights/judge-rate.sql';
import {
  counted,
  endedIn,
  type GroupColumns,
  groupCountsOf,
  inEndOrder,
  measuredColumns,
  onTeam,
  ran,
  type StationRow,
  stationsInEndOrder,
  tallyColumns,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  runFact,
  score,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface AgentConfigRow extends GroupColumns, Record<string, unknown> {
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

const sizedBy = (count: SQL, field: 'maxLines' | 'maxSteps'): SQL => {
  const bounded = SIZE_BOUNDS.flatMap((bound) => {
    const limit = bound[field];

    return limit === null
      ? []
      : [sql`when ${count} <= ${limit} then ${bound.size}`];
  });
  const open = SIZE_BOUNDS.find((bound) => bound[field] === null);

  return sql`case ${sql.join(bounded, sql` `)} else ${open?.size ?? 'large'} end`;
};

const sizeOfRun = sql`case
  when not ${runFact.usageRecorded} then null
  when ${runFact.changedLines} > 0 then ${sizedBy(sql`${runFact.changedLines}`, 'maxLines')}
  else ${sizedBy(sql`${runFact.steps}`, 'maxSteps')}
end`;

const endedFor = (team: TeamInPeriod, filter: AgentConfigFilter): SQL => {
  const { current } = team.period;

  return sql`
    select ${runFact}.* from ${runFact}
    where ${onTeam(team)}
      and ${endedIn(current.from, current.to)}
      ${filter.stationId === null ? sql`` : sql`and ${runFact.stationId} = ${filter.stationId}`}
      ${filter.size === null ? sql`` : sql`and ${sizeOfRun} = ${filter.size}`}`;
};

const agentConfigColumns = sql`${runFact.harness}, ${runFact.model}, ${runFact.effort}, ${runFact.profileKey}`;

const inAgentConfigOrder = sql`
  ${runFact.harness} collate "C",
  ${runFact.model} collate "C" nulls first,
  ${runFact.effort} collate "C" nulls first,
  ${runFact.profileKey} collate "C" nulls first`;

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: AgentConfigFilter,
): Promise<readonly StationRow[]> => {
  const result = await db.execute<StationRow>(
    stationsInEndOrder(endedFor(team, filter)),
  );

  return result.rows;
};

const agentConfigsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: AgentConfigFilter,
): Promise<readonly AgentConfigRow[]> => {
  const result = await db.execute<AgentConfigRow>(sql`
    select
      ${runFact.harness} as harness,
      ${runFact.model} as model,
      ${runFact.effort} as effort,
      ${runFact.profileKey} as profile_key,
      ${tallyColumns},
      ${measuredColumns},
      ${counted(sql`${ran} and (${runFact.firstHumanAction} is not null or ${runFact.passedTo} is not null)`)} as answered
    from (${endedFor(team, filter)}) as ${runFact}
    where ${ran}
    group by ${agentConfigColumns}
    order by ${inAgentConfigOrder}
  `);

  return result.rows;
};

const rubricsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: AgentConfigFilter,
  stationId: string,
): Promise<readonly RubricRow[]> => {
  const result = await db.execute<RubricRow>(sql`
    select
      ${runFact.harness} as harness,
      ${runFact.model} as model,
      ${runFact.effort} as effort,
      ${runFact.profileKey} as profile_key,
      ${score.rubricVersion} as rubric_version,
      sum(${rateOfScore} order by ${inEndOrder})::float8 as sum,
      count(*)::int as judged
    from (${endedFor(team, filter)}) as ${runFact}
    join ${score}
      on ${score.runId} = ${runFact.runId}
      and ${score.source} = 'judge'
      and ${score.rubricVersion} is not null
      and ${score.stationId} = ${stationId}
    where ${ran}
    group by ${agentConfigColumns}, ${score.rubricVersion}
    order by ${inAgentConfigOrder}, ${score.rubricVersion} collate "C"
  `);

  return result.rows;
};

const sameAgentConfig = (
  row: RubricRow,
  agentConfig: AgentConfigRow,
): boolean =>
  row.harness === agentConfig.harness &&
  row.model === agentConfig.model &&
  row.effort === agentConfig.effort &&
  row.profile_key === agentConfig.profile_key;

export const agentConfigCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  filter: AgentConfigFilter,
): Promise<AgentConfigComparisonCounts> => {
  const stations = await stationsIn(db, team, filter);
  const agentConfigs = await agentConfigsIn(db, team, filter);
  const rubrics =
    filter.stationId === null
      ? []
      : await rubricsIn(db, team, filter, filter.stationId);

  return {
    stations: stations.map((row) => ({
      lineId: row.line_id,
      stationId: row.station_id,
    })),
    agentConfigs: agentConfigs.map(
      (row): AgentConfigCounts => ({
        harness: row.harness,
        model: row.model,
        effort: row.effort,
        profileKey: row.profile_key,
        counts: groupCountsOf(row),
        answered: row.answered,
        rubrics: rubrics
          .filter((each) => sameAgentConfig(each, row))
          .map(
            (each): RubricRates => ({
              rubricVersion: each.rubric_version,
              sum: each.sum,
              judged: each.judged,
            }),
          ),
      }),
    ),
  };
};
