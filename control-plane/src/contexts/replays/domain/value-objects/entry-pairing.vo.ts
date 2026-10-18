import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_OUTCOMES = ['win', 'loss', 'tie'] as const;

export type PairOutcome = (typeof PAIR_OUTCOMES)[number];

export const UNPAIRED_BECAUSE = [
  'unavailable',
  'unreadable-rubric',
  'no-evidence',
  'request-failed',
  'unreadable',
  'ungrounded',
  'errored',
  'interrupted',
  'other-rubric',
  'ceiling-reached',
] as const;

export type Unpaired = (typeof UNPAIRED_BECAUSE)[number];

const unpairedOf = (why: string): Unpaired => {
  const known = UNPAIRED_BECAUSE.find((each) => each === why);

  if (!known) {
    throw new InvalidReplayError(
      `side-by-side judging failed with unknown code ${why}`,
    );
  }

  return known;
};

const isOutcome = (raw: string): raw is PairOutcome =>
  (PAIR_OUTCOMES as readonly string[]).includes(raw);

const OUTCOME_OF_WINNER: Readonly<Record<string, PairOutcome>> = {
  run: 'win',
  other: 'loss',
  tie: 'tie',
};

const outcomeOfWinner = (winner: string): PairOutcome => {
  const outcome = OUTCOME_OF_WINNER[winner];

  if (!outcome) {
    throw new InvalidReplayError(
      `side-by-side winner must be its run, the other or a tie, not ${winner}`,
    );
  }

  return outcome;
};

const PASSES = 2;

export interface PairReason {
  readonly text: string;
  readonly ownHunks: readonly string[];
  readonly theirHunks: readonly string[];
}

export interface PairPass {
  readonly ownShownFirst: boolean;
  readonly outcome: PairOutcome;
  readonly reasons: readonly PairReason[];
}

export class PairVerdict {
  private constructor(
    readonly outcome: PairOutcome,
    readonly model: string,
    readonly passes: readonly PairPass[],
  ) {}

  static of(input: {
    outcome: string;
    model: string;
    passes: readonly {
      readonly ownShownFirst: boolean;
      readonly outcome: string;
      readonly reasons: readonly PairReason[];
    }[];
  }): PairVerdict {
    const outcomes = [
      input.outcome,
      ...input.passes.map((each) => each.outcome),
    ];

    if (!outcomes.every(isOutcome)) {
      throw new InvalidReplayError(
        `side-by-side verdict must be a win, loss or tie, not ${outcomes.join(', ')}`,
      );
    }

    const [first, second] = input.passes;

    if (
      !first ||
      !second ||
      input.passes.length !== PASSES ||
      first.ownShownFirst === second.ownShownFirst ||
      input.outcome !==
        (first.outcome === second.outcome ? first.outcome : 'tie')
    ) {
      throw new InvalidReplayError(
        'side-by-side verdict must be a tie when its two passes disagree',
      );
    }

    return new PairVerdict(
      input.outcome as PairOutcome,
      input.model,
      input.passes.map((each) => ({
        ownShownFirst: each.ownShownFirst,
        outcome: each.outcome as PairOutcome,
        reasons: each.reasons.map((reason) => ({
          text: reason.text,
          ownHunks: [...reason.ownHunks],
          theirHunks: [...reason.theirHunks],
        })),
      })),
    );
  }

  static fromWinner(input: {
    winner: string;
    model: string;
    passes: readonly {
      readonly runShownFirst: boolean;
      readonly winner: string;
      readonly reasons: readonly {
        readonly text: string;
        readonly runHunks: readonly string[];
        readonly otherHunks: readonly string[];
      }[];
    }[];
  }): PairVerdict {
    return PairVerdict.of({
      outcome: outcomeOfWinner(input.winner),
      model: input.model,
      passes: input.passes.map((pass) => ({
        ownShownFirst: pass.runShownFirst,
        outcome: outcomeOfWinner(pass.winner),
        reasons: pass.reasons.map((each) => ({
          text: each.text,
          ownHunks: each.runHunks,
          theirHunks: each.otherHunks,
        })),
      })),
    });
  }

  equals(other: PairVerdict): boolean {
    return (
      this.outcome === other.outcome &&
      this.model === other.model &&
      JSON.stringify(this.passes) === JSON.stringify(other.passes)
    );
  }
}

export class EntryPairing {
  private constructor(
    readonly otherRunId: RunId,
    readonly verdict: PairVerdict | null,
    readonly unpaired: Unpaired | null,
  ) {}

  static requested(otherRunId: RunId): EntryPairing {
    return new EntryPairing(otherRunId, null, null);
  }

  static rehydrate(input: {
    otherRunId: RunId;
    verdict: PairVerdict | null;
    unpaired: string | null;
  }): EntryPairing {
    if (input.verdict !== null && input.unpaired !== null) {
      throw new InvalidReplayError(
        'entry cannot be both compared side by side and not',
      );
    }

    return new EntryPairing(
      input.otherRunId,
      input.verdict,
      input.unpaired === null ? null : unpairedOf(input.unpaired),
    );
  }

  get pending(): boolean {
    return this.verdict === null && this.unpaired === null;
  }

  isAgainst(run: RunId): boolean {
    return this.otherRunId.equals(run);
  }

  judged(verdict: PairVerdict): EntryPairing {
    return this.pending
      ? new EntryPairing(this.otherRunId, verdict, null)
      : this;
  }

  failed(why: string): EntryPairing {
    return this.pending
      ? new EntryPairing(this.otherRunId, null, unpairedOf(why))
      : this;
  }

  equals(other: EntryPairing): boolean {
    return (
      this.otherRunId.equals(other.otherRunId) &&
      this.unpaired === other.unpaired &&
      (this.verdict === null
        ? other.verdict === null
        : other.verdict !== null && this.verdict.equals(other.verdict))
    );
  }
}
