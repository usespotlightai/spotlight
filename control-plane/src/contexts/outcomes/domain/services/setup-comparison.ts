import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  type GroupCounts,
  groupCountsOf,
} from '@outcomes/domain/services/change-verdict';
import {
  type JudgedRun,
  type JudgeShare,
  judgedByRun,
  judgeShareFrom,
  type RubricShares,
  rubricsOf,
} from '@outcomes/domain/services/judge-shares';
import { byText, rateOf } from '@outcomes/domain/services/measures';
import { paretoFrontier } from '@outcomes/domain/services/pareto';
import { type RunSize, sizeOf } from '@outcomes/domain/services/run-size';
import { type RunTally, tallyOf } from '@outcomes/domain/services/run-tally';
import {
  endedWithin,
  type StationPlace,
  stationsOf,
} from '@outcomes/domain/services/team-history';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';

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

export interface SetupCounts extends Setup {
  readonly counts: GroupCounts;
  readonly answered: number;
  readonly rubrics: readonly RubricShares[];
}

export interface SetupComparisonCounts {
  readonly stations: readonly StationPlace[];
  readonly setups: readonly SetupCounts[];
}

const nullsFirst = (one: string | null, other: string | null): number =>
  one === null || other === null
    ? Number(other === null) - Number(one === null)
    : byText(one, other);

const inSetupOrder = (one: Setup, other: Setup): number =>
  byText(one.harness, other.harness) ||
  nullsFirst(one.model, other.model) ||
  nullsFirst(one.effort, other.effort) ||
  nullsFirst(one.profileKey, other.profileKey);

export const setupRunsWithin = (
  records: readonly RunRecord[],
  window: Window,
  stationId: string | null,
  size: RunSize | null,
): readonly RunRecord[] =>
  endedWithin(records, window).filter(
    (each) =>
      (stationId === null || each.end?.place.stationId === stationId) &&
      (size === null || sizeOf(each) === size),
  );

export const setupCountsOf = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
  judged: readonly JudgedRun[],
): SetupComparisonCounts => {
  const groups = new Map<string, { setup: Setup; records: RunRecord[] }>();
  const byRun = judgedByRun(judged);

  for (const record of records.filter((each) => each.ran)) {
    const setup = setupOf(record);

    if (setup) {
      const key = keyOf(setup);
      const group = groups.get(key) ?? { setup, records: [] };

      group.records.push(record);
      groups.set(key, group);
    }
  }

  return {
    stations: stationsOf(records),
    setups: [...groups.values()]
      .map(
        (group): SetupCounts => ({
          ...group.setup,
          counts: groupCountsOf(group.records, deliveries),
          answered: group.records.filter(
            (each) => each.next !== null || each.handedOn !== null,
          ).length,
          rubrics: rubricsOf(group.records, byRun),
        }),
      )
      .sort(inSetupOrder),
  };
};

const outcomesOf = (
  tally: RunTally,
  { counts, answered }: SetupCounts,
  judge: JudgeShare | null,
): Record<OutcomeMeasure, number | null> => ({
  accepted: rateOf(tally.accepted, counts.settled.acted),
  sent_back: rateOf(tally.sentBack, counts.settled.acted),
  handed_on: rateOf(tally.handedOn, answered),
  checks_passed: rateOf(
    tally.checksPassed,
    tally.checksPassed + tally.checksFailed,
  ),
  merged: rateOf(tally.merged, counts.settled.finishedTasks),
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

export type SetupJudging =
  | { readonly withheld: true }
  | { readonly withheld: false; readonly trusted: string | null };

export const setupsFrom = (
  setups: readonly SetupCounts[],
  judging: SetupJudging,
): SetupComparison => {
  const measured = setups.map((each) => {
    const tally = tallyOf(each.counts.tally);
    const judge = judging.withheld
      ? null
      : judgeShareFrom(each.rubrics, judging.trusted);
    const setup: Setup = {
      harness: each.harness,
      model: each.model,
      effort: each.effort,
      profileKey: each.profileKey,
    };

    return {
      key: keyOf(setup),
      setup,
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
