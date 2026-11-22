import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const UPKEEP_NOTICES = Symbol('MEMORY_UPKEEP_NOTICES');

export interface UpkeepNotice {
  readonly upkeepId: MemoryUpkeepId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly retiring: number;
  readonly merging: number;
}

export interface UpkeepNoticesPort {
  swept(notice: UpkeepNotice): Promise<void>;

  settled(upkeepId: MemoryUpkeepId, teamId: TeamId): Promise<void>;
}
