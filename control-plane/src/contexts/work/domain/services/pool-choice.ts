import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { poolCouldTake } from '@work/domain/services/pool-fit';

export interface PoolOnOffer {
  readonly pool: PoolId;
  readonly labels: RunnerTerms;
  readonly egress: boolean;
}

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

export const poolChoiceFor = <Pool extends PoolOnOffer>(
  placement: RunnerPlacement,
  pools: readonly Pool[],
  room: PoolRoom,
  needsEgress = false,
): readonly Pool[] =>
  pools.filter(
    (offered) =>
      (offered.egress || !needsEgress) &&
      room.hasRoomIn(offered.pool) &&
      poolCouldTake(placement, offered.labels),
  );
