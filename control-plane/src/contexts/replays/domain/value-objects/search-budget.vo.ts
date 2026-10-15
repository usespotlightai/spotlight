import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { MOST_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import { Spend } from '@replays/domain/value-objects/spend.vo';

export const MOST_ITERATIONS = 10;

export const MOST_PER_ITERATION = 5;

export const MOST_CONCURRENCY = 10;

export const SEARCH_CONCURRENCY = 4;

const AGENT_SLACK = { parts: 1, of: 10 } as const;

const LEAST_RUN = 0.01;

export interface SearchAllotment {
  readonly perRun: Spend;
  readonly seed: Spend;
  readonly searchReplay: Spend;
  readonly heldOutReplay: Spend;
  readonly heldOutReserve: Spend;
  readonly agentRuns: Spend;
  readonly agentRun: Spend;
  readonly iteration: Spend;
}

const counted = (
  value: number,
  most: number,
  what: string,
  least = 1,
): number => {
  if (!Number.isInteger(value) || value < least || value > most) {
    throw new InvalidSearchError(`${what} must be from ${least} to ${most}`);
  }

  return value;
};

export class SearchBudget {
  private constructor(
    readonly iterations: number,
    readonly perIteration: number,
    readonly ceiling: Spend,
    readonly concurrency: number,
    readonly repeats: number,
  ) {}

  static of(input: {
    iterations: number;
    perIteration: number;
    ceiling: Spend;
    concurrency?: number;
    repeats?: number;
  }): SearchBudget {
    return new SearchBudget(
      counted(input.iterations, MOST_ITERATIONS, 'iterations'),
      counted(
        input.perIteration,
        MOST_PER_ITERATION,
        'candidates per iteration',
      ),
      Spend.ceiling(input.ceiling.amount, input.ceiling.currency),
      counted(
        input.concurrency ?? SEARCH_CONCURRENCY,
        MOST_CONCURRENCY,
        'concurrency',
      ),
      counted(input.repeats ?? 1, MOST_REPEATS, 'repeats'),
    );
  }

  allot(split: HeldOutSplit): SearchAllotment {
    const total = split.runs * this.repeats;
    const searched = split.searched.length * this.repeats;
    const heldOut = split.heldOut.length * this.repeats;
    const k = this.perIteration;
    const margin = (runs: number) => Math.min(this.concurrency, runs);
    const agentRuns = this.ceiling.scaled(AGENT_SLACK.parts, AGENT_SLACK.of);
    const pool = this.ceiling.scaled(
      AGENT_SLACK.of - AGENT_SLACK.parts,
      AGENT_SLACK.of,
    );
    const units = this.unitsFor(split.searched.length, split.heldOut.length);
    const perRun = pool.scaled(1, units);

    if (perRun.amount < LEAST_RUN) {
      throw new InvalidSearchError(
        `ceiling must allow at least ${LEAST_RUN} ${this.ceiling.currency} for each replay run. Please raise the ceiling, or lower the iterations or candidates per iteration`,
      );
    }

    const agentRun = agentRuns.scaled(1, this.iterations);

    return {
      perRun,
      seed: perRun.scaled(total, 1),
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

  allowsIteration(spent: Spend, split: HeldOutSplit): boolean {
    const allotted = this.allot(split);

    return spent
      .plus(allotted.heldOutReserve)
      .plus(allotted.iteration)
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
