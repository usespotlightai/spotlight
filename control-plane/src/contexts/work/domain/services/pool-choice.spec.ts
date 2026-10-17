import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { PoolRoom, poolChoiceFor } from '@work/domain/services/pool-choice';
import { describe, expect, it } from 'vitest';

const BURST = PoolId.of('burst');
const STEADY = PoolId.of('steady');
const SPARE = PoolId.of('spare');

const aPool = (pool: PoolId, labels: string[] = [], egress = false) => ({
  pool,
  labels: RunnerTerms.of(labels),
  egress,
});

const POOLS = [aPool(BURST, ['gpu']), aPool(STEADY), aPool(SPARE)];

describe('poolChoiceFor', () => {
  it('offers the pools that could take the placement and have room, in the order given', () => {
    const room = PoolRoom.told([
      [BURST, 1],
      [STEADY, null],
      [SPARE, 0],
    ]);

    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), POOLS, room).map(
        (each) => each.pool,
      ),
    ).toEqual([BURST, STEADY]);
    expect(
      poolChoiceFor(RunnerPlacement.of(['gpu']), POOLS, room).map(
        (each) => each.pool,
      ),
    ).toEqual([BURST]);
  });

  it('offers a run with injected secrets only the pools that name an egress', () => {
    const pools = [aPool(BURST), aPool(STEADY, [], true)];
    const room = PoolRoom.told([
      [BURST, null],
      [STEADY, null],
    ]);

    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), pools, room, true).map(
        (each) => each.pool,
      ),
    ).toEqual([STEADY]);
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), pools, room).map(
        (each) => each.pool,
      ),
    ).toEqual([BURST, STEADY]);
  });

  it('offers no pool whose room it was never told', () => {
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), POOLS, PoolRoom.told([])),
    ).toEqual([]);
  });
});

describe('PoolRoom', () => {
  it('takes one run of a bounded pool’s room, and leaves an unbounded pool’s alone', () => {
    const room = PoolRoom.told([
      [BURST, 1],
      [STEADY, null],
    ]);
    const taken = room.afterTaking(BURST).afterTaking(STEADY);

    expect(taken.leftIn(BURST)).toBe(0);
    expect(taken.leftIn(STEADY)).toBeNull();
    expect(room.leftIn(BURST)).toBe(1);
  });

  it('knows a pool by its id, not by the object naming it', () => {
    const room = PoolRoom.told([[BURST, 1]]);

    expect(room.hasRoomIn(PoolId.of('burst'))).toBe(true);
    expect(room.afterTaking(PoolId.of('burst')).hasRoomIn(BURST)).toBe(false);
  });

  it('finds room while some pool is unbounded or has runs to spare', () => {
    expect(PoolRoom.told([[BURST, 0]]).anyLeft).toBe(false);
    expect(
      PoolRoom.told([
        [BURST, 0],
        [STEADY, null],
      ]).anyLeft,
    ).toBe(true);
    expect(PoolRoom.told([[BURST, 2]]).anyLeft).toBe(true);
  });
});
