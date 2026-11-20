import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidCheckoutHeadError } from '@shared-kernel/domain/exceptions/invalid-checkout-head.error';
import { CheckoutHead } from '@shared-kernel/domain/value-objects/checkout-head.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { Hold } from '@work/domain/entities/hold.entity';
import { InvalidHoldTransitionError } from '@work/domain/exceptions/invalid-hold-transition.error';
import { InvalidHoldError } from '@work/domain/exceptions/invalid-hold.error';
import { InvalidTurnHeadsError } from '@work/domain/exceptions/invalid-turn-heads.error';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { holdEndOf } from '@work/domain/value-objects/hold-end';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  holdVerdictOf,
  UNSAID_HOLD_VERDICT,
} from '@work/domain/value-objects/hold-verdict';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const LATER = new Date('2026-11-16T10:00:00.000Z');
const FROM = RunId.of('run_line');
const TURN = RunId.of('run_turn');

const started = () =>
  Hold.start({
    id: HoldId.of('hold_1'),
    by: UserId.of('user_leon'),
    stationId: StationId.of('station_build'),
    from: FROM,
    at: NOW,
  });

const head = CheckoutHead.of({
  path: '/workspace/app',
  commit: 'c'.repeat(40),
});

const ended = (hold: Hold) =>
  hold.ended({
    end: 'continue',
    verdict: 'exploring',
    turnHeads: [TurnHeads.of({ runId: TURN, started: [], ended: [head] })],
    at: LATER,
  });

