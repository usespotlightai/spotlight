import {
  type Offer,
  offerCouldServe,
  poolFits,
  type WorkNeeds,
} from '@runs/domain/services/pool-fit';
import {
  type QuietHosts,
  type WaitCause,
  WaitCauses,
} from '@runs/domain/value-objects/run-waiting';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export interface PoolOnOffer extends Offer {
  readonly pool: PoolId;
  readonly key: string;
  // Spotlight adds the platform pool to each workspace. It takes only work that no other pool or host of the workspace fits.
  readonly platform: boolean;
}

// What the hosts of a pull pool or a trust can take. Hosts pull their runners, so Spotlight never chooses a host offer. Quiet is set while none of its hosts reports in, as Runners decides it.
export interface HostOffer extends Offer {
  readonly quiet: QuietHosts | null;
}

const togetherOf = (quiet: readonly QuietHosts[]): QuietHosts => {
  const heard = quiet.flatMap((each) =>
    each.since ? [each.since.getTime()] : [],
  );

  return {
    hosts: [...new Set(quiet.flatMap((each) => each.hosts))],
    since: heard.length > 0 ? new Date(Math.max(...heard)) : null,
  };
};

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
  needs: WorkNeeds,
): readonly Pool[] => {
  const fitting = pools.filter((offered) =>
    poolFits(placement, offered, needs),
  );
  const owned = fitting.filter((offered) => !offered.platform);
  const hostsFit = hostOffers.some((offer) =>
    poolFits(placement, offer, needs),
  );
  const chosen =
    owned.length > 0 || hostsFit
      ? owned
      : fitting.filter((offered) => offered.platform);

  return chosen.filter((offered) => room.hasRoomIn(offered.pool));
};

// Why no pool takes the work now: hosts pull it, hosts would pull it but none of them reports in and no pool of the workspace's own fits it, the pools that fit it are full, a pool could take it once the operator allows it, or no pool or host could take it at all.
export const waitReasonFor = (
  placement: RunnerPlacement,
  pools: readonly PoolOnOffer[],
  hostOffers: readonly HostOffer[],
  needs: WorkNeeds,
): WaitCause => {
  const fits = (offer: Offer): boolean => poolFits(placement, offer, needs);
  const hosts = hostOffers.filter(fits);

  if (hosts.length > 0) {
    const quiet = hosts.flatMap((offer) => (offer.quiet ? [offer.quiet] : []));
    const ownPoolFits = pools.some((offer) => !offer.platform && fits(offer));

    return quiet.length === hosts.length && !ownPoolFits
      ? WaitCauses.hostsOffline(togetherOf(quiet))
      : WaitCauses.of('hosts-pull');
  }

  if (pools.some(fits)) {
    return WaitCauses.of('no-pool-has-room');
  }

  return WaitCauses.of(
    pools.some((offer) => offerCouldServe(placement, offer, needs))
      ? 'platform-pool-not-allowed'
      : 'no-pool-matches',
  );
};
