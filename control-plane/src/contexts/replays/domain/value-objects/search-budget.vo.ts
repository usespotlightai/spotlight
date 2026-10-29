import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { baselineTermsOf } from '@replays/domain/services/baseline-terms';
import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { MAX_REPEATS } from '@replays/domain/value-objects/replay-repeats';

export const MAX_ITERATIONS = 10;

export const MAX_PER_ITERATION = 5;

export const MAX_CONCURRENCY = 10;

export const SEARCH_CONCURRENCY = 4;

export const AUTOMATIC_ITERATIONS = 3;

export const AUTOMATIC_PER_ITERATION = 2;

const AGENT_SLACK = { parts: 1, of: 10 } as const;

const MIN_RUN = 0.01;

export interface SearchCeilingSplit {
  readonly perRun: Money;
  readonly seed: Money;
  readonly oracle: Money;
  readonly searchReplay: Money;
  readonly heldOutReplay: Money;
  readonly heldOutReserve: Money;
  readonly agentRuns: Money;
  readonly agentRun: Money;
  readonly iteration: Money;
}

const counted = (value: number, max: number, what: string, min = 1): number => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidSearchError(`${what} must be from ${min} to ${max}`);
  }

  return value;
};

export class SearchBudget {
  private constructor(
    readonly iterations: number,
    readonly perIteration: number,
    readonly ceiling: Money,
    readonly concurrency: number,
    readonly repeats: number,
  ) {}

  static of(input: {
    iterations: number;
    perIteration: number;
    ceiling: Money;
    concurrency?: number;
    repeats?: number;
  }): SearchBudget {
    return new SearchBudget(
      counted(input.iterations, MAX_ITERATIONS, 'iterations'),
      counted(
        input.perIteration,
        MAX_PER_ITERATION,
        'candidates per iteration',
      ),
      Money.ceiling(input.ceiling.amount, input.ceiling.currency),
      counted(
        input.concurrency ?? SEARCH_CONCURRENCY,
        MAX_CONCURRENCY,
        'concurrency',
      ),
      counted(input.repeats ?? 1, MAX_REPEATS, 'repeats'),
    );
  }

  static automatic(input: {
    ceiling: Money;
    iterations: number | null;
    repeats: number | null;
  }): SearchBudget {
    return SearchBudget.of({
      iterations: input.iterations ?? AUTOMATIC_ITERATIONS,
      perIteration: AUTOMATIC_PER_ITERATION,
      ceiling: input.ceiling,
      ...(input.repeats === null ? {} : { repeats: input.repeats }),
    });
  }

  seedRepeats(calibrates: boolean): number {
    return baselineTermsOf(calibrates, this.repeats, this.ceiling).repeats;
  }

  affords(split: HeldOutSplit, calibrates: boolean): boolean {
    try {
      this.splitCeiling(split, calibrates);
      return true;
    } catch (error) {
      if (error instanceof InvalidSearchError) {
        return false;
      }
      throw error;
    }
  }

  splitCeiling(split: HeldOutSplit, calibrates: boolean): SearchCeilingSplit {
    const seeded = split.runs * this.seedRepeats(calibrates);
    const answered = calibrates ? seeded : 0;
    const searched = split.searched.length * this.repeats;
    const heldOut = split.heldOut.length * this.repeats;
    const k = this.perIteration;
    const margin = (runs: number) => Math.min(this.concurrency, runs);
    const agentRuns = this.ceiling.scaled(AGENT_SLACK.parts, AGENT_SLACK.of);
    const pool = this.ceiling.scaled(
      AGENT_SLACK.of - AGENT_SLACK.parts,
      AGENT_SLACK.of,
    );
    const units =
      this.unitsFor(split.searched.length, split.heldOut.length) -
      split.runs * this.repeats -
      margin(split.runs * this.repeats) +
      seeded +
      margin(seeded) +
      answered +
      margin(answered);
    const perRun = pool.scaled(1, units);

    if (perRun.amount < MIN_RUN) {
      throw new InvalidSearchError(
        `ceiling must allow at least ${MIN_RUN} ${this.ceiling.currency} for each replay run. Please raise the ceiling, or lower the iterations or candidates per iteration`,
      );
    }

    const agentRun = agentRuns.scaled(1, this.iterations);

    return {
      perRun,
      seed: perRun.scaled(seeded, 1),
      oracle: perRun.scaled(answered, 1),
      searchReplay: perRun.scaled(searched, 1),
      heldOutReplay: perRun.scaled(heldOut, 1),
      heldOutReserve: perRun.scaled(k * (heldOut + margin(heldOut)), 1),
      agentRuns,
      agentRun,
      iteration: perRun
        .scaled(k * (searched + margin(searched)), 1)
        .plus(agentRun),
    };
  }

  unitsFor(searchedRuns: number, heldOutRuns: number): number {
    const margin = (runs: number) => Math.min(this.concurrency, runs);
    const searched = searchedRuns * this.repeats;
    const heldOut = heldOutRuns * this.repeats;
    const total = searched + heldOut;
    const k = this.perIteration;

    return (
      total +
      margin(total) +
      this.iterations * k * (searched + margin(searched)) +
      k * (heldOut + margin(heldOut))
    );
  }

  allowsIteration(
    spent: Money,
    split: HeldOutSplit,
    calibrates: boolean,
  ): boolean {
    const ceilingSplit = this.splitCeiling(split, calibrates);

    return spent
      .plus(ceilingSplit.oracle)
      .plus(ceilingSplit.heldOutReserve)
      .plus(ceilingSplit.iteration)
      .isWithin(this.ceiling);
  }

  equals(other: SearchBudget): boolean {
    return (
      this.iterations === other.iterations &&
      this.perIteration === other.perIteration &&
      this.ceiling.equals(other.ceiling) &&
      this.concurrency === other.concurrency &&
      this.repeats === other.repeats
    );
  }
}
