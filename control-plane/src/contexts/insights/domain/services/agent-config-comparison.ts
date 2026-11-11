import { type GroupCounts } from '@insights/domain/services/change-verdict';
import {
  type JudgeRate,
  judgeRateFrom,
  type RubricRates,
} from '@insights/domain/services/judge-rates';
import { rateOf } from '@insights/domain/services/measures';
import { paretoFrontier } from '@insights/domain/services/pareto';
import { type RunTally, tallyOf } from '@insights/domain/services/run-tally';
import type { StationLocation } from '@insights/domain/services/station-ranking';

export const OUTCOME_MEASURES = [
  'accepted',
  'sent_back',
  'passed',
  'checks_passed',
  'merged',
  'judge',
] as const;

type OutcomeMeasure = (typeof OUTCOME_MEASURES)[number];

const LOWER_IS_BETTER: ReadonlySet<OutcomeMeasure> = new Set(['sent_back']);

export const MIN_AGENT_CONFIG_RUNS = 3;

export const JUDGE_OMITTED_REASONS = ['no_station'] as const;

export type JudgeOmittedReason = (typeof JUDGE_OMITTED_REASONS)[number];

export const judgeOmittedFor = (
  stationId: string | null,
): JudgeOmittedReason | null => (stationId === null ? 'no_station' : null);

interface AgentConfig {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
}

export interface AgentConfigOutcome extends AgentConfig {
  readonly tally: RunTally;
  readonly costPerRun: number | null;
  readonly currency: string | null;
  readonly priced: boolean;
  readonly outcomes: Readonly<Record<OutcomeMeasure, number | null>>;
  readonly judge: JudgeRate | null;
  readonly frontier: readonly OutcomeMeasure[];
}

export interface AgentConfigComparison {
  readonly currency: string | null;
  readonly agentConfigs: readonly AgentConfigOutcome[];
}

const keyOf = (agentConfig: AgentConfig): string =>
  JSON.stringify([
    agentConfig.harness,
    agentConfig.model,
    agentConfig.effort,
    agentConfig.profileKey,
  ]);

export interface AgentConfigCounts extends AgentConfig {
  readonly counts: GroupCounts;
  readonly answered: number;
  readonly rubrics: readonly RubricRates[];
}

export interface AgentConfigComparisonCounts {
  readonly stations: readonly StationLocation[];
  readonly agentConfigs: readonly AgentConfigCounts[];
}

const outcomesOf = (
  tally: RunTally,
  { counts, answered }: AgentConfigCounts,
  judge: JudgeRate | null,
): Record<OutcomeMeasure, number | null> => ({
  accepted: rateOf(tally.resolutions.accepted, counts.measured.decided),
  sent_back: rateOf(tally.resolutions.sentBack, counts.measured.decided),
  passed: rateOf(tally.passed, answered),
  checks_passed: rateOf(
    tally.checksPassed,
    tally.checksPassed + tally.checksFailed,
  ),
  merged: rateOf(tally.merged, counts.measured.finishedTasks),
  judge: judge?.mean ?? null,
});

const mostUsed = (currencies: readonly string[]): string | null => {
  const counted = new Map<string, number>();

  for (const each of currencies) {
    counted.set(each, (counted.get(each) ?? 0) + 1);
  }

  return (
    [...counted.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? null
  );
};

export type AgentConfigJudging =
  | { readonly omitted: true }
  | { readonly omitted: false; readonly qualified: string | null };

export const agentConfigsFrom = (
  agentConfigs: readonly AgentConfigCounts[],
  judging: AgentConfigJudging,
): AgentConfigComparison => {
  const measured = agentConfigs.map((each) => {
    const tally = tallyOf(each.counts.tally);
    const judge = judging.omitted
      ? null
      : judgeRateFrom(each.rubrics, judging.qualified);
    const agentConfig: AgentConfig = {
      harness: each.harness,
      model: each.model,
      effort: each.effort,
      profileKey: each.profileKey,
    };

    return {
      key: keyOf(agentConfig),
      agentConfig,
      tally,
      costPerRun: tally.cost
        ? rateOf(tally.cost.amount, tally.runs - tally.unpriced)
        : null,
      currency: tally.cost?.currency ?? null,
      judge,
      outcomes: outcomesOf(tally, each, judge),
    };
  });

  const currency = mostUsed(
    measured.flatMap((each) => (each.currency ? [each.currency] : [])),
  );
  const frontiers = new Map(
    OUTCOME_MEASURES.map((measure) => [
      measure,
      paretoFrontier(
        measured.flatMap((each) => {
          const value = each.outcomes[measure];

          return each.tally.runs >= MIN_AGENT_CONFIG_RUNS &&
            each.costPerRun !== null &&
            each.currency === currency &&
            value !== null
            ? [{ id: each.key, cost: each.costPerRun, value }]
            : [];
        }),
        !LOWER_IS_BETTER.has(measure),
      ),
    ]),
  );

  return {
    currency,
    agentConfigs: measured
      .map((each) => ({
        ...each.agentConfig,
        tally: each.tally,
        costPerRun: each.costPerRun,
        currency: each.currency,
        priced: each.costPerRun !== null && each.currency === currency,
        outcomes: each.outcomes,
        judge: each.judge,
        frontier: OUTCOME_MEASURES.filter((measure) =>
          frontiers.get(measure)?.has(each.key),
        ),
      }))
      .sort(
        (a, b) =>
          b.tally.runs - a.tally.runs || keyOf(a).localeCompare(keyOf(b)),
      ),
  };
};
