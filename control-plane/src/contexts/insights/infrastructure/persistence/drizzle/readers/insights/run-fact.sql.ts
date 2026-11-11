import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import type { GroupCounts } from '@insights/domain/services/change-verdict';
import type { TallyCounts } from '@insights/domain/services/run-tally';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';
import type { RunResolution } from '@insights/domain/value-objects/run-resolution';
import { runFact } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { type SQL, sql } from 'drizzle-orm';

export const iso = (at: Date): string => at.toISOString();

export const asUtc = (at: Date): SQL => sql`${iso(at)}::timestamptz`;

export const inEndOrder = sql`${runFact.endedAt}, ${runFact.runId} collate "C"`;

export const ran = sql`${runFact.ran}`;

export const priced = sql`${ran} and ${runFact.cost} is not null and coalesce(${runFact.currency}, '') <> ''`;

export const withResolution = (resolution: RunResolution): SQL =>
  sql`${ran} and ${runFact.resolution} = ${resolution}`;

export const textArray = (values: readonly string[]): SQL =>
  sql`array[${sql.join(
    values.map((each) => sql`${each}`),
    sql`, `,
  )}]::text[]`;

export const atWithin = (at: SQL, window: Window): SQL =>
  sql`(${at} >= ${asUtc(window.from)} and ${at} < ${asUtc(window.to)})`;

export const inLastActionOrder = (taskId: SQL, lastActionAt: SQL): SQL =>
  sql`array_agg(${taskId} order by ${lastActionAt} desc, ${taskId} desc)`;

export const counted = (when: SQL): SQL =>
  sql`count(*) filter (where ${when})::int`;

export const onTeam = ({ workspaceId, teamId }: TeamInPeriod): SQL =>
  sql`${runFact.workspaceId} = ${workspaceId.value} and ${runFact.teamId} = ${teamId.value}`;

export const endedIn = (from: Date, to: Date): SQL =>
  sql`${runFact.endedAt} >= ${iso(from)}::timestamptz and ${runFact.endedAt} < ${iso(to)}::timestamptz`;

export const msOf = (column: SQL): SQL =>
  sql`(extract(epoch from ${column}) * 1000)::float8`;

export const dateOf = (ms: number | null): Date | null =>
  ms === null ? null : new Date(ms);

const percentileOver = (percent: number, ms: SQL, when: SQL): SQL =>
  sql`(percentile_disc(${sql.raw(String(percent / 100))}) within group (order by ${ms}) filter (where ${when}))::float8`;

const medianOver = (ms: SQL, when: SQL): SQL =>
  sql`floor(percentile_cont(0.5) within group (order by ${ms}) filter (where ${when}) + 0.5)`;

export const isCurrent = sql.raw('"run_fact"."is_current"');

export const day = sql.raw('"run_fact"."day"');

export const periodFacts = (team: TeamInPeriod): SQL => {
  const { current, previous } = team.period;

  return sql`
    select
      ${runFact}.*,
      ${runFact.endedAt} >= ${iso(current.from)}::timestamptz as is_current,
      to_char(${runFact.endedAt} at time zone 'UTC', 'YYYY-MM-DD') as day
    from ${runFact}
    where ${onTeam(team)} and ${endedIn(previous.from, current.to)}`;
};

export const factsInPeriod = (team: TeamInPeriod): SQL =>
  sql`(${periodFacts(team)}) as ${runFact}`;

export interface StationRow extends Record<string, unknown> {
  readonly part: boolean;
  readonly station_id: string;
  readonly line_id: string;
}

export const stationsInEndOrder = (facts: SQL, part?: SQL): SQL => {
  const parted = part ? sql`${part}, ` : sql``;

  return sql`
    select part, station_id, line_id from (
      select distinct on (${parted}${runFact.stationId})
        ${part ?? sql`true`} as part,
        ${runFact.stationId} as station_id,
        ${runFact.lineId} as line_id,
        ${runFact.endedAt} as ended_at,
        ${runFact.runId} as run_id
      from (${facts}) as ${runFact}
      order by ${parted}${runFact.stationId}, ${inEndOrder}
    ) as first
    order by ${part ? sql`part, ` : sql``}ended_at, run_id collate "C"`;
};

export const spendColumns = sql`
  sum(${runFact.cost}::float8 order by ${inEndOrder}) filter (where ${priced}) as amount,
  min(${runFact.currency}) filter (where ${priced}) as currency,
  count(distinct ${runFact.currency}) filter (where ${priced})::int as currencies,
  ${counted(sql`${ran} and not (${priced})`)} as unpriced`;

