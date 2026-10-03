import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_OUTCOMES = ['win', 'loss', 'tie'] as const;

export type PairOutcome = (typeof PAIR_OUTCOMES)[number];

export const UNPAIRED_BECAUSE = [
  'unavailable',
  'unreadable-rubric',
  'no-evidence',
  'refused',
  'unreadable',
  'ungrounded',
  'errored',
  'interrupted',
  'other-rubric',
  'budget',
] as const;

export type Unpaired = (typeof UNPAIRED_BECAUSE)[number];

const unpairedOf = (why: string): Unpaired => {
  const known = UNPAIRED_BECAUSE.find((each) => each === why);

  if (!known) {
    throw new InvalidReplayError(
      `side-by-side judging failed in a way nobody knows (${why})`,
    );
  }

  return known;
};

const isOutcome = (raw: string): raw is PairOutcome =>
  (PAIR_OUTCOMES as readonly string[]).includes(raw);

const OUTCOME_OF_WINNER: Readonly<Record<string, PairOutcome>> = {
  run: 'win',
  against: 'loss',
  tie: 'tie',
};

const outcomeOfWinner = (winner: string): PairOutcome => {
  const outcome = OUTCOME_OF_WINNER[winner];

  if (!outcome) {
    throw new InvalidReplayError(
      `side-by-side verdict names its run, the other or a tie as winner, not ${winner}`,
    );
  }

  return outcome;
};

const READINGS = 2;

export interface PairReason {
  readonly text: string;
  readonly ownHunks: readonly string[];
  readonly theirHunks: readonly string[];
}

export interface PairReading {
  readonly ownShownFirst: boolean;
  readonly outcome: PairOutcome;
  readonly reasons: readonly PairReason[];
}

export class PairVerdict {
  private constructor(
    readonly outcome: PairOutcome,
    readonly model: string,
    readonly readings: readonly PairReading[],
  ) {}

  static of(input: {
    outcome: string;
    model: string;
    readings: readonly {
      readonly ownShownFirst: boolean;
      readonly outcome: string;
      readonly reasons: readonly PairReason[];
    }[];
  }): PairVerdict {
    const outcomes = [
      input.outcome,
      ...input.readings.map((each) => each.outcome),
    ];

    if (!outcomes.every(isOutcome)) {
      throw new InvalidReplayError(
        `side-by-side verdict is a win, a loss or a tie, not ${outcomes.join(', ')}`,
      );
    }

    const [first, second] = input.readings;

    if (
      !first ||
      !second ||
      input.readings.length !== READINGS ||
      first.ownShownFirst === second.ownShownFirst ||
      input.outcome !==
        (first.outcome === second.outcome ? first.outcome : 'tie')
    ) {
      throw new InvalidReplayError(
        'side-by-side verdict reads the two changes both ways round, and is a tie where the two readings disagree',
      );
    }

    return new PairVerdict(
      input.outcome as PairOutcome,
      input.model,
      input.readings.map((each) => ({
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
    readings: readonly {
      readonly runShownFirst: boolean;
      readonly winner: string;
      readonly reasons: readonly {
        readonly text: string;
        readonly runHunks: readonly string[];
        readonly againstHunks: readonly string[];
      }[];
    }[];
  }): PairVerdict {
    return PairVerdict.of({
      outcome: outcomeOfWinner(input.winner),
      model: input.model,
      readings: input.readings.map((reading) => ({
        ownShownFirst: reading.runShownFirst,
        outcome: outcomeOfWinner(reading.winner),
        reasons: reading.reasons.map((each) => ({
          text: each.text,
          ownHunks: each.runHunks,
          theirHunks: each.againstHunks,
        })),
      })),
    });
  }

  equals(other: PairVerdict): boolean {
    return (
      this.outcome === other.outcome &&
      this.model === other.model &&
      JSON.stringify(this.readings) === JSON.stringify(other.readings)
    );
  }
}

export class EntryPairing {
  private constructor(
    readonly against: RunId,
    readonly verdict: PairVerdict | null,
    readonly unpaired: Unpaired | null,
  ) {}

  static asked(against: RunId): EntryPairing {
    return new EntryPairing(against, null, null);
  }

  static rehydrate(input: {
    against: RunId;
    verdict: PairVerdict | null;
    unpaired: string | null;
  }): EntryPairing {
    if (input.verdict !== null && input.unpaired !== null) {
      throw new InvalidReplayError(
        'entry is either compared side by side or not, never both',
      );
    }

    return new EntryPairing(
      input.against,
      input.verdict,
      input.unpaired === null ? null : unpairedOf(input.unpaired),
    );
  }

  get pending(): boolean {
    return this.verdict === null && this.unpaired === null;
  }

  isAgainst(run: RunId): boolean {
    return this.against.equals(run);
  }

  judged(verdict: PairVerdict): EntryPairing {
    return this.pending ? new EntryPairing(this.against, verdict, null) : this;
  }

  failed(why: string): EntryPairing {
    return this.pending
      ? new EntryPairing(this.against, null, unpairedOf(why))
      : this;
  }

  equals(other: EntryPairing): boolean {
    return (
      this.against.equals(other.against) &&
      this.unpaired === other.unpaired &&
      (this.verdict === null
        ? other.verdict === null
        : other.verdict !== null && this.verdict.equals(other.verdict))
    );
  }
}
