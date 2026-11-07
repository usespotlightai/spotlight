import {
  MAX_HELD_RUNS,
  StartingPointHold,
} from '@runs/domain/aggregates/starting-point-hold.aggregate';
import { InvalidStartingPointHoldError } from '@runs/domain/exceptions/invalid-starting-point-hold.error';
import { HoldHolder } from '@runs/domain/value-objects/hold-holder.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const runs = (...ids: string[]) => ids.map((each) => RunId.of(each));

const WS = WorkspaceId.of('ws_1');

const taken = () =>
  StartingPointHold.take(HoldHolder.of('replay-set:set_1'), WS);

describe('StartingPointHold', () => {
  it('holds exactly the runs it is given, once each', () => {
    const hold = taken()
      .holding(runs('run_1', 'run_2', 'run_1'), WS)
      .holding(runs('run_2', 'run_3'), WS);

    expect(hold.runs.map((each) => each.value)).toEqual(['run_2', 'run_3']);
    expect(hold.holds(RunId.of('run_1'))).toBe(false);
    expect(hold.holds(RunId.of('run_3'))).toBe(true);
  });

  it(`holds at most ${MAX_HELD_RUNS} runs`, () => {
    expect(() =>
      taken().holding(
        Array.from({ length: MAX_HELD_RUNS + 1 }, (_, at) =>
          RunId.of(`run_${at}`),
        ),
        WS,
      ),
    ).toThrow(InvalidStartingPointHoldError);
  });

  it('holds nothing once released', () => {
    const released = taken().holding(runs('run_1'), WS).released();

    expect(released.isReleased).toBe(true);
    expect(released.holds(RunId.of('run_1'))).toBe(false);
  });

  it('is held by someone named', () => {
    expect(() => HoldHolder.of(' ')).toThrow(InvalidStartingPointHoldError);
  });

  it('is no hold once it holds no runs', () => {
    expect(taken().holding(runs('run_1'), WS).holding([], WS).isReleased).toBe(
      true,
    );
  });

  it('holds only runs of its own workspace', () => {
    expect(() =>
      taken().holding(runs('run_1'), WorkspaceId.of('ws_2')),
    ).toThrow(InvalidStartingPointHoldError);
  });

  it('loads only a hold on some runs, by someone named', () => {
    expect(() =>
      StartingPointHold.rehydrate({
        holder: 'replay-set:set_1',
        workspaceId: WS,
        runs: [],
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
