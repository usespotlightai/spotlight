import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  type JudgeShare,
  judgeShareOf,
} from '@outcomes/domain/services/judge-shares';
import { rateOf, spendingOf } from '@outcomes/domain/services/measures';
import { paretoFrontier } from '@outcomes/domain/services/pareto';
import { type RunTally, runTally } from '@outcomes/domain/services/run-tally';
import { settledFor } from '@outcomes/domain/services/station-measures';
import { tasksOf } from '@outcomes/domain/services/team-history';

export const OUTCOME_MEASURES = [
  'accepted',
  'sent_back',
  'handed_on',
  'checks_passed',
  'merged',
  'judge',
] as const;

type OutcomeMeasure = (typeof OUTCOME_MEASURES)[number];

const LOWER_IS_BETTER: ReadonlySet<OutcomeMeasure> = new Set(['sent_back']);

export const FEWEST_SETUP_RUNS = 3;

export const JUDGE_WITHHELD_REASONS = ['no_station'] as const;

export type JudgeWithheld = (typeof JUDGE_WITHHELD_REASONS)[number];

export const judgeWithheldFrom = (
  stationId: string | null,
): JudgeWithheld | null => (stationId === null ? 'no_station' : null);

interface Setup {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
}

export interface SetupOutcome extends Setup {
  readonly tally: RunTally;
  readonly costPerRun: number | null;
  readonly currency: string | null;
  readonly priced: boolean;
  readonly outcomes: Readonly<Record<OutcomeMeasure, number | null>>;
  readonly judge: JudgeShare | null;
  readonly frontier: readonly OutcomeMeasure[];
}

export interface SetupComparison {
  readonly currency: string | null;
  readonly setups: readonly SetupOutcome[];
}

const keyOf = (setup: Setup): string =>
  JSON.stringify([setup.harness, setup.model, setup.effort, setup.profileKey]);

const setupOf = (record: RunRecord): Setup | null => {
  const setup = record.end?.setup;

  return setup
    ? {
        harness: setup.harness,
        model: setup.model,
        effort: setup.effort,
        profileKey: setup.profileKey,
      }
    : null;
};

const answered = (record: RunRecord): boolean =>
  record.next !== null || record.handedOn !== null;

const outcomesOf = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
  judge: JudgeShare | null,
): Record<OutcomeMeasure, number | null> => {
  const actedOn = records.filter(settledFor('accepted_rate', deliveries));
  const acted = runTally(actedOn, deliveries);
  const left = records.filter(answered);
  const checked = runTally(records, deliveries);
  const closed = records.filter(settledFor('merged_rate', deliveries));

  return {
    accepted: rateOf(acted.accepted, acted.runs),
    sent_back: rateOf(acted.sentBack, acted.runs),
    handed_on: rateOf(
      left.filter((each) => each.handedOn !== null).length,
      left.length,
    ),
    checks_passed: rateOf(
      checked.checksPassed,
      checked.checksPassed + checked.checksFailed,
    ),
    merged: rateOf(runTally(closed, deliveries).merged, tasksOf(closed).length),
    judge: judge?.mean ?? null,
  };
};

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

export const setupsCompared = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
  judgeShares: ReadonlyMap<string, number> | null,
): SetupComparison => {
  const groups = new Map<string, { setup: Setup; records: RunRecord[] }>();

  for (const record of records.filter((each) => each.ran)) {
    const setup = setupOf(record);

    if (!setup) {
      continue;
    }

    const key = keyOf(setup);
    const group = groups.get(key) ?? { setup, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }

  const measured = [...groups.entries()].map(([key, group]) => {
    const tally = runTally(group.records, deliveries);
    const spending = spendingOf(
      group.records.map((each) => each.cost?.spend ?? null),
    );
    const judge = judgeShares
      ? judgeShareOf(
          group.records.flatMap((each) => {
            const share = judgeShares.get(each.runId.value);
            return share === undefined ? [] : [share];
          }),
        )
      : null;

    return {
      key,
      setup: group.setup,
      tally,
      costPerRun: spending.spend
        ? rateOf(spending.spend.amount, spending.priced)
        : null,
      currency: spending.spend?.currency ?? null,
      judge,
      outcomes: outcomesOf(group.records, deliveries, judge),
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

          return each.tally.runs >= FEWEST_SETUP_RUNS &&
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
    setups: measured
      .map((each) => ({
        ...each.setup,
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