export interface SpendRow {
  readonly amount: number | null;
  readonly currency: string | null;
  readonly currencies: number;
  readonly unpriced: number;
}

export const spendOf = (row: SpendRow): Money | null =>
  row.currencies === 1 && row.amount !== null && row.currency !== null
    ? { amount: row.amount, currency: row.currency }
    : null;

export const percentilesOver = (
  ms: SQL,
  when: SQL,
): SQL => sql`json_build_object(
  'p50', ${medianOver(ms, when)},
  'p75', ${percentileOver(75, ms, when)},
  'p90', ${percentileOver(90, ms, when)},
  'p95', ${percentileOver(95, ms, when)},
  'count', count(${ms}) filter (where ${when})
)`;

export const spreadOver = (ms: SQL, when: SQL): SQL => sql`json_build_object(
  'p50', ${medianOver(ms, when)},
  'p90', ${percentileOver(90, ms, when)},
  'count', count(${ms}) filter (where ${when})
)`;

const timed = sql`${ran} and ${runFact.ms} is not null`;

export const tallyColumns = sql`
  ${counted(ran)} as runs,
  ${counted(sql`not ${ran}`)} as cancelled,
  ${counted(sql`${runFact.ending} = 'failed'`)} as failed,
  ${counted(sql`${runFact.ending} = 'stopped'`)} as stopped,
  ${counted(sql`${ran} and ${runFact.checks} = 'passed'`)} as checks_passed,
  ${counted(sql`${ran} and ${runFact.checks} = 'failed'`)} as checks_failed,
  ${counted(withResolution('accepted'))} as accepted,
  ${counted(withResolution('sent-back'))} as sent_back,
  ${counted(withResolution('moved-on'))} as moved_on,
  ${counted(withResolution('failed'))} as failed_resolution,
  ${counted(withResolution('other'))} as other_resolution,
  ${counted(sql`${ran} and ${runFact.passedTo} is not null`)} as passed,
  count(distinct ${runFact.taskId}) filter (where ${ran} and ${runFact.pullRequestState} = 'merged')::int as merged,
  ${spendColumns},
  ${medianOver(sql`${runFact.ms}`, timed)} as median_ms,
  ${percentileOver(90, sql`${runFact.ms}`, timed)} as p90_ms`;

export interface TallyColumns extends SpendRow {
  readonly runs: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly stopped: number;
  readonly checks_passed: number;
  readonly checks_failed: number;
  readonly accepted: number;
  readonly sent_back: number;
  readonly moved_on: number;
  readonly failed_resolution: number;
  readonly other_resolution: number;
  readonly passed: number;
  readonly merged: number;
  readonly median_ms: number | null;
  readonly p90_ms: number | null;
}

export const tallyCountsOf = (row: TallyColumns): TallyCounts => ({
  runs: row.runs,
  cancelled: row.cancelled,
  failed: row.failed,
  stopped: row.stopped,
  checksPassed: row.checks_passed,
  checksFailed: row.checks_failed,
  resolutions: {
    accepted: row.accepted,
    sentBack: row.sent_back,
    movedOn: row.moved_on,
    failed: row.failed_resolution,
    other: row.other_resolution,
  },
  passed: row.passed,
  merged: row.merged,
  cost: spendOf(row),
  unpriced: row.unpriced,
  mixedCurrencies: row.currencies > 1,
  medianMs: row.median_ms,
  p90Ms: row.p90_ms,
});

const finished = sql`${ran} and ${runFact.pullRequestState} is not null and ${runFact.pullRequestState} <> 'open'`;

export const measuredColumns = sql`
  ${counted(sql`${ran} and ${runFact.resolution} <> 'other'`)} as decided,
  ${counted(finished)} as finished,
  count(distinct ${runFact.taskId}) filter (where ${finished})::int as finished_tasks,
  ${counted(sql`${ran} and ${runFact.usageRecorded}`)} as usage_recorded`;

export interface GroupColumns extends TallyColumns {
  readonly decided: number;
  readonly finished: number;
  readonly finished_tasks: number;
  readonly usage_recorded: number;
}

export const groupCountsOfRow = (row: GroupColumns): GroupCounts => ({
  tally: tallyCountsOf(row),
  measured: {
    decided: row.decided,
    finished: row.finished,
    finishedTasks: row.finished_tasks,
    usageRecorded: row.usage_recorded,
  },
});
