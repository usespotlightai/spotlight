import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';

export const occupancyOf = async (
  runners: RunnerRepository,
  placements: SandboxPlacementsPort,
  poolId: PoolId,
  at: Date,
): Promise<PoolOccupancy> => {
  const alive = await runners.aliveIn(poolId, at);

  return PoolOccupancy.of({
    runners: alive.length,
    entered: alive.flatMap((each) => (each.enters ? [each.enters] : [])),
    idleSandboxes: await placements.idleInPool(poolId),
  });
};
