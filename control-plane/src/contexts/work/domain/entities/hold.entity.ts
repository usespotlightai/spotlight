import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { CheckoutHead } from '@shared-kernel/domain/value-objects/checkout-head.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidHoldTransitionError } from '@work/domain/exceptions/invalid-hold-transition.error';
import { HoldRights, type HoldViewer } from '@work/domain/services/hold-rights';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { HoldEnd } from '@work/domain/value-objects/hold-end';
import type { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  type HoldVerdict,
  UNSAID_HOLD_VERDICT,
} from '@work/domain/value-objects/hold-verdict';
import type { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import type { Voice } from '@work/domain/value-objects/voice.vo';

interface HoldState {
  readonly id: HoldId;
  readonly by: UserId;
  readonly chat: ChatId | null;
  readonly stationId: StationId;
  readonly from: RunId | null;
  readonly verdict: HoldVerdict;
  readonly turns: readonly RunId[];
  readonly heldMove: StationId | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly end: HoldEnd | null;
  readonly fromHeads: readonly CheckoutHead[];
  readonly toHeads: readonly CheckoutHead[];
}

const problemOf = (state: HoldState): string | null => {
  if ((state.endedAt === null) !== (state.end === null)) {
    return 'ended without a resume, or has a resume while open';
  }

  if (state.endedAt && state.endedAt.getTime() < state.startedAt.getTime()) {
    return 'ended before it started';
  }

  if (state.endedAt && state.heldMove) {
    return 'holds a move after it ended';
  }

  if (state.heldMove?.equals(state.stationId) === true) {
    return 'holds a move to the station it is at';
  }

  if (
    !state.endedAt &&
    (state.fromHeads.length > 0 || state.toHeads.length > 0)
  ) {
    return 'has checkout heads while open';
  }

  if (!state.endedAt && state.verdict !== UNSAID_HOLD_VERDICT) {
    return 'is exploring while open';
  }

  if (state.chat && state.from) {
    return 'was put on hold for a chat but holds from a line run';
  }

  if (state.chat && state.endedAt && state.verdict !== 'exploring') {
    return 'was put on hold for a chat but counts against the line';
  }

  if (state.chat && state.turns.length > 0) {
    return 'was put on hold for a chat but counts turns of the task';
  }

  const from = state.from;

  if (from && state.turns.some((each) => each.equals(from))) {
    return 'counts the line run it held from as one of its turns';
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

export class Hold {
  private constructor(private readonly state: HoldState) {}

  static start(input: {
    id: HoldId;
    by: UserId;
    stationId: StationId;
    from: RunId | null;
    at: Date;
  }): Hold {
    return Hold.started({ ...input, chat: null });
  }

  static forChat(input: {
    id: HoldId;
    by: UserId;
    chat: ChatId;
    stationId: StationId;
    at: Date;
  }): Hold {
    return Hold.started({ ...input, from: null });
  }

  private static started(input: {
    id: HoldId;
    by: UserId;
    chat: ChatId | null;
    stationId: StationId;
    from: RunId | null;
    at: Date;
  }): Hold {
    return new Hold({
      id: input.id,
      by: input.by,
      chat: input.chat,
      stationId: input.stationId,
      from: input.from,
      verdict: UNSAID_HOLD_VERDICT,
      turns: [],
      heldMove: null,
      startedAt: input.at,
      endedAt: null,
      end: null,
      fromHeads: [],
      toHeads: [],
    });
  }

  static rehydrate(state: HoldState): Hold {
    const problem = problemOf(state);

    if (problem !== null && problem !== '') {
      throw new InconsistentStateError('hold', problem);
    }

    return new Hold(state);
  }

  get id(): HoldId {
    return this.state.id;
  }

  get by(): UserId {
    return this.state.by;
  }

  get chat(): ChatId | null {
    return this.state.chat;
  }

  get stationId(): StationId {
    return this.state.stationId;
  }

  get from(): RunId | null {
    return this.state.from;
  }

  get verdict(): HoldVerdict {
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

  get end(): HoldEnd | null {
    return this.state.end;
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

  countsTurn(runId: RunId): boolean {
    return this.state.turns.some((each) => each.equals(runId));
  }

  get takesTurns(): boolean {
    return HoldRights.takesTurns(this.state);
  }

  takesTurnsFrom(voice: Voice): boolean {
    return this.takesTurns && voice.isPerson && voice.author !== null;
  }

  endableBy(person: UserId): boolean {
    return HoldRights.endableBy(this.state, person);
  }

  drivenBy(viewer: HoldViewer): boolean {
    return HoldRights.drives(this.state, viewer);
  }

  withTurn(runId: RunId): Hold {
    this.assertOpen('take a turn');

    if (this.state.chat) {
      throw new InvalidHoldTransitionError(
        'for a chat cannot take a turn, because the chat does the work',
      );
    }

    if (this.state.from?.equals(runId) === true) {
      throw new InvalidHoldTransitionError(
        'cannot count the line run it held from as one of its turns',
      );
    }

    return this.countsTurn(runId)
      ? this
      : this.with({ turns: [...this.state.turns, runId] });
  }

  holdingMoveTo(to: StationId): Hold {
    this.assertOpen('hold a move');

    if (to.equals(this.state.stationId)) {
      throw new InvalidHoldTransitionError(
        'cannot hold a move to the station it is at',
      );
    }

    return this.with({ heldMove: to });
  }

  ended(input: {
    end: HoldEnd;
    verdict: HoldVerdict | null;
    turnHeads: readonly TurnHeads[];
    at: Date;
  }): Hold {
    this.assertOpen('end');

    if (input.at.getTime() < this.state.startedAt.getTime()) {
      throw new InvalidHoldTransitionError('cannot end before it started');
    }

    const verdict =
      input.verdict ?? (this.state.chat ? 'exploring' : this.state.verdict);

    if (this.state.chat && verdict !== 'exploring') {
      throw new InvalidHoldTransitionError(
        'for a chat cannot count against the line, because the line did no work on it',
      );
    }

    const inOrder = this.state.turns.flatMap((run) =>
      input.turnHeads.filter((each) => each.runId.equals(run)),
    );

    return this.with({
      end: input.end,
      verdict,
      fromHeads: firstPerCheckout(inOrder.flatMap((each) => each.started)),
      toHeads: lastPerCheckout(inOrder.flatMap((each) => each.ended)),
      heldMove: null,
      endedAt: input.at,
    });
  }

  equals(other: Hold): boolean {
    return this.state.id.equals(other.state.id);
  }

  private assertOpen(doing: string): void {
    if (!this.open) {
      throw new InvalidHoldTransitionError(`that has ended cannot ${doing}`);
    }
  }

  private with(part: Partial<HoldState>): Hold {
    return Hold.rehydrate({ ...this.state, ...part });
  }
}
