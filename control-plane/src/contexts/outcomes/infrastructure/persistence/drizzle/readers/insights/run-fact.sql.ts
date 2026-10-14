import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';
import { runFact } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { type SQL, sql } from 'drizzle-orm';

export const iso = (at: Date): string => at.toISOString();

export const asUtc = (at: Date): SQL => sql`${iso(at)}::timestamptz`;

export const inEndOrder = sql`${runFact.endedAt}, ${runFact.runId} collate "C"`;

export const ran = sql`${runFact.ran}`;

export const priced = sql`${ran} and ${runFact.cost} is not null and coalesce(${runFact.currency}, '') <> ''`;

export const counted = (when: SQL): SQL =>
  sql`count(*) filter (where ${when})::int`;

export const onTeam = ({ workspaceId, teamId }: TeamInPeriod): SQL =>
  sql`${runFact.workspaceId} = ${workspaceId.value} and ${runFact.teamId} = ${teamId.value}`;

export const endedIn = (from: Date, to: Date): SQL =>
  sql`${runFact.endedAt} >= ${iso(from)}::timestamp and ${runFact.endedAt} < ${iso(to)}::timestamp`;

export const msOf = (column: SQL): SQL =>
  sql`(extract(epoch from ${column}) * 1000)::float8`;

export const dateOf = (ms: number | null): Date | null =>
  ms === null ? null : new Date(ms);

export const medianOver = (ms: SQL, when: SQL): SQL =>
  sql`round((percentile_cont(0.5) within group (order by ${ms}) filter (where ${when}))::numeric)::float8`;

export const p90Over = (ms: SQL, when: SQL): SQL =>
  sql`(percentile_disc(0.9) within group (order by ${ms}) filter (where ${when}))::float8`;

export const isCurrent = sql.raw('"run_fact"."is_current"');

export const day = sql.raw('"run_fact"."day"');

export const factsInPeriod = (team: TeamInPeriod): SQL => {
  const { current, previous } = team.period;

  return sql`(
    select
      ${runFact}.*,
      ${runFact.endedAt} >= ${iso(current.from)}::timestamp as is_current,
      to_char(${runFact.endedAt}, 'YYYY-MM-DD') as day
    from ${runFact}
    where ${onTeam(team)} and ${endedIn(previous.from, current.to)}
  ) as ${runFact}`;
};

export const spendColumns = sql`
  sum(${runFact.cost} order by ${inEndOrder}) filter (where ${priced}) as amount,
  min(${runFact.currency}) filter (where ${priced}) as currency,
  count(distinct ${runFact.currency}) filter (where ${priced})::int as currencies,
  ${counted(sql`${ran} and not (${priced})`)} as unpriced`;

export interface SpendRow {
  readonly amount: number | null;
  readonly currency: string | null;
  readonly currencies: number;
  readonly unpriced: number;
}

export const spendOf = (row: SpendRow): Spend | null =>
  row.currencies === 1 && row.amount !== null && row.currency !== null
    ? { amount: row.amount, currency: row.currency }
    : null;
