import { poolFits } from '@runs/domain/services/pool-fit';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export interface PoolOnOffer {
  readonly pool: PoolId;
  readonly key: string;
  readonly labels: RunnerOffer;
  readonly egress: boolean;
  // Spotlight adds the platform pool to each workspace. It takes only work that no other pool or trust of the workspace fits.
  readonly platform: boolean;
  // Spotlight asks the pool for runners. Hosts pull the runners of a pull pool or a trust, so Spotlight never chooses those.
  readonly provisions: boolean;
}

// The workspace's own pools come first, by key. The platform pool comes last.
export const offerOrder = (one: PoolOnOffer, other: PoolOnOffer): number => {
  if (one.platform !== other.platform) {
    return one.platform ? 1 : -1;
  }

  return one.key < other.key ? -1 : one.key > other.key ? 1 : 0;
};

const roomy = (left: number | null | undefined): boolean =>
  left === null || (left ?? 0) > 0;

export class PoolRoom {
  private constructor(
    private readonly left: ReadonlyMap<string, number | null>,
    private readonly platform: ReadonlySet<string>,
    private readonly fellThrough: boolean,
  ) {}

  static of(
    rooms: readonly (readonly [PoolId, number | null])[],
    platform: readonly PoolId[] = [],
  ): PoolRoom {
    return new PoolRoom(
      new Map(rooms.map(([pool, left]) => [pool.value, left])),
      new Set(platform.map((each) => each.value)),
      false,
    );
  }

  leftIn(pool: PoolId): number | null | undefined {
    return this.left.get(pool.value);
  }

  hasRoomIn(pool: PoolId): boolean {
    return roomy(this.leftIn(pool));
  }

  afterTaking(pool: PoolId): PoolRoom {
    const left = this.leftIn(pool);

    return left === null || left === undefined
      ? this
      : new PoolRoom(
          new Map(this.left).set(pool.value, Math.max(0, left - 1)),
          this.platform,
          this.fellThrough,
        );
  }

  // Work placed on the platform pool fell through the pools of the workspace, so more such work can wait in the next page.
  afterPlacing(offered: PoolOnOffer): PoolRoom {
    const taken = this.afterTaking(offered.pool);

    return offered.platform && !taken.fellThrough
      ? new PoolRoom(taken.left, taken.platform, true)
      : taken;
  }

  // The platform pool has no run limit. Its room counts only once some work fell through to it, so that work that waits for full pools of the workspace is not read again and again.
  get anyLeft(): boolean {
    return [...this.left.entries()].some(
      ([pool, left]) =>
        (this.fellThrough || !this.platform.has(pool)) && roomy(left),
    );
  }

  // The first page is read while any pool has room, because work in it can fall through to the platform pool.
  readsPage(page: number): boolean {
    return (
      this.anyLeft ||
      (page === 0 &&
        [...this.platform].some((pool) => roomy(this.left.get(pool))))
    );
  }
}

// A platform pool takes work only when no other pool or trust of the workspace fits it. Work that a full or pulled pool of the workspace fits waits for that pool.
export const poolChoiceFor = <Pool extends PoolOnOffer>(
  placement: RunnerPlacement,
  pools: readonly Pool[],
  room: PoolRoom,
  needsEgress = false,
): readonly Pool[] => {
  const fitting = pools.filter((offered) =>
    poolFits(placement, offered, needsEgress),
  );
  const owned = fitting.filter((offered) => !offered.platform);

  return (
    owned.length > 0 ? owned : fitting.filter((offered) => offered.platform)
  ).filter((offered) => offered.provisions && room.hasRoomIn(offered.pool));
};
