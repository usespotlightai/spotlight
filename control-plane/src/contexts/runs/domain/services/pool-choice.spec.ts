import {
  offerOrder,
  PoolRoom,
  poolChoiceFor,
} from '@runs/domain/services/pool-choice';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { describe, expect, it } from 'vitest';

const BURST = PoolId.of('burst');
const STEADY = PoolId.of('steady');
const SPARE = PoolId.of('spare');
const PLATFORM = PoolId.of('spotlight');
const HOSTS = PoolId.of('hosts');

const aPool = (
  pool: PoolId,
  labels: string[] = [],
  egress = false,
  platform = false,
  provisions = true,
) => ({
  pool,
  key: pool.value,
  labels: RunnerOffer.of(labels),
  egress,
  platform,
  provisions,
});

const aPlatformPool = (labels: string[] = [], egress = false) =>
  aPool(PLATFORM, labels, egress, true);

const aPulledPool = (labels: string[] = []) =>
  aPool(HOSTS, labels, true, false, false);

const POOLS = [aPool(BURST, ['gpu']), aPool(STEADY), aPool(SPARE)];

describe('poolChoiceFor', () => {
  it('offers the pools that could take the placement and have room, in the order given', () => {
    const room = PoolRoom.of([
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
    const room = PoolRoom.of([
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

  it('offers the platform pool only work that no pool of the workspace fits', () => {
    const pools = [aPool(BURST, ['gpu']), aPlatformPool(['gpu', 'arm'])];
    const room = PoolRoom.of([
      [BURST, null],
      [PLATFORM, null],
    ]);

    expect(
      poolChoiceFor(RunnerPlacement.of(['gpu']), pools, room).map(
        (each) => each.pool,
      ),
    ).toEqual([BURST]);
    expect(
      poolChoiceFor(RunnerPlacement.of(['arm']), pools, room).map(
        (each) => each.pool,
      ),
    ).toEqual([PLATFORM]);
  });

  it('keeps work that a full pool of the workspace fits off the platform pool', () => {
    const pools = [aPool(BURST, ['gpu']), aPlatformPool(['gpu'])];
    const room = PoolRoom.of([
      [BURST, 0],
      [PLATFORM, null],
    ]);

    expect(poolChoiceFor(RunnerPlacement.of(['gpu']), pools, room)).toEqual([]);
  });

  it('offers the platform pool a run with injected secrets that no egress pool of the workspace fits', () => {
    const pools = [aPool(BURST), aPlatformPool([], true)];
    const room = PoolRoom.of([
      [BURST, null],
      [PLATFORM, null],
    ]);

    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), pools, room, true).map(
        (each) => each.pool,
      ),
    ).toEqual([PLATFORM]);
  });

  it('keeps work that a pull pool or a trust fits off the platform pool, and never offers those', () => {
    const pools = [aPulledPool(['gpu']), aPlatformPool(['gpu'])];
    const room = PoolRoom.of([[PLATFORM, null]], [PLATFORM]);

    expect(poolChoiceFor(RunnerPlacement.of(['gpu']), pools, room)).toEqual([]);
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), pools, room, true),
    ).toEqual([]);
  });

  it('offers no pool whose room it was never told', () => {
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), POOLS, PoolRoom.of([])),
    ).toEqual([]);
  });
});

describe('offerOrder', () => {
  it('puts the pools of the workspace first, by key, and the platform pool last', () => {
    expect(
      [aPlatformPool(), aPool(STEADY), aPool(BURST)]
        .sort(offerOrder)
        .map((each) => each.pool),
    ).toEqual([BURST, STEADY, PLATFORM]);
  });
});

describe('PoolRoom', () => {
  it('counts the room of the platform pool only once work fell through to it', () => {
    const full = PoolRoom.of(
      [
        [BURST, 0],
        [PLATFORM, null],
      ],
      [PLATFORM],
    );

    expect(full.anyLeft).toBe(false);
    expect(full.afterPlacing(aPool(BURST)).anyLeft).toBe(false);
    expect(full.afterPlacing(aPlatformPool()).anyLeft).toBe(true);
  });

  it('reads the first page while only the platform pool has room, and the next ones only once work fell through to it', () => {
    const full = PoolRoom.of(
      [
        [BURST, 0],
        [PLATFORM, null],
      ],
      [PLATFORM],
    );

    expect(full.readsPage(0)).toBe(true);
    expect(full.readsPage(1)).toBe(false);
    expect(full.afterPlacing(aPlatformPool()).readsPage(1)).toBe(true);
    expect(PoolRoom.of([[BURST, 0]]).readsPage(0)).toBe(false);
  });

  it('takes one run of a bounded pool’s room, and leaves an unbounded pool’s alone', () => {
    const room = PoolRoom.of([
      [BURST, 1],
      [STEADY, null],
    ]);
    const taken = room.afterTaking(BURST).afterTaking(STEADY);

    expect(taken.leftIn(BURST)).toBe(0);
    expect(taken.leftIn(STEADY)).toBeNull();
    expect(room.leftIn(BURST)).toBe(1);
  });

  it('knows a pool by its id, not by the object naming it', () => {
    const room = PoolRoom.of([[BURST, 1]]);

    expect(room.hasRoomIn(PoolId.of('burst'))).toBe(true);
    expect(room.afterTaking(PoolId.of('burst')).hasRoomIn(BURST)).toBe(false);
  });

  it('finds room while some pool is unbounded or has runs to spare', () => {
    expect(PoolRoom.of([[BURST, 0]]).anyLeft).toBe(false);
    expect(
      PoolRoom.of([
        [BURST, 0],
        [STEADY, null],
      ]).anyLeft,
    ).toBe(true);
    expect(PoolRoom.of([[BURST, 2]]).anyLeft).toBe(true);
  });
});
