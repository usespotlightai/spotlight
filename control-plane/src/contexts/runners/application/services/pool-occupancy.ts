import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';

export const occupancyOf = async (
  runners: RunnerRepository,
  placements: SandboxPlacementsPort,
  poolId: RunnerPoolId,
  at: Date,
): Promise<PoolOccupancy> => {
  const alive = await runners.aliveIn(poolId, at);

  return PoolOccupancy.of({
    runners: alive.length,
    idleSandboxes: await placements.idleInPool(poolId),
  });
};
