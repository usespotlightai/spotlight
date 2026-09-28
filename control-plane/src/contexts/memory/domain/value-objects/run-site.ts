import type { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface RunSite {
  readonly teamId: TeamId;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repositories: readonly Repository[];
}

export interface StationSite extends RunSite {
  readonly lineId: string;
  readonly stationId: string;
}

export interface TouchedFile {
  readonly repository: Repository;
  readonly path: MemoryPath;
}

export interface TouchedSite extends RunSite {
  readonly touched: readonly TouchedFile[];
}
