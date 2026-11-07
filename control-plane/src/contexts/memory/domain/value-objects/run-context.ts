import type { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface RunContext {
  readonly teamId: TeamId;
  readonly lineId: LineId | null;
  readonly stationId: StationId | null;
  readonly repositories: readonly Repository[];
}

export interface StationContext extends RunContext {
  readonly lineId: LineId;
  readonly stationId: StationId;
}

interface TouchedFile {
  readonly repository: Repository;
  readonly path: MemoryPath;
}

export interface TouchedContext extends RunContext {
  readonly touched: readonly TouchedFile[];
}
