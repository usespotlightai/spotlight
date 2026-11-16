import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidTakeoverTransitionError } from '@work/domain/exceptions/invalid-takeover-transition.error';
import type { CheckoutHead } from '@work/domain/value-objects/checkout-head.vo';
import type { HandBack } from '@work/domain/value-objects/hand-back';
import type { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import {
  type TakeoverVerdict,
  UNSAID_TAKEOVER_VERDICT,
} from '@work/domain/value-objects/takeover-verdict';
import type { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';

interface TakeoverState {
  readonly id: TakeoverId;
  readonly by: UserId;
  readonly stationId: StationId;
  readonly from: RunId | null;
  readonly verdict: TakeoverVerdict;
  readonly turns: readonly RunId[];
  readonly heldMove: StationId | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly handBack: HandBack | null;
  readonly fromHeads: readonly CheckoutHead[];
  readonly toHeads: readonly CheckoutHead[];
}

const problemOf = (state: TakeoverState): string | null => {
  if ((state.endedAt === null) !== (state.handBack === null)) {
    return 'ended without a hand-back, or has a hand-back while open';
  }

  if (state.endedAt && state.endedAt.getTime() < state.startedAt.getTime()) {
    return 'ended before it started';
  }

  if (state.endedAt && state.heldMove) {
    return 'holds a move after it ended';
  }

  if (state.heldMove?.equals(state.stationId)) {
    return 'holds a move to the station it is at';
  }

  if (
    !state.endedAt &&
    (state.fromHeads.length > 0 || state.toHeads.length > 0)
  ) {
    return 'has checkout heads while open';
  }

  const from = state.from;

  if (from && state.turns.some((each) => each.equals(from))) {
    return 'counts the line run it took over from as one of its turns';
  }

  return null;
};

const lastPerCheckout = (
  heads: readonly CheckoutHead[],
): readonly CheckoutHead[] => [
  ...new Map(heads.map((each) => [each.path, each])).values(),
];

const firstPerCheckout = (
  heads: readonly CheckoutHead[],
): readonly CheckoutHead[] =>
  heads.filter(
    (each, index) =>
      heads.findIndex((other) => other.path === each.path) === index,
  );

export class Takeover {
  private constructor(private readonly state: TakeoverState) {}

  static start(input: {
    id: TakeoverId;
    by: UserId;
    stationId: StationId;
    from: RunId | null;
    verdict: TakeoverVerdict | null;
    at: Date;
  }): Takeover {
    return new Takeover({
      id: input.id,
      by: input.by,
      stationId: input.stationId,
      from: input.from,
      verdict: input.verdict ?? UNSAID_TAKEOVER_VERDICT,
      turns: [],
      heldMove: null,
      startedAt: input.at,
      endedAt: null,
      handBack: null,
      fromHeads: [],
      toHeads: [],
    });
  }

  static rehydrate(state: TakeoverState): Takeover {
    const problem = problemOf(state);

    if (problem) {
      throw new InconsistentStateError('takeover', problem);
    }

    return new Takeover(state);
  }

  get id(): TakeoverId {
    return this.state.id;
  }

  get by(): UserId {
    return this.state.by;
  }

  get stationId(): StationId {
    return this.state.stationId;
  }

  get from(): RunId | null {
    return this.state.from;
  }

  get verdict(): TakeoverVerdict {
    return this.state.verdict;
  }

  get turns(): readonly RunId[] {
    return this.state.turns;
  }

  get heldMove(): StationId | null {
    return this.state.heldMove;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get endedAt(): Date | null {
    return this.state.endedAt;
  }

  get handBack(): HandBack | null {
    return this.state.handBack;
  }

  get fromHeads(): readonly CheckoutHead[] {
    return this.state.fromHeads;
  }

  get toHeads(): readonly CheckoutHead[] {
    return this.state.toHeads;
  }

  get open(): boolean {
    return this.state.endedAt === null;
  }

  drives(runId: RunId): boolean {
    return this.state.turns.some((each) => each.equals(runId));
  }

  withTurn(runId: RunId): Takeover {
    this.assertOpen('take a turn');

    if (this.state.from?.equals(runId)) {
      throw new InvalidTakeoverTransitionError(
        'cannot count the line run it took over from as one of its turns',
      );
    }

    return this.drives(runId)
      ? this
      : this.with({ turns: [...this.state.turns, runId] });
  }

  holdingMoveTo(to: StationId): Takeover {
    this.assertOpen('hold a move');

    if (to.equals(this.state.stationId)) {
      throw new InvalidTakeoverTransitionError(
        'cannot hold a move to the station it is at',
      );
    }

    return this.with({ heldMove: to });
  }

  ended(input: {
    handBack: HandBack;
    verdict: TakeoverVerdict;
    turnHeads: readonly TurnHeads[];
    at: Date;
  }): Takeover {
    this.assertOpen('end');

    if (input.at.getTime() < this.state.startedAt.getTime()) {
      throw new InvalidTakeoverTransitionError('cannot end before it started');
    }

    const inOrder = this.state.turns.flatMap((run) =>
      input.turnHeads.filter((each) => each.runId.equals(run)),
    );

    return this.with({
      handBack: input.handBack,
      verdict: input.verdict,
      fromHeads: firstPerCheckout(inOrder.flatMap((each) => each.started)),
      toHeads: lastPerCheckout(inOrder.flatMap((each) => each.ended)),
      heldMove: null,
      endedAt: input.at,
    });
  }

  equals(other: Takeover): boolean {
    return this.state.id.equals(other.state.id);
  }

  private assertOpen(doing: string): void {
    if (!this.open) {
      throw new InvalidTakeoverTransitionError(
        `that has ended cannot ${doing}`,
      );
    }
  }

  private with(part: Partial<TakeoverState>): Takeover {
    return Takeover.rehydrate({ ...this.state, ...part });
  }
}
