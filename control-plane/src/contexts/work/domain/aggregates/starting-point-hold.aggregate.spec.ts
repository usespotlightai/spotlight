import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  MAX_HELD_RUNS,
  StartingPointHold,
} from '@work/domain/aggregates/starting-point-hold.aggregate';
import { InvalidStartingPointHoldError } from '@work/domain/exceptions/invalid-starting-point-hold.error';
import { describe, expect, it } from 'vitest';

const runs = (...ids: string[]) => ids.map((each) => RunId.of(each));

const taken = () =>
  StartingPointHold.take('replay-set:set_1', WorkspaceId.of('ws_1'));

describe('StartingPointHold', () => {
  it('holds exactly the runs it is given, once each', () => {
    const hold = taken()
      .holding(runs('run_1', 'run_2', 'run_1'))
      .holding(runs('run_2', 'run_3'));

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
      ),
    ).toThrow(InvalidStartingPointHoldError);
  });

  it('holds nothing once released', () => {
    const released = taken().holding(runs('run_1')).released();

    expect(released.isReleased).toBe(true);
    expect(released.holds(RunId.of('run_1'))).toBe(false);
  });

  it('is held by someone named', () => {
    expect(() => StartingPointHold.take(' ', WorkspaceId.of('ws_1'))).toThrow(
      InvalidStartingPointHoldError,
    );
  });
});
