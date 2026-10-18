import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import type {
  RunCount,
  ServerCounts,
  SkillUseCount,
  ToolCounts,
  ToolRefusals,
} from '@insights/domain/services/tool-insights';
import {
  endedIn,
  onTeam,
  ran,
  type StationRow,
  stationsInEndOrder,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { runFact } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface RunsRow extends Record<string, unknown> {
  readonly station_id: string | null;
  readonly week: string | null;
  readonly runs: number;
}

interface SkillRow extends Record<string, unknown> {
  readonly key: string;
  readonly station_id: string | null;
  readonly week: string | null;
  readonly enabled: number;
  readonly used: number;
}

interface ServerRow extends Record<string, unknown> {
  readonly server: string;
  readonly runs: number;
  readonly calls: number;
  readonly failed_calls: number;
  readonly latency: number[];
  readonly failing_runs: number;
  readonly refused: number;
}

interface RefusalRow extends Record<string, unknown> {
  readonly tool: string;
  readonly server: string | null;
  readonly refused: number;
}

const ranIn = (team: TeamInPeriod): SQL => {
  const { current } = team.period;

  return sql`
    select
      ${runFact}.*,
      to_char(date_trunc('week', ${runFact.endedAt}), 'YYYY-MM-DD') as week
    from ${runFact}
    where ${onTeam(team)} and ${endedIn(current.from, current.to)} and ${ran}`;
};

const inCountOrder = sql`station_id collate "C" nulls first, week collate "C" nulls first`;

const runsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RunsRow[]> => {
  const result = await db.execute<RunsRow>(sql`
    select station_id, week, count(*)::int as runs
    from (${ranIn(team)}) as ran
    group by grouping sets ((), (week), (station_id), (station_id, week))
    order by ${inCountOrder}
  `);

  return result.rows;
};

const skillsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly SkillRow[]> => {
  const result = await db.execute<SkillRow>(sql`
    with ran as (
      select
        ran.station_id,
        ran.week,
        ran.skills as enabled,
        coalesce(ran.tools->'skillsRead', '[]'::jsonb) as read
      from (${ranIn(team)}) as ran
    ), uses as (
      select
        ran.station_id,
        ran.week,
        skill.key,
        ran.enabled ? skill.key as enabled,
        ran.read ? skill.key as used
      from ran
      cross join lateral (
        select jsonb_array_elements_text(ran.enabled)
        union
        select jsonb_array_elements_text(ran.read)
      ) as skill(key)
    )
    select
      key,
      station_id,
      week,
      count(*) filter (where enabled)::int as enabled,
      count(*) filter (where used)::int as used
    from uses
    group by grouping sets ((key), (key, week), (key, station_id), (key, station_id, week))
    order by key collate "C", ${inCountOrder}
  `);

  return result.rows;
};

const serversIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly ServerRow[]> => {
  const result = await db.execute<ServerRow>(sql`
    with ran as (${ranIn(team)}),
    calls as (
      select
        call.value->>'server' as server,
        (call.value->>'calls')::bigint as calls,
        (call.value->>'failed')::bigint as failed,
        call.value->'latency' as latency,
        ran.ending = 'failed'
          and ran.superseded_at is null
          and (call.value->>'lastCallFailed')::boolean as failing
      from ran
      cross join lateral jsonb_array_elements(
        coalesce(ran.tools->'servers', '[]'::jsonb)
      ) as call(value)
    ),
    buckets as (
      select calls.server, bucket.position, sum(bucket.count::bigint) as count
      from calls
      cross join lateral jsonb_array_elements_text(calls.latency)
        with ordinality as bucket(count, position)
      group by calls.server, bucket.position
    ),
    refused as (
      select refusal.value->>'server' as server, count(distinct ran.run_id) as runs
      from ran
      cross join lateral jsonb_array_elements(ran.refusals) as refusal(value)
      group by refusal.value->>'server'
    )
    select
      calls.server,
      count(*)::int as runs,
      sum(calls.calls)::float8 as calls,
      sum(calls.failed)::float8 as failed_calls,
      count(*) filter (where calls.failing)::int as failing_runs,
      coalesce((
        select refused.runs from refused where refused.server = calls.server
      ), 0)::int as refused,
      (
        select array_agg(buckets.count::float8 order by buckets.position)
        from buckets
        where buckets.server = calls.server
      ) as latency
    from calls
    group by calls.server
    order by calls.server collate "C"
  `);

  return result.rows;
};

const refusalsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RefusalRow[]> => {
  const result = await db.execute<RefusalRow>(sql`
    select refused.tool, refused.server, count(distinct refused.run_id)::int as refused
    from (
      select
        ran.run_id,
        refusal.value->>'tool' as tool,
        refusal.value->>'server' as server
      from (${ranIn(team)}) as ran
      cross join lateral jsonb_array_elements(ran.refusals) as refusal(value)
    ) as refused
    group by refused.tool, refused.server
    order by refused.tool collate "C", refused.server collate "C" nulls first
  `);

  return result.rows;
};

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly StationRow[]> => {
  const result = await db.execute<StationRow>(stationsInEndOrder(ranIn(team)));

  return result.rows;
};

export const toolCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<ToolCounts> => {
  const runs = await runsIn(db, team);
  const stations = await stationsIn(db, team);
  const skills = await skillsIn(db, team);
  const servers = await serversIn(db, team);
  const refusals = await refusalsIn(db, team);

  return {
    runs: runs.map(
      (row): RunCount => ({
        stationId: row.station_id,
        week: row.week,
        runs: row.runs,
      }),
    ),
    stations: stations.map((row) => ({
      lineId: row.line_id,
      stationId: row.station_id,
    })),
    skills: skills.map(
      (row): SkillUseCount => ({
        key: row.key,
        stationId: row.station_id,
        week: row.week,
        enabled: row.enabled,
        used: row.used,
      }),
    ),
    servers: servers.map(
      (row): ServerCounts => ({
        server: row.server,
        runs: row.runs,
        calls: row.calls,
        failedCalls: row.failed_calls,
        latency: row.latency,
        failingRuns: row.failing_runs,
        refused: row.refused,
      }),
    ),
    refusals: refusals.map(
      (row): ToolRefusals => ({
        tool: row.tool,
        server: row.server,
        refused: row.refused,
      }),
    ),
  };
};
