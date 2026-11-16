import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { Takeover } from '@work/domain/entities/takeover.entity';
import { InvalidCheckoutHeadError } from '@work/domain/exceptions/invalid-checkout-head.error';
import { InvalidTakeoverTransitionError } from '@work/domain/exceptions/invalid-takeover-transition.error';
import { InvalidTakeoverError } from '@work/domain/exceptions/invalid-takeover.error';
import { InvalidTurnHeadsError } from '@work/domain/exceptions/invalid-turn-heads.error';
import { CheckoutHead } from '@work/domain/value-objects/checkout-head.vo';
import { handBackOf } from '@work/domain/value-objects/hand-back';
import { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import { takeoverVerdictOf } from '@work/domain/value-objects/takeover-verdict';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const LATER = new Date('2026-11-16T10:00:00.000Z');
const FROM = RunId.of('run_line');
const TURN = RunId.of('run_turn');

const started = () =>
  Takeover.start({
    id: TakeoverId.of('takeover_1'),
    by: UserId.of('user_leon'),
    stationId: StationId.of('station_build'),
    from: FROM,
    verdict: 'not-right',
    at: NOW,
  });

const head = CheckoutHead.of({
  path: '/workspace/app',
  commit: 'c'.repeat(40),
});

const ended = (takeover: Takeover) =>
  takeover.ended({
    handBack: 'continue',
    verdict: 'exploring',
    turnHeads: [TurnHeads.of({ runId: TURN, started: [], ended: [head] })],
    at: LATER,
  });

describe('Takeover', () => {
  it('is open with no turns when it starts', () => {
    const takeover = started();

    expect(takeover.open).toBe(true);
    expect(takeover.turns).toEqual([]);
    expect(takeover.handBack).toBeNull();
  });

  it('counts a run once as its turn', () => {
    const takeover = started().withTurn(TURN).withTurn(TURN);

    expect(takeover.turns).toEqual([TURN]);
    expect(takeover.drives(TURN)).toBe(true);
    expect(takeover.drives(FROM)).toBe(false);
  });

  it('forgets the move it held when it ends, and keeps the new verdict and the commits', () => {
    const takeover = ended(
      started().withTurn(TURN).holdingMoveTo(StationId.of('station_ship')),
    );

    expect(takeover.open).toBe(false);
    expect(takeover.heldMove).toBeNull();
    expect(takeover.verdict).toBe('exploring');
    expect(takeover.toHeads).toEqual([head]);
  });

  it('runs from where its first turn started to where its newest turn that reported heads ended', () => {
    const second = RunId.of('run_turn_2');
    const at = (commit: string) =>
      CheckoutHead.of({ path: '/workspace/app', commit: commit.repeat(40) });
    const turns = started().withTurn(TURN).withTurn(second);
    const ending = (lastEnded: readonly CheckoutHead[]) =>
      turns.ended({
        handBack: 'continue',
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
    const takeover = started()
      .withTurn(TURN)
      .withTurn(second)
      .ended({
        handBack: 'continue',
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

    expect(takeover.fromHeads).toEqual([app('a'), docs('d')]);
    expect(takeover.toHeads).toEqual([docs('e')]);
  });

  it('knows no end commits when no turn reported them', () => {
    const takeover = started()
      .withTurn(TURN)
      .ended({
        handBack: 'continue',
        verdict: 'not-right',
        turnHeads: [TurnHeads.of({ runId: TURN, started: [head], ended: [] })],
        at: LATER,
      });

    expect(takeover.fromHeads).toEqual([head]);
    expect(takeover.toHeads).toEqual([]);
  });

  it('does not end before it started', () => {
    expect(() =>
      started().ended({
        handBack: 'continue',
        verdict: 'not-right',
        turnHeads: [],
        at: new Date(NOW.getTime() - 1),
      }),
    ).toThrow(InvalidTakeoverTransitionError);
  });

  it('takes the heads of a turn only once per checkout', () => {
    expect(() =>
      TurnHeads.of({ runId: TURN, started: [head, head], ended: [] }),
    ).toThrow(InvalidTurnHeadsError);
  });

  it('is not stored as ended before it started', () => {
    expect(() =>
      Takeover.rehydrate({
        id: TakeoverId.of('takeover_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'exploring',
        turns: [],
        heldMove: null,
        startedAt: LATER,
        endedAt: NOW,
        handBack: 'continue',
        fromHeads: [],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('takes no turn, holds no move and does not end again once it has ended', () => {
    const takeover = ended(started());

    expect(() => takeover.withTurn(TURN)).toThrow(
      InvalidTakeoverTransitionError,
    );
    expect(() => takeover.holdingMoveTo(StationId.of('station_ship'))).toThrow(
      InvalidTakeoverTransitionError,
    );
    expect(() => ended(takeover)).toThrow(InvalidTakeoverTransitionError);
  });

  it('does not count the line run it took over from as a turn', () => {
    expect(() => started().withTurn(FROM)).toThrow(
      InvalidTakeoverTransitionError,
    );
  });

  it('is not stored as ended without a hand-back', () => {
    expect(() =>
      Takeover.rehydrate({
        id: TakeoverId.of('takeover_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'exploring',
        turns: [],
        heldMove: null,
        startedAt: NOW,
        endedAt: LATER,
        handBack: null,
        fromHeads: [],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('holds no move to the station it is at', () => {
    expect(() =>
      started().holdingMoveTo(StationId.of('station_build')),
    ).toThrow(InvalidTakeoverTransitionError);
  });

  it('is not stored open with checkout heads', () => {
    expect(() =>
      Takeover.rehydrate({
        id: TakeoverId.of('takeover_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: 'exploring',
        turns: [],
        heldMove: null,
        startedAt: NOW,
        endedAt: null,
        handBack: null,
        fromHeads: [head],
        toHeads: [],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('is not right when the person does not say', () => {
    expect(
      Takeover.start({
        id: TakeoverId.of('takeover_1'),
        by: UserId.of('user_leon'),
        stationId: StationId.of('station_build'),
        from: null,
        verdict: null,
        at: NOW,
      }).verdict,
    ).toBe('not-right');
  });

  it('reads verdicts and hand-backs by name only', () => {
    expect(takeoverVerdictOf('exploring')).toBe('exploring');
    expect(handBackOf('move-on')).toBe('move-on');
    expect(() => takeoverVerdictOf('bored')).toThrow(InvalidTakeoverError);
    expect(() => handBackOf('drop')).toThrow(InvalidTakeoverError);
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
