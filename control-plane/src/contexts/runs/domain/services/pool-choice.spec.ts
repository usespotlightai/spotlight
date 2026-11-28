import {
  type HostOffer,
  offerOrder,
  PoolRoom,
  poolChoiceFor,
  waitReasonFor,
} from '@runs/domain/services/pool-choice';
import type { WorkNeeds } from '@runs/domain/services/pool-fit';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { describe, expect, it } from 'vitest';

const BURST = PoolId.of('burst');
const STEADY = PoolId.of('steady');
const SPARE = PoolId.of('spare');
const PLATFORM = PoolId.of('spotlight');

const RUN: WorkNeeds = { secrets: false, reviewWork: false };
const SECRET_RUN: WorkNeeds = { secrets: true, reviewWork: false };
const CHECK: WorkNeeds = { secrets: false, reviewWork: true };

const aPool = (
  pool: PoolId,
  labels: string[] = [],
  egress = false,
  platform = false,
  allows = { allowsSecrets: true, allowsReviewWork: true },
) => ({
  pool,
  key: pool.value,
  labels: RunnerOffer.of(labels),
  egress,
  platform,
  images: null,
  ...allows,
});

const aPlatformPool = (
  labels: string[] = [],
  egress = false,
  allows = { allowsSecrets: true, allowsReviewWork: true },
) => aPool(PLATFORM, labels, egress, true, allows);

const REFUSING = { allowsSecrets: false, allowsReviewWork: false };

const hostsServing = (
  labels: string[],
  quiet: HostOffer['quiet'] = null,
): HostOffer => ({
  labels: RunnerOffer.of(labels),
  egress: true,
  images: null,
  allowsSecrets: true,
  allowsReviewWork: true,
  quiet,
});

const QUIET_SINCE = new Date('2026-11-27T20:00:00.000Z');

const POOLS = [aPool(BURST, ['gpu']), aPool(STEADY), aPool(SPARE)];