describe('Hold', () => {
  it('is open with no turns when it starts', () => {
    const hold = started();

    expect(hold.open).toBe(true);
    expect(hold.turns).toEqual([]);
    expect(hold.end).toBeNull();
  });

  it('counts a run once as its turn', () => {
    const hold = started().withTurn(TURN).withTurn(TURN);

    expect(hold.turns).toEqual([TURN]);
    expect(hold.drives(TURN)).toBe(true);
    expect(hold.drives(FROM)).toBe(false);
  });

  it('forgets the move it held when it ends, and keeps the new verdict and the commits', () => {
    const hold = ended(
      started().withTurn(TURN).holdingMoveTo(StationId.of('station_ship')),
    );

    expect(hold.open).toBe(false);
    expect(hold.heldMove).toBeNull();
    expect(hold.verdict).toBe('exploring');
    expect(hold.toHeads).toEqual([head]);
  });

  it('runs from where its first turn started to where its newest turn that reported heads ended', () => {
    const second = RunId.of('run_turn_2');
    const at = (commit: string) =>
      CheckoutHead.of({ path: '/workspace/app', commit: commit.repeat(40) });
    const turns = started().withTurn(TURN).withTurn(second);
    const ending = (lastEnded: readonly CheckoutHead[]) =>
      turns.ended({
        end: 'continue',
        verdict: 'not-right',
        turnHeads: [
          TurnHeads.of({ runId: second, started: [at('b')], ended: lastEnded }),
          TurnHeads.of({ runId: TURN, started: [at('a')], ended: [at('b')] }),
        ],
        at: LATER,
      });

    expect(ending([at('c')]).fromHeads).toEqual([at('a')]);
    expect(ending([at('c')]).toHeads).toEqual([at('c')]);
    expect(ending([]).toHeads).toEqual([at('b')]);
  });

  it('takes each checkout from the first turn that saw it to the newest turn that ended it', () => {
    const second = RunId.of('run_turn_2');
    const app = (commit: string) =>
      CheckoutHead.of({ path: '/workspace/app', commit: commit.repeat(40) });
    const docs = (commit: string) =>
      CheckoutHead.of({ path: '/workspace/docs', commit: commit.repeat(40) });
    const hold = started()
      .withTurn(TURN)
      .withTurn(second)
      .ended({
        end: 'continue',
        verdict: 'not-right',
        turnHeads: [
          TurnHeads.of({ runId: TURN, started: [app('a')], ended: [] }),
          TurnHeads.of({
            runId: second,
            started: [app('b'), docs('d')],
            ended: [docs('e')],
          }),
        ],
        at: LATER,
      });

    expect(hold.fromHeads).toEqual([app('a'), docs('d')]);
    expect(hold.toHeads).toEqual([docs('e')]);
  });

  it('knows no end commits when no turn reported them', () => {
    const hold = started()
      .withTurn(TURN)
      .ended({
        end: 'continue',
        verdict: 'not-right',
        turnHeads: [TurnHeads.of({ runId: TURN, started: [head], ended: [] })],
        at: LATER,
      });

    expect(hold.fromHeads).toEqual([head]);
    expect(hold.toHeads).toEqual([]);
  });

  it('does not end before it started', () => {
    expect(() =>
      started().ended({
        end: 'continue',
        verdict: 'not-right',
        turnHeads: [],
        at: new Date(NOW.getTime() - 1),
      }),
    ).toThrow(InvalidHoldTransitionError);
  });

  it('takes the heads of a turn only once per checkout', () => {
    expect(() =>
      TurnHeads.of({ runId: TURN, started: [head, head], ended: [] }),
    ).toThrow(InvalidTurnHeadsError);
  });

  it('is not stored as ended before it started', () => {
    expect(() =>
      Hold.rehydrate({
        chat: null,
        id: HoldId.of('hold_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'exploring',
        turns: [],
        heldMove: null,
        startedAt: LATER,
        endedAt: NOW,
        end: 'continue',
        fromHeads: [],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('takes no turn, holds no move and does not end again once it has ended', () => {
    const hold = ended(started());

    expect(() => hold.withTurn(TURN)).toThrow(InvalidHoldTransitionError);
    expect(() => hold.holdingMoveTo(StationId.of('station_ship'))).toThrow(
      InvalidHoldTransitionError,
    );
    expect(() => ended(hold)).toThrow(InvalidHoldTransitionError);
  });

  it('does not count the line run it held from as a turn', () => {
    expect(() => started().withTurn(FROM)).toThrow(InvalidHoldTransitionError);
  });

  it('is not stored as ended without a resume', () => {
    expect(() =>
      Hold.rehydrate({
        chat: null,
        id: HoldId.of('hold_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'exploring',
        turns: [],
        heldMove: null,
        startedAt: NOW,
        endedAt: LATER,
        end: null,
        fromHeads: [],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('holds no move to the station it is at', () => {
    expect(() =>
      started().holdingMoveTo(StationId.of('station_build')),
    ).toThrow(InvalidHoldTransitionError);
  });

  it('is not stored open with checkout heads', () => {
    expect(() =>
      Hold.rehydrate({
        chat: null,
        id: HoldId.of('hold_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'not-right',
        turns: [],
        heldMove: null,
        startedAt: NOW,
        endedAt: null,
        end: null,
        fromHeads: [head],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('is not stored open as exploring', () => {
    expect(() =>
      Hold.rehydrate({
        chat: null,
        id: HoldId.of('hold_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'exploring',
        turns: [],
        heldMove: null,
        startedAt: NOW,
        endedAt: null,
        end: null,
        fromHeads: [],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('starts as not right', () => {
    expect(started().verdict).toBe('not-right');
  });

  it('reads verdicts and resumes by name only', () => {
    expect(holdVerdictOf('exploring')).toBe('exploring');
    expect(holdEndOf('move-on')).toBe('move-on');
    expect(() => holdVerdictOf('bored')).toThrow(InvalidHoldError);
    expect(() => holdEndOf('drop')).toThrow(InvalidHoldError);
  });
});

describe('CheckoutHead', () => {
  it('needs a path and a full commit SHA', () => {
    expect(head.parts).toEqual({
      path: '/workspace/app',
      commit: 'c'.repeat(40),
    });
    expect(() =>
      CheckoutHead.of({ path: ' ', commit: 'c'.repeat(40) }),
    ).toThrow(InvalidCheckoutHeadError);
    expect(() =>
      CheckoutHead.of({ path: '/workspace/app', commit: 'abc123' }),
    ).toThrow(InvalidCheckoutHeadError);
  });
});

describe('Hold for a chat', () => {
  const CHAT = ChatId.of('chat_1');
  const forChat = () =>
    Hold.forChat({
      id: HoldId.of('hold_1'),
      by: UserId.of('user_leon'),
      chat: CHAT,
      stationId: StationId.of('station_ship'),
      at: NOW,
    });
  const stored = (from: RunId | null, turns: readonly RunId[]) =>
    Hold.rehydrate({
      chat: CHAT,
      id: HoldId.of('hold_1'),
      by: UserId.of('user_leon'),
      stationId: StationId.of('station_ship'),
      from,
      verdict: UNSAID_HOLD_VERDICT,
      turns,
      heldMove: null,
      startedAt: NOW,
      endedAt: null,
      end: null,
      fromHeads: [],
      toHeads: [],
    });

  it('is held from no run, by the chat', () => {
    const hold = forChat();

    expect(hold.chat?.equals(CHAT)).toBe(true);
    expect(hold.from).toBeNull();
    expect(hold.open).toBe(true);
  });

  it('takes no turns, because the chat does the work', () => {
    expect(() => forChat().withTurn(TURN)).toThrow(InvalidHoldTransitionError);
  });

  it('ends as exploring, and never counts against the line', () => {
    const end = (verdict: 'not-right' | null) =>
      forChat().ended({ end: 'finish', verdict, turnHeads: [], at: LATER });

    expect(end(null).verdict).toBe('exploring');
    expect(() => end('not-right')).toThrow(InvalidHoldTransitionError);
  });

  it('is not stored with a run it held from, or with turns', () => {
    expect(() => stored(FROM, [])).toThrow(InconsistentStateError);
    expect(() => stored(null, [TURN])).toThrow(InconsistentStateError);
    expect(stored(null, []).chat?.equals(CHAT)).toBe(true);
  });
});
