import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export const occupancyOf = async (
  runners: RunnerRepository,
  placements: SandboxPlacementsPort,
  poolId: PoolId,
  at: Date,
): Promise<PoolOccupancy> => {
  const alive = await runners.aliveIn(poolId, at);

  return occupancyAmong(alive, await placements.idleInPool(poolId));
};

const occupancyAmong = (
  alive: readonly Runner[],
  idleSandboxes: readonly SandboxId[],
): PoolOccupancy =>
  PoolOccupancy.of({
    runners: alive.length,
    entered: alive.flatMap((each) => (each.enters ? [each.enters] : [])),
    idleSandboxes,
  });

export const occupancyOnHost = (
  hostId: HostId,
  alive: readonly Runner[],
  idleOnHost: readonly SandboxId[],
): PoolOccupancy =>
  occupancyAmong(
    alive.filter((each) => each.hostId?.equals(hostId) ?? false),
    idleOnHost,
  );
