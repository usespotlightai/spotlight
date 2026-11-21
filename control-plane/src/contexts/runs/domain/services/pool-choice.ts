import { poolFits } from '@runs/domain/services/pool-fit';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export interface PoolOnOffer {
  readonly pool: PoolId;
  readonly key: string;
  readonly labels: RunnerOffer;
  readonly egress: boolean;
  readonly managed: boolean;
}

// The workspace's own pools come first, by key. The pool that the deployment manages comes last.
export const offerOrder = (one: PoolOnOffer, other: PoolOnOffer): number => {
  if (one.managed !== other.managed) {
    return one.managed ? 1 : -1;
  }

  return one.key < other.key ? -1 : one.key > other.key ? 1 : 0;
};

export class PoolRoom {
  private constructor(
    private readonly left: ReadonlyMap<string, number | null>,
  ) {}

  static of(rooms: readonly (readonly [PoolId, number | null])[]): PoolRoom {
    return new PoolRoom(
      new Map(rooms.map(([pool, left]) => [pool.value, left])),
    );
  }

  leftIn(pool: PoolId): number | null | undefined {
    return this.left.get(pool.value);
  }

  hasRoomIn(pool: PoolId): boolean {
    const left = this.leftIn(pool);

    return left === null || (left ?? 0) > 0;
  }

  afterTaking(pool: PoolId): PoolRoom {
    const left = this.leftIn(pool);

    return left === null || left === undefined
      ? this
      : new PoolRoom(new Map(this.left).set(pool.value, Math.max(0, left - 1)));
  }

  get anyLeft(): boolean {
    return [...this.left.values()].some((left) => left === null || left > 0);
  }
}

// A managed pool takes work only when no pool of the workspace fits it. Work that a full pool of the workspace fits waits for that pool.
export const poolChoiceFor = <Pool extends PoolOnOffer>(
  placement: RunnerPlacement,
  pools: readonly Pool[],
  room: PoolRoom,
  needsEgress = false,
): readonly Pool[] => {
  const fitting = pools.filter((offered) =>
    poolFits(placement, offered, needsEgress),
  );
  const owned = fitting.filter((offered) => !offered.managed);

  return (
    owned.length > 0 ? owned : fitting.filter((offered) => offered.managed)
  ).filter((offered) => room.hasRoomIn(offered.pool));
};
