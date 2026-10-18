import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { HoldStartingPoints } from '@work/application/services/hold-starting-points.service';
import { StartingPointHold } from '@work/domain/aggregates/starting-point-hold.aggregate';
import type { StartingPointHoldRepository } from '@work/domain/repositories/starting-point-hold.repository';
import { beforeEach, describe, expect, it } from 'vitest';

let stored: StartingPointHold | null;
let added: StartingPointHold[];
let saved: StartingPointHold[];

const holds: StartingPointHoldRepository = {
  find: async () => stored,
  add: async (hold) => {
    added.push(hold);
  },
  save: async (hold) => {
    saved.push(hold);
  },
};

const holding = () =>
  new HoldStartingPoints(holds, { inTransaction: (work) => work() });

describe('HoldStartingPoints', () => {
  beforeEach(() => {
    stored = null;
    added = [];
    saved = [];
  });

  it('takes a hold on the runs a holder names', async () => {
    await holding().hold('replay-set:set_1', 'ws_1', ['run_1']);

    expect(added.map((each) => each.runs.map((run) => run.value))).toEqual([
      ['run_1'],
    ]);
  });

  it('takes no hold on nothing', async () => {
    await holding().hold('replay-set:set_1', 'ws_1', []);

    expect(added).toEqual([]);
  });

  it('moves a hold to the runs the holder now names', async () => {
    stored = StartingPointHold.take('replay-set:set_1', WorkspaceId.of('ws_1'));

    await holding().hold('replay-set:set_1', 'ws_1', ['run_2']);

    expect(saved[0]?.runs.map((each) => each.value)).toEqual(['run_2']);
  });

  it('releases a hold, and minds no hold that is gone', async () => {
    await holding().release('replay-set:set_1');
    expect(saved).toEqual([]);

    stored = StartingPointHold.take('replay-set:set_1', WorkspaceId.of('ws_1'));
    await holding().release('replay-set:set_1');
    expect(saved[0]?.isReleased).toBe(true);
  });
});