describe('poolChoiceFor', () => {
  it('offers the pools that could take the placement and have room, in the order given', () => {
    const room = PoolRoom.of([
      [BURST, 1],
      [STEADY, null],
      [SPARE, 0],
    ]);

    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), POOLS, [], room, RUN).map(
        (each) => each.pool,
      ),
    ).toEqual([BURST, STEADY]);
    expect(
      poolChoiceFor(RunnerPlacement.of(['gpu']), POOLS, [], room, RUN).map(
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
      poolChoiceFor(
        RunnerPlacement.anywhere(),
        pools,
        [],
        room,
        SECRET_RUN,
      ).map((each) => each.pool),
    ).toEqual([STEADY]);
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), pools, [], room, RUN).map(
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
      poolChoiceFor(RunnerPlacement.of(['gpu']), pools, [], room, RUN).map(
        (each) => each.pool,
      ),
    ).toEqual([BURST]);
    expect(
      poolChoiceFor(RunnerPlacement.of(['arm']), pools, [], room, RUN).map(
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

    expect(
      poolChoiceFor(RunnerPlacement.of(['gpu']), pools, [], room, RUN),
    ).toEqual([]);
  });

  it('keeps work that the hosts of a pull pool or a trust fit off the platform pool', () => {
    const pools = [aPlatformPool(['gpu'])];
    const room = PoolRoom.of([[PLATFORM, null]]);

    expect(
      poolChoiceFor(
        RunnerPlacement.of(['gpu']),
        pools,
        [hostsServing(['gpu'])],
        room,
        RUN,
      ),
    ).toEqual([]);
    expect(
      poolChoiceFor(
        RunnerPlacement.anywhere(),
        pools,
        [hostsServing([])],
        room,
        SECRET_RUN,
      ),
    ).toEqual([]);
    expect(
      poolChoiceFor(
        RunnerPlacement.of(['gpu']),
        pools,
        [hostsServing(['arm'])],
        room,
        RUN,
      ).map((each) => each.pool),
    ).toEqual([PLATFORM]);
  });

  it('offers the platform pool a run with injected secrets that no egress pool of the workspace fits', () => {
    const pools = [aPool(BURST), aPlatformPool([], true)];
    const room = PoolRoom.of([
      [BURST, null],
      [PLATFORM, null],
    ]);

    expect(
      poolChoiceFor(
        RunnerPlacement.anywhere(),
        pools,
        [],
        room,
        SECRET_RUN,
      ).map((each) => each.pool),
    ).toEqual([PLATFORM]);
  });

  it('keeps secrets and review work off a platform pool that the operator does not allow them', () => {
    const refusing = [aPlatformPool([], true, REFUSING)];
    const room = PoolRoom.of([[PLATFORM, null]]);

    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), refusing, [], room, SECRET_RUN),
    ).toEqual([]);
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), refusing, [], room, CHECK),
    ).toEqual([]);
    expect(
      poolChoiceFor(RunnerPlacement.anywhere(), refusing, [], room, RUN).map(
        (each) => each.pool,
      ),
    ).toEqual([PLATFORM]);
  });

  it('offers no pool whose room it was never told', () => {
    expect(
      poolChoiceFor(
        RunnerPlacement.anywhere(),
        POOLS,
        [],
        PoolRoom.of([]),
        RUN,
      ),
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

  it('finds room while some pool is unbounded or has runs to spare, the platform pool too', () => {
    expect(PoolRoom.of([[BURST, 0]]).anyLeft).toBe(false);
    expect(
      PoolRoom.of([
        [BURST, 0],
        [STEADY, null],
      ]).anyLeft,
    ).toBe(true);
    expect(
      PoolRoom.of([
        [BURST, 0],
        [PLATFORM, null],
      ]).anyLeft,
    ).toBe(true);
    expect(PoolRoom.of([[BURST, 2]]).anyLeft).toBe(true);
  });
});

describe('waitReasonFor', () => {
  it('says the work waits for a person when every host offer that fits it has no host that reports in, naming the hosts', () => {
    expect(
      waitReasonFor(
        RunnerPlacement.of(['gpu']),
        [aPlatformPool(['gpu'])],
        [
          hostsServing(['gpu'], { hosts: ['dev-host'], since: QUIET_SINCE }),
          hostsServing(['gpu'], { hosts: [], since: null }),
          hostsServing(['arm'], null),
        ],
        RUN,
      ),
    ).toEqual({
      reason: 'hosts-offline',
      quiet: { hosts: ['dev-host'], since: QUIET_SINCE },
    });
  });

  it('says hosts pull the work while one host offer that fits it reports in, or a pool of its own fits it', () => {
    const offline = hostsServing(['gpu'], {
      hosts: ['dev-host'],
      since: QUIET_SINCE,
    });

    expect(
      waitReasonFor(
        RunnerPlacement.of(['gpu']),
        [],
        [offline, hostsServing(['gpu'])],
        RUN,
      ),
    ).toEqual({ reason: 'hosts-pull', quiet: null });
    expect(
      waitReasonFor(
        RunnerPlacement.of(['gpu']),
        [aPool(BURST, ['gpu'])],
        [offline],
        RUN,
      ),
    ).toEqual({ reason: 'hosts-pull', quiet: null });
  });

  it('says the hosts pull work that they fit', () => {
    expect(
      waitReasonFor(
        RunnerPlacement.of(['gpu']),
        [],
        [hostsServing(['gpu'])],
        RUN,
      ),
    ).toEqual({ reason: 'hosts-pull', quiet: null });
  });

  it('says the pools are full when a pool fits the work', () => {
    expect(
      waitReasonFor(
        RunnerPlacement.of(['gpu']),
        [aPool(BURST, ['gpu'])],
        [],
        RUN,
      ),
    ).toEqual({ reason: 'no-pool-has-room', quiet: null });
  });

  it('says the operator does not allow the platform pool the work when only that keeps it off', () => {
    const refusing = [aPlatformPool([], true, REFUSING)];

    expect(
      waitReasonFor(RunnerPlacement.anywhere(), refusing, [], SECRET_RUN),
    ).toEqual({ reason: 'platform-pool-not-allowed', quiet: null });
    expect(
      waitReasonFor(RunnerPlacement.anywhere(), refusing, [], CHECK),
    ).toEqual({
      reason: 'platform-pool-not-allowed',
      quiet: null,
    });
  });

  it('says no pool matches when no pool or host could take the work at all', () => {
    expect(
      waitReasonFor(
        RunnerPlacement.of(['vpc-internal']),
        [aPool(BURST, ['gpu']), aPlatformPool([], true, REFUSING)],
        [hostsServing(['arm'])],
        RUN,
      ),
    ).toEqual({ reason: 'no-pool-matches', quiet: null });
    expect(
      waitReasonFor(RunnerPlacement.anywhere(), [aPool(BURST)], [], SECRET_RUN),
    ).toEqual({ reason: 'no-pool-matches', quiet: null });
  });
});
