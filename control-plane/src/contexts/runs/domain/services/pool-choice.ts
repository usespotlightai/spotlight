import { poolFits } from '@runs/domain/services/pool-fit';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export interface PoolOnOffer {
  readonly pool: PoolId;
  readonly key: string;
  readonly labels: RunnerOffer;
  readonly egress: boolean;
  // Spotlight adds the platform pool to each workspace. It takes only work that no other pool or host of the workspace fits.
  readonly platform: boolean;
}

// What the hosts of a pull pool or a trust can take. Hosts pull their runners, so Spotlight never chooses a host offer.
export interface HostOffer {
  readonly labels: RunnerOffer;
  readonly egress: boolean;
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
    return roomy(this.leftIn(pool));
  }

  afterTaking(pool: PoolId): PoolRoom {
    const left = this.leftIn(pool);

    return left === null || left === undefined
      ? this
      : new PoolRoom(new Map(this.left).set(pool.value, Math.max(0, left - 1)));
  }

  get anyLeft(): boolean {
    return [...this.left.values()].some(roomy);
  }
}

// The platform pool takes work only when no other pool of the workspace and no host offer fits it. Work that a full pool or the hosts of the workspace fit waits for them.
export const poolChoiceFor = <Pool extends PoolOnOffer>(
  placement: RunnerPlacement,
  pools: readonly Pool[],
  hostOffers: readonly HostOffer[],
  room: PoolRoom,
  needsEgress = false,
): readonly Pool[] => {
  const fitting = pools.filter((offered) =>
    poolFits(placement, offered, needsEgress),
  );
  const owned = fitting.filter((offered) => !offered.platform);
  const hostsFit = hostOffers.some((offer) =>
    poolFits(placement, offer, needsEgress),
  );
  const chosen =
    owned.length > 0 || hostsFit
      ? owned
      : fitting.filter((offered) => offered.platform);

  return chosen.filter((offered) => room.hasRoomIn(offered.pool));
};
